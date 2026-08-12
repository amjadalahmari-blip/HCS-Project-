const express = require('express');
const router = express.Router();

// مسار مؤقت لحين بناء محرك الذكاء الاصطناعي لاحقاً
router.get('/status', (req, res) => {
    res.json({ success: true, message: "محرك الذكاء الاصطناعي قيد التحضير" });
});

// السطر الأهم لمنع ايرور السيرفر
module.exports = router;