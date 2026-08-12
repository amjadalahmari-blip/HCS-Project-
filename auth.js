const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'hcs_secret_2026';

const db = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hc_portal_db'
});

// Middleware للتحقق من JWT Token
function verifyToken(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer '))
        return res.status(401).json({ success: false, message: 'غير مصرح — يرجى تسجيل الدخول' });
    try {
        req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'انتهت صلاحية الجلسة — يرجى تسجيل الدخول مجدداً' });
    }
}

// ══ 1. تسجيل الدخول ══
router.post('/login', (req, res) => {
    // يقبل email أو username من الواجهة
    const identifier = req.body.email || req.body.username;
    const password   = req.body.password;

    if (!identifier || !password)
        return res.status(400).json({ success: false, message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });

    const query = `
        SELECT u.id, u.username_display, u.username, u.password, u.role, d.dept_key
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.username = ?
    `;

    db.execute(query, [identifier], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
        if (!results.length) return res.status(401).json({ success: false, message: 'البريد الإلكتروني غير مسجل في النظام' });

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });

        // توليد JWT Token صالح 8 ساعات
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, dept_key: user.dept_key },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // تحديد الصفحة المستهدفة حسب الـ role والـ dept_key
        let redirectUrl;
        if (user.role === 'Super_Admin') {
            redirectUrl = 'admin.html';
        } else if (user.role === 'General_Manager') {
            redirectUrl = 'departments/portalmanager.html';
        } else if (user.dept_key === 'content_manager') {
            redirectUrl = 'content-manager.html';
        } else if (user.dept_key) {
            redirectUrl = `departments/${user.dept_key}/${user.dept_key}.html`;
        } else {
            redirectUrl = 'content-manager.html';
        }

        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.username_display,
                username: user.username,
                role: user.role,
                dept_key: user.dept_key
            },
            redirectUrl
        });
    });
});

// ══ 2. جلب بيانات المستخدم الحالي (للتحقق من الجلسة) ══
router.get('/me', verifyToken, (req, res) => {
    const query = `
        SELECT u.id, u.username_display, u.username, u.role, d.dept_key
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ?
    `;
    db.execute(query, [req.user.id], (err, results) => {
        if (err || !results.length)
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        const u = results[0];
        return res.json({ success: true, user: { id: u.id, name: u.username_display, username: u.username, role: u.role, dept_key: u.dept_key } });
    });
});

// ══ 3. إنشاء حساب جديد (من admin.html) ══
router.post('/register', verifyToken, async (req, res) => {
    if (req.user.role !== 'Super_Admin')
        return res.status(403).json({ success: false, message: 'غير مصرح — أدمن فقط' });

    const { name, email, password, role, dept_key } = req.body;
    if (!name || !email || !password || !role)
        return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const insertUser = (deptId) => {
            const q = 'INSERT INTO users (username_display, username, password, role, department_id) VALUES (?, ?, ?, ?, ?)';
            db.execute(q, [name, email, hashedPassword, role, deptId], (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY')
                        return res.status(400).json({ success: false, message: 'اسم المستخدم مسجل مسبقاً' });
                    return res.status(500).json({ success: false, message: 'خطأ في الحفظ' });
                }
                return res.json({ success: true, message: 'تم إنشاء الحساب بنجاح', user: { id: result.insertId } });
            });
        };

        if (dept_key) {
            db.execute('SELECT id FROM departments WHERE dept_key = ?', [dept_key], (err, rows) => {
                if (err || !rows.length)
                    return res.status(400).json({ success: false, message: 'القسم غير موجود' });
                insertUser(rows[0].id);
            });
        } else {
            insertUser(null);
        }
    } catch {
        return res.status(500).json({ success: false, message: 'خطأ في تشفير البيانات' });
    }
});

// ══ 4. جلب قائمة المستخدمين ══
router.get('/users', verifyToken, (req, res) => {
    if (req.user.role !== 'Super_Admin')
        return res.status(403).json({ success: false, message: 'غير مصرح' });

    const q = `
        SELECT u.id, u.username_display AS name, u.username AS email, u.role, d.dept_key
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
    `;
    db.execute(q, [], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
        return res.json(results);
    });
});

// ══ 5. حذف مستخدم ══
router.delete('/users/:id', verifyToken, (req, res) => {
    if (req.user.role !== 'Super_Admin')
        return res.status(403).json({ success: false, message: 'غير مصرح' });

    db.execute('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'تعذر الحذف' });
        return res.json({ success: true, message: 'تم الحذف بنجاح' });
    });
});

module.exports = router;

