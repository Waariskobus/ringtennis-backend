const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// Enterprise PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } 
});

// Robust Relational Database Schema
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        uid VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        age_group VARCHAR(50) NOT NULL,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        tournament VARCHAR(255) DEFAULT 'Friendly',
        p1_uid VARCHAR(255) REFERENCES players(uid),
        p2_uid VARCHAR(255) REFERENCES players(uid),
        s1 INT NOT NULL,
        s2 INT NOT NULL,
        referee VARCHAR(255) NOT NULL,
        logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Production Database Schema Verified");
  } catch (err) {
    console.error("❌ Database Initialization Error:", err);
  }
};
initializeDatabase();

// --- SECURE API ROUTES ---

// Fetch All Players
app.get('/api/players', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM players ORDER BY name ASC');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

// Register Single/Bulk Players with Conflict Resolution
app.post('/api/players', async (req, res) => {
  const { uid, name, age_group } = req.body;
  if (!uid || !name || !age_group) return res.status(400).json({ error: "Missing required fields" });

  try {
    await pool.query(
      `INSERT INTO players (uid, name, age_group) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (uid) DO UPDATE SET name = EXCLUDED.name, age_group = EXCLUDED.age_group`,
      [uid, name, age_group]
    );
    res.status(201).json({ message: "Player synced successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to register player" });
  }
});

// Fetch All Matches with Player Names (SQL JOIN)
app.get('/api/matches', async (req, res) => {
  try {
    const query = `
      SELECT m.id, m.tournament, m.s1, m.s2, m.referee, m.logged_at,
             p1.name as p1_name, p2.name as p2_name, p1.age_group
      FROM matches m
      JOIN players p1 ON m.p1_uid = p1.uid
      JOIN players p2 ON m.p2_uid = p2.uid
      ORDER BY m.logged_at DESC;
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch match history" });
  }
});

// Submit Official Match Score
app.post('/api/matches', async (req, res) => {
  const { tournament, p1_uid, p2_uid, s1, s2, referee } = req.body;
  if (!p1_uid || !p2_uid || referee === "") return res.status(400).json({ error: "Invalid match data" });

  try {
    await pool.query(
      `INSERT INTO matches (tournament, p1_uid, p2_uid, s1, s2, referee) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tournament || 'Friendly', p1_uid, p2_uid, s1, s2, referee]
    );
    res.status(201).json({ message: "Official match recorded" });
  } catch (err) {
    res.status(500).json({ error: "Database transaction failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API Server running on port ${PORT}`));