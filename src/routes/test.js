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

router.get('/questions', auth, async (req, res) => {
    try {
        const db = getDB();
        const rows = await db.all('SELECT * FROM test_questions');
        const formatted = rows.map(q => ({ ...q, options: JSON.parse(q.options) }));
        res.json(formatted);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.post('/submit', auth, async (req, res) => {
    try {
        const db = getDB();
        const { answers } = req.body;
        let scores = { it: 0, medicine: 0, engineering: 0, business: 0 };
        
        for (let a of answers) {
            const q = await db.get('SELECT options FROM test_questions WHERE id = ?', [a.questionId]);
            if (q) {
                const opts = JSON.parse(q.options);
                const selected = opts[a.answerIndex];
                if (selected && selected.score) {
                    for (let cat in selected.score) {
                        scores[cat] += selected.score[cat];
                    }
                }
            }
        }
        
        await db.run('INSERT INTO test_results (user_id, scores) VALUES (?, ?)', [req.user.id, JSON.stringify(scores)]);
        
        let top = 'it', max = 0;
        for (let cat in scores) {
            if (scores[cat] > max) { max = scores[cat]; top = cat; }
        }
        
        let recs = [];
        if (top === 'it') recs = await db.all("SELECT * FROM education_programs WHERE field_of_study LIKE '%Информатика%'");
        else recs = await db.all('SELECT * FROM education_programs LIMIT 3');
        
        for (let r of recs) {
            await db.run('INSERT INTO recommendations (user_id, program_id, match_score) VALUES (?, ?, ?)', [req.user.id, r.id, Math.floor(max * 100)]);
        }
        
        res.json({ message: 'Тест пройден', scores });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.get('/recommendations', auth, async (req, res) => {
    try {
        const db = getDB();
        const rows = await db.all(`
            SELECT r.*, p.name as program_name 
            FROM recommendations r
            JOIN education_programs p ON r.program_id = p.id
            WHERE r.user_id = ?
        `, [req.user.id]);
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

module.exports = router;