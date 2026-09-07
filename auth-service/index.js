const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, initDB } = require('./db');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Register a new user
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Log in an existing user
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

initDB()
  .then(() => {
    app.listen(3000, () => console.log('Auth service running on port 3000'));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
