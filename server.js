const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

let db;

async function initDB() {
    db = await open({
        filename: './career_navigator.db',
        driver: sqlite3.Database
    });
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password_hash TEXT,
            role TEXT,
            full_name TEXT,
            phone TEXT,
            city TEXT
        );
        CREATE TABLE IF NOT EXISTS education_programs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            university_id INTEGER,
            name TEXT,
            field_of_study TEXT,
            description TEXT
        );
        CREATE TABLE IF NOT EXISTS employer_requirements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employer_id INTEGER,
            job_title TEXT,
            required_competencies TEXT,
            salary_min INTEGER,
            salary_max INTEGER
        );
        CREATE TABLE IF NOT EXISTS test_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_text TEXT,
            options TEXT
        );
        CREATE TABLE IF NOT EXISTS test_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            scores TEXT
        );
        CREATE TABLE IF NOT EXISTS recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            program_id INTEGER,
            match_score INTEGER
        );
        CREATE TABLE IF NOT EXISTS career_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            target_job TEXT,
            steps TEXT
        );
    `);
    console.log('База готова');
}

function getDB() {
    return db;
}

app.post('/api/auth/register', async (req, res) => {
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

app.post('/api/auth/login', async (req, res) => {
    try {
        const db = getDB();
        const { email, password } = req.body;
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) return res.status(401).json({ error: 'Неверный логин' });
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Неверный пароль' });
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: user.id, role: user.role }, 'secret');
        res.json({ accessToken: token, user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.get('/api/auth/profile', async (req, res) => {
    try {
        const db = getDB();
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Нет токена' });
        const decoded = jwt.verify(token, 'secret');
        const user = await db.get('SELECT id, email, role, full_name, phone, city FROM users WHERE id = ?', [decoded.id]);
        res.json(user);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.post('/api/employer/requirements', async (req, res) => {
    try {
        const db = getDB();
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Нет токена' });
        const user = jwt.verify(token, 'secret');
        if (user.role !== 'employer') return res.status(403).json({ error: 'Нет доступа' });
        const { job_title, required_competencies, salary_min, salary_max } = req.body;
        await db.run(
            'INSERT INTO employer_requirements (employer_id, job_title, required_competencies, salary_min, salary_max) VALUES (?, ?, ?, ?, ?)',
            [user.id, job_title, required_competencies, salary_min, salary_max]
        );
        res.json({ message: 'Вакансия добавлена' });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.get('/api/employer/requirements', async (req, res) => {
    try {
        const db = getDB();
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Нет токена' });
        const user = jwt.verify(token, 'secret');
        if (user.role !== 'employer') return res.status(403).json({ error: 'Нет доступа' });
        const rows = await db.all('SELECT * FROM employer_requirements WHERE employer_id = ?', [user.id]);
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.post('/api/university/programs', async (req, res) => {
    try {
        const db = getDB();
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Нет токена' });
        const user = jwt.verify(token, 'secret');
        if (user.role !== 'university') return res.status(403).json({ error: 'Нет доступа' });
        const { name, field_of_study, description } = req.body;
        await db.run(
            'INSERT INTO education_programs (university_id, name, field_of_study, description) VALUES (?, ?, ?, ?)',
            [user.id, name, field_of_study, description]
        );
        res.json({ message: 'Программа добавлена' });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.get('/api/university/programs', async (req, res) => {
    try {
        const db = getDB();
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Нет токена' });
        const user = jwt.verify(token, 'secret');
        if (user.role !== 'university') return res.status(403).json({ error: 'Нет доступа' });
        const rows = await db.all('SELECT * FROM education_programs WHERE university_id = ?', [user.id]);
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.get('/api/applicant/professions', async (req, res) => {
    try {
        const db = getDB();
        const rows = await db.all('SELECT * FROM employer_requirements');
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.get('/api/applicant/programs', async (req, res) => {
    try {
        const db = getDB();
        const rows = await db.all('SELECT p.*, u.full_name as uni_name FROM education_programs p JOIN users u ON p.university_id = u.id');
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.get('/api/tests/questions', async (req, res) => {
    try {
        const db = getDB();
        const rows = await db.all('SELECT * FROM test_questions');
        const formatted = rows.map(q => ({ ...q, options: JSON.parse(q.options) }));
        res.json(formatted);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.post('/api/tests/submit', async (req, res) => {
    try {
        const db = getDB();
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Нет токена' });
        const user = jwt.verify(token, 'secret');
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
        await db.run('INSERT INTO test_results (user_id, scores) VALUES (?, ?)', [user.id, JSON.stringify(scores)]);
        let top = 'it', max = 0;
        for (let cat in scores) {
            if (scores[cat] > max) { max = scores[cat]; top = cat; }
        }
        let recs = [];
        if (top === 'it') recs = await db.all("SELECT * FROM education_programs WHERE field_of_study LIKE '%Информатика%'");
        else recs = await db.all('SELECT * FROM education_programs LIMIT 3');
        for (let r of recs) {
            await db.run('INSERT INTO recommendations (user_id, program_id, match_score) VALUES (?, ?, ?)', [user.id, r.id, Math.floor(max * 100)]);
        }
        res.json({ message: 'Тест пройден', scores });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.get('/api/tests/recommendations', async (req, res) => {
    try {
        const db = getDB();
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Нет токена' });
        const user = jwt.verify(token, 'secret');
        const rows = await db.all(`
            SELECT r.*, p.name as program_name 
            FROM recommendations r
            JOIN education_programs p ON r.program_id = p.id
            WHERE r.user_id = ?
        `, [user.id]);
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const db = getDB();
        const { q } = req.query;
        if (!q) return res.json({ programs: [], jobs: [] });
        const programs = await db.all("SELECT * FROM education_programs WHERE name LIKE ?", [`%${q}%`]);
        const jobs = await db.all("SELECT * FROM employer_requirements WHERE job_title LIKE ?", [`%${q}%`]);
        res.json({ programs, jobs });
    } catch(err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

async function seed() {
    const hash = await bcrypt.hash('123456', 10);
    const s1 = await db.get('SELECT id FROM users WHERE email = "student@example.com"');
    if (!s1) {
        await db.run('INSERT INTO users (email, password_hash, role, full_name) VALUES (?, ?, "applicant", "Студент Петров")', ['student@example.com', hash]);
    }
    const s2 = await db.get('SELECT id FROM users WHERE email = "university@example.com"');
    if (!s2) {
        await db.run('INSERT INTO users (email, password_hash, role, full_name) VALUES (?, ?, "university", "МГУ")', ['university@example.com', hash]);
    }
    const s3 = await db.get('SELECT id FROM users WHERE email = "employer@example.com"');
    if (!s3) {
        await db.run('INSERT INTO users (email, password_hash, role, full_name) VALUES (?, ?, "employer", "Яндекс")', ['employer@example.com', hash]);
    }
    const qc = await db.get('SELECT COUNT(*) as c FROM test_questions');
    if (qc.c === 0) {
        await db.run(`INSERT INTO test_questions (question_text, options) VALUES (?, ?)`,
            'Что вам интересно?',
            '[{"text": "Программирование", "score": {"it": 0.9}},{"text": "Медицина", "score": {"medicine": 0.9}},{"text": "Инженерия", "score": {"engineering": 0.8}},{"text": "Бизнес", "score": {"business": 0.9}}]');
        await db.run(`INSERT INTO test_questions (question_text, options) VALUES (?, ?)`,
            'Где хотите работать?',
            '[{"text": "В IT", "score": {"it": 0.9}},{"text": "В больнице", "score": {"medicine": 0.9}},{"text": "На заводе", "score": {"engineering": 0.8}},{"text": "В офисе", "score": {"business": 0.7}}]');
    }
    const pc = await db.get('SELECT COUNT(*) as c FROM education_programs');
    if (pc.c === 0) {
        const univ = await db.get('SELECT id FROM users WHERE role = "university" LIMIT 1');
        if (univ) {
            await db.run('INSERT INTO education_programs (university_id, name, field_of_study, description) VALUES (?, ?, ?, ?)', [univ.id, 'Программная инженерия', 'Информатика', 'Разработка ПО']);
            await db.run('INSERT INTO education_programs (university_id, name, field_of_study, description) VALUES (?, ?, ?, ?)', [univ.id, 'Лечебное дело', 'Медицина', 'Подготовка врачей']);
        }
    }
    console.log('\n=================================');
    console.log('Сервер запущен');
    console.log('=================================');
    console.log('student@example.com / 123456');
    console.log('university@example.com / 123456');
    console.log('employer@example.com / 123456');
    console.log('=================================\n');
}

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

async function start() {
    await initDB();
    await seed();
    app.listen(5000, () => console.log('http://localhost:5000'));
}

start();