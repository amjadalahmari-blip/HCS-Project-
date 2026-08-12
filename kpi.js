// ══ مسار مؤشرات الأقسام — QFR و BP ══
// يحفظ نتائج كل مؤشر لكل قسم، لكل شهر/سنة، في قاعدة البيانات
const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'hcs_secret_2026';

const db = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hc_portal_db'
});

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

// التحقق إن المستخدم يملك صلاحية الوصول لقسم معيّن
function verifyDeptAccess(req, res, next) {
    const requestedDept = req.params.deptKey || req.body.dept_key;
    if (req.user.role === 'Super_Admin' || req.user.role === 'General_Manager') {
        return next();
    }
    if (req.user.dept_key === requestedDept) {
        return next();
    }
    return res.status(403).json({ success: false, message: 'غير مصرح لك بالوصول لهذا القسم' });
}

/* ════════════════════════════════════════════════
   جلب كل مؤشرات قسم معيّن (لرسم المخطط البياني للسنة)
   GET /api/kpi/:deptKey?year=2026
════════════════════════════════════════════════ */
router.get('/:deptKey', verifyToken, verifyDeptAccess, (req, res) => {
    const deptKey = req.params.deptKey;
    const year = req.query.year || new Date().getFullYear();

    const sql = `
        SELECT r.kpi_type, r.kpi_code, r.month, r.year, r.result_value, r.raw_filename, r.updated_at
        FROM kpi_records r
        JOIN departments d ON r.department_id = d.id
        WHERE d.dept_key = ? AND r.year = ?
        ORDER BY r.month ASC
    `;
    db.query(sql, [deptKey, year], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'خطأ في جلب المؤشرات' });
        res.json(rows);
    });
});

/* ════════════════════════════════════════════════
   حفظ/تحديث نتيجة مؤشر لشهر معيّن
   POST /api/kpi/:deptKey
   body: { kpi_type, kpi_code, month, year, result_value, raw_filename }
════════════════════════════════════════════════ */
router.post('/:deptKey', verifyToken, verifyDeptAccess, (req, res) => {
    const deptKey = req.params.deptKey;
    const { kpi_type, kpi_code, month, year, result_value, raw_filename } = req.body;

    if (!kpi_type || !kpi_code || !month || !year) {
        return res.status(400).json({ success: false, message: 'بيانات ناقصة — يلزم نوع المؤشر والكود والشهر والسنة' });
    }

    // جلب department_id من dept_key
    db.query('SELECT id FROM departments WHERE dept_key = ?', [deptKey], (err, deptRows) => {
        if (err || !deptRows.length) {
            return res.status(404).json({ success: false, message: 'القسم غير موجود' });
        }
        const departmentId = deptRows[0].id;

        const sql = `
            INSERT INTO kpi_records (department_id, kpi_type, kpi_code, month, year, result_value, raw_filename, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                result_value = VALUES(result_value),
                raw_filename = VALUES(raw_filename),
                updated_by   = VALUES(updated_by),
                updated_at   = CURRENT_TIMESTAMP
        `;
        db.query(sql, [departmentId, kpi_type, kpi_code, month, year, result_value, raw_filename || null, req.user.id], (err2) => {
            if (err2) return res.status(500).json({ success: false, message: 'خطأ في حفظ المؤشر' });
            res.json({ success: true });
        });
    });
});

module.exports = router;