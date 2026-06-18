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

router.post('/requirements', auth, async (req, res) => {
    try {
        const db = getDB();
        if (req.user.role !== 'employer') return res.status(403).json({ error: 'Нет доступа' });
        const { job_title, required_competencies, salary_min, salary_max } = req.body;
        await db.run(
            'INSERT INTO employer_requirements (employer_id, job_title, required_competencies, salary_min, salary_max) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, job_title, required_competencies, salary_min, salary_max]
        );
        res.json({ message: 'Вакансия добавлена' });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.get('/requirements', auth, async (req, res) => {
    try {
        const db = getDB();
        if (req.user.role !== 'employer') return res.status(403).json({ error: 'Нет доступа' });
        const rows = await db.all('SELECT * FROM employer_requirements WHERE employer_id = ?', [req.user.id]);
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

module.exports = router;