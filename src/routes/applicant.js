const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getDB } = require('../../server');

function auth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Нет токена' });
    try {
        req.user = jwt.verify(token, 'secret');
        next();
    } catch {
        res.status(401).json({ error: 'Токен неверный' });
    }
}

router.get('/professions', auth, async (req, res) => {
    try {
        const db = getDB();
        const rows = await db.all('SELECT * FROM employer_requirements');
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.get('/programs', auth, async (req, res) => {
    try {
        const db = getDB();
        const rows = await db.all('SELECT p.*, u.full_name as uni_name FROM education_programs p JOIN users u ON p.university_id = u.id');
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.post('/plan', auth, async (req, res) => {
    try {
        const db = getDB();
        const { target_job, steps } = req.body;
        await db.run('DELETE FROM career_plans WHERE user_id = ?', [req.user.id]);
        await db.run('INSERT INTO career_plans (user_id, target_job, steps) VALUES (?, ?, ?)', [req.user.id, target_job, steps]);
        res.json({ message: 'План сохранен' });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.get('/plan', auth, async (req, res) => {
    try {
        const db = getDB();
        const plan = await db.get('SELECT * FROM career_plans WHERE user_id = ?', [req.user.id]);
        res.json(plan || {});
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

module.exports = router;