// استدعاء المكتبات الرسمية المعتمدة لبناء الباك آند وحماية النطاقات
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // قراءة الملف السري .env فوراً عند التشغيل

const app = express();

// تفعيل حزم الحماية وتبادل البيانات بين الواجهات والسيرفر
// زيادة الحد الأقصى لحجم الطلب لاستيعاب الصور المرفوعة بصيغة base64
app.use(express.json({ limit: '15mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname)));

// ══ تأسيس محرك الاتصال بـ MySQL بأسلوب الـ Connection Pool المانع للضغط ══
// تعيين الاتصال الحديث المتوافق بالملي مع إصدار MySQL 9 فما فوق
// الاتصال المباشر والمقاوم للأخطاء المتوافق مع إصدار MySQL 9 فما فوق
const db = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '', // فارغ تماماً بدون أي مسافات
    database: 'hc_portal_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// اختبار فحص الاتصال بالداتابيز حياً فور تشغيل السيرفر لمنع الايرورز
db.getConnection((err, connection) => {
    if (err) {
        console.error('\x1b[31m%s\x1b[0m', '❌ تنبيه هندسي: فشل الاتصال بقاعدة البيانات! تأكدي من صحة الباسورد في ملف .env أو تشغيل سيرفر MySQL.');
        console.error(err.message);
    } else {
        console.log('\x1b[32m%s\x1b[0m', '🔗 مبروك م. أمجاد! تم الاتصال بنجاح وربط الباك آند بقاعدة بيانات تجمع حائل الصحي.');
        connection.release(); // تحرير الاتصال بأمان
    }
});

// 1. مسار الصلاحيات وتوليد الحسابات (auth.js)
const authRouter = require('./js/auth');
app.use('/api/auth', authRouter);

// 2. مسار معالجة الأكسل والـ AI والـ BP (ai.js)
const aiRouter = require('./js/ai');
app.use('/api/ai', aiRouter);

// 3. مسار إدارة المحتوى — الإعلانات والجوائز (content.js)
const contentRouter = require('./js/content');
app.use('/api/content', contentRouter);

// 4. مسار مؤشرات الأقسام — QFR و BP (kpi.js)
const kpiRouter = require('./js/kpi');
app.use('/api/kpi', kpiRouter);

// تشغيل السيرفر والاستماع للبورت المعتمد
// تم تغيير البورت الافتراضي من 5000 إلى 5050 لتجنب تعارضه مع خدمة AirPlay Receiver في macOS
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر المركزي يعمل الآن بأمان على البورت: ${PORT}`);
});