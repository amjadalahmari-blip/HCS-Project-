// ══ مسار إدارة المحتوى — الإعلانات والجوائز ══
// يحفظ في قاعدة البيانات (جدولا announcements و awards)
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

// Middleware للتحقق من JWT Token (نفس النمط المستخدم في auth.js)
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

// Middleware للتحقق من صلاحية إدارة المحتوى (Super_Admin أو content_manager)
function verifyContentAccess(req, res, next) {
    if (req.user.role === 'Super_Admin' || req.user.dept_key === 'content_manager') {
        return next();
    }
    return res.status(403).json({ success: false, message: 'غير مصرح لك بإدارة المحتوى' });
}

/* ════════════════════════════════════════════════
   الإعلانات — ANNOUNCEMENTS
════════════════════════════════════════════════ */

// جلب كل الإعلانات — عام، بدون حماية (تستخدمه index.html للعرض)
router.get('/announcements', (req, res) => {
    db.query(
        'SELECT id, title, description, event_date, image_data, created_at FROM announcements ORDER BY created_at DESC',
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: 'خطأ في جلب الإعلانات' });
            res.json(rows);
        }
    );
});

// إضافة إعلان جديد — محمي
router.post('/announcements', verifyToken, verifyContentAccess, (req, res) => {
    const { title, description, event_date, image_data } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'العنوان مطلوب' });

    db.query(
        'INSERT INTO announcements (title, description, event_date, image_data, created_by) VALUES (?, ?, ?, ?, ?)',
        [title, description || null, event_date || null, image_data || null, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ success: false, message: 'خطأ في إضافة الإعلان' });
            res.json({ success: true, id: result.insertId });
        }
    );
});

// تعديل إعلان — محمي
router.put('/announcements/:id', verifyToken, verifyContentAccess, (req, res) => {
    const { title, description, event_date, image_data } = req.body;
    db.query(
        'UPDATE announcements SET title=?, description=?, event_date=?, image_data=? WHERE id=?',
        [title, description || null, event_date || null, image_data || null, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: 'خطأ في تحديث الإعلان' });
            res.json({ success: true });
        }
    );
});

// حذف إعلان — محمي
router.delete('/announcements/:id', verifyToken, verifyContentAccess, (req, res) => {
    db.query('DELETE FROM announcements WHERE id=?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'خطأ في حذف الإعلان' });
        res.json({ success: true });
    });
});

/* ════════════════════════════════════════════════
   الجوائز — AWARDS
════════════════════════════════════════════════ */

// جلب كل الجوائز — عام، بدون حماية
router.get('/awards', (req, res) => {
    db.query(
        'SELECT id, title, description, award_date, image_data, created_at FROM awards ORDER BY created_at DESC',
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: 'خطأ في جلب الجوائز' });
            res.json(rows);
        }
    );
});

// إضافة جائزة جديدة — محمي
router.post('/awards', verifyToken, verifyContentAccess, (req, res) => {
    const { title, description, award_date, image_data } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'العنوان مطلوب' });

    db.query(
        'INSERT INTO awards (title, description, award_date, image_data, created_by) VALUES (?, ?, ?, ?, ?)',
        [title, description || null, award_date || null, image_data || null, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ success: false, message: 'خطأ في إضافة الجائزة' });
            res.json({ success: true, id: result.insertId });
        }
    );
});

// تعديل جائزة — محمي
router.put('/awards/:id', verifyToken, verifyContentAccess, (req, res) => {
    const { title, description, award_date, image_data } = req.body;
    db.query(
        'UPDATE awards SET title=?, description=?, award_date=?, image_data=? WHERE id=?',
        [title, description || null, award_date || null, image_data || null, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: 'خطأ في تحديث الجائزة' });
            res.json({ success: true });
        }
    );
});

// حذف جائزة — محمي
router.delete('/awards/:id', verifyToken, verifyContentAccess, (req, res) => {
    db.query('DELETE FROM awards WHERE id=?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'خطأ في حذف الجائزة' });
        res.json({ success: true });
    });
});

module.exports = router;