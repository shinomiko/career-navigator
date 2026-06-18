const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDB } = require('../../server');

router.post('/register', async (req, res) => {
    try {
        const db = getDB();
        const { email, password, role, full_name, phone, city } = req.body;
        const exist = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (exist) return res.status(400).json({ error: 'Почта занята' });
        
        const hash = await bcrypt.hash(password, 10);
        await db.run(
            'INSERT INTO users (email, password_hash, role, full_name, phone, city) VALUES (?, ?, ?, ?, ?, ?)',
            [email, hash, role, full_name || '', phone || '', city || '']
        );
        res.json({ message: 'Регистрация прошла' });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const db = getDB();
        const { email, password } = req.body;
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
        
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Неверный логин или пароль' });
        
        const token = jwt.sign({ id: user.id, role: user.role }, 'secret');
        res.json({ accessToken: token, user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.post('/forgot', async (req, res) => {
    try {
        const db = getDB();
        const { email } = req.body;
        const user = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (user) {
            const resetToken = Math.random().toString(36).substring(2, 10);
            await db.run('UPDATE users SET reset_token = ? WHERE id = ?', [resetToken, user.id]);
            console.log('Ссылка для сброса: http://localhost:5000/reset?token=' + resetToken);
        }
        res.json({ message: 'Ссылка для сброса в консоли' });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.post('/reset', async (req, res) => {
    try {
        const db = getDB();
        const { token, new_password } = req.body;
        const user = await db.get('SELECT id FROM users WHERE reset_token = ?', [token]);
        if (!user) return res.status(400).json({ error: 'Неверный токен' });
        
        const hash = await bcrypt.hash(new_password, 10);
        await db.run('UPDATE users SET password_hash = ?, reset_token = NULL WHERE id = ?', [hash, user.id]);
        res.json({ message: 'Пароль изменен' });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

router.get('/profile', async (req, res) => {
    try {
        const db = getDB();
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Нет токена' });
        
        const decoded = jwt.verify(token, 'secret');
        const user = await db.get('SELECT id, email, role, full_name, phone, city FROM users WHERE id = ?', [decoded.id]);
        res.json(user);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

module.exports = router;