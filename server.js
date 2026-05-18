const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } 
});

const initDB = async () => {
  try {
    // Create Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        uid VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        age_group VARCHAR(50) NOT NULL,
        role VARCHAR(50) DEFAULT 'Player'
      );
      CREATE TABLE IF NOT EXISTS tournaments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        venue VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active'
      );
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        tournament VARCHAR(255),
        p1_uid VARCHAR(255) REFERENCES players(uid),
        p2_uid VARCHAR(255) REFERENCES players(uid),
        s1 INT,
        s2 INT,
        referee VARCHAR(255),
        logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database initialized");
  } catch (err) { console.error(err); }
};
initDB();

// ROUTES
app.get('/api/players', async (req, res) => {
  const result = await pool.query('SELECT * FROM players ORDER BY role DESC, name ASC');
  res.json(result.rows);
});

app.post('/api/players', async (req, res) => {
  const { uid, name, age_group, role } = req.body;
  await pool.query(
    'INSERT INTO players (uid, name, age_group, role) VALUES ($1, $2, $3, $4) ON CONFLICT (uid) DO UPDATE SET role = EXCLUDED.role',
    [uid, name, age_group, role || 'Player']
  );
  res.sendStatus(201);
});

app.get('/api/tournaments', async (req, res) => {
  const result = await pool.query('SELECT * FROM tournaments');
  res.json(result.rows);
});

app.post('/api/tournaments', async (req, res) => {
  const { name, venue } = req.body;
  await pool.query('INSERT INTO tournaments (name, venue) VALUES ($1, $2) ON CONFLICT DO NOTHING', [name, venue]);
  res.sendStatus(201);
});

app.get('/api/matches', async (req, res) => {
  const result = await pool.query(`
    SELECT m.*, p1.name as p1_name, p2.name as p2_name 
    FROM matches m 
    JOIN players p1 ON m.p1_uid = p1.uid 
    JOIN players p2 ON m.p2_uid = p2.uid 
    ORDER BY logged_at DESC`);
  res.json(result.rows);
});

app.post('/api/matches', async (req, res) => {
  const { tournament, p1_uid, p2_uid, s1, s2, referee } = req.body;
  await pool.query(
    'INSERT INTO matches (tournament, p1_uid, p2_uid, s1, s2, referee) VALUES ($1, $2, $3, $4, $5, $6)',
    [tournament, p1_uid, p2_uid, s1, s2, referee]
  );
  res.sendStatus(201);
});

app.listen(process.env.PORT || 3000);
