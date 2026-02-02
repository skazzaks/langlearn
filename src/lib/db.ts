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

  CREATE TABLE IF NOT EXISTS minimal_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sound_a TEXT NOT NULL,
    sound_b TEXT NOT NULL,
    description TEXT,
    UNIQUE(sound_a, sound_b)
  );

  CREATE TABLE IF NOT EXISTS minimal_pair_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair_id INTEGER NOT NULL,
    polish_word TEXT NOT NULL,
    english_word TEXT NOT NULL,
    correct_sound TEXT NOT NULL CHECK(correct_sound IN ('a', 'b')),
    audio_path TEXT,
    FOREIGN KEY (pair_id) REFERENCES minimal_pairs(id)
  );

  CREATE TABLE IF NOT EXISTS word_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frequency_rank INTEGER NOT NULL UNIQUE,
    polish_word TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'generated')),
    generated_at DATETIME,
    card_id INTEGER,
    FOREIGN KEY (card_id) REFERENCES cards(id)
  );

  CREATE INDEX IF NOT EXISTS idx_word_queue_status ON word_queue(status, frequency_rank);

  CREATE TABLE IF NOT EXISTS minimal_pair_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL UNIQUE,
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_reviewed DATETIME,
    FOREIGN KEY (word_id) REFERENCES minimal_pair_words(id)
  );
`);

export default db;
