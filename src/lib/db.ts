import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "langlearn.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    polish_word TEXT UNIQUE NOT NULL,
    english_word TEXT NOT NULL,
    pronunciation TEXT NOT NULL,
    notes TEXT,
    audio_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS card_sentences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    sentence_pl TEXT NOT NULL,
    sentence_en TEXT NOT NULL,
    audio_path TEXT,
    FOREIGN KEY (card_id) REFERENCES cards(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL UNIQUE,
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_reviewed DATETIME,
    FOREIGN KEY (card_id) REFERENCES cards(id)
  );

  CREATE TABLE IF NOT EXISTS generation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_number INTEGER NOT NULL,
    total_generated INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;
