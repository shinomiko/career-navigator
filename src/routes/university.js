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

router.post('/programs', auth, async (req, res) => {
    try {
        const db = getDB();
        if (req.user.role !== 'university') return res.status(403).json({ error: 'Нет доступа' });
        const { name, field_of_study, description } = req.body;
        await db.run(
            'INSERT INTO education_programs (university_id, name, field_of_study, description) VALUES (?, ?, ?, ?)',
            [req.user.id, name, field_of_study, description]
        );
        res.json({ message: 'Программа добавлена' });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.get('/programs', auth, async (req, res) => {
    try {
        const db = getDB();
        if (req.user.role !== 'university') return res.status(403).json({ error: 'Нет доступа' });
        const rows = await db.all('SELECT * FROM education_programs WHERE university_id = ?', [req.user.id]);
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.get('/demand', auth, async (req, res) => {
    try {
        const db = getDB();
        if (req.user.role !== 'university') return res.status(403).json({ error: 'Нет доступа' });
        const programs = await db.all('SELECT * FROM education_programs WHERE university_id = ?', [req.user.id]);
        let total = 0;
        for (let p of programs) {
            let r = await db.get('SELECT COUNT(*) as c FROM employer_requirements WHERE required_competencies LIKE ?', [`%${p.name}%`]);
            total += r.c;
        }
        res.json({ demand: total });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

module.exports = router;