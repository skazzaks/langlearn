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
    review_count INTEGER DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('new_cards_per_day', '20');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('reading_themes', '["culture","geography","history","dialog","story","news"]');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('grammar_new_cards_per_day', '5');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('strict_writing_rules', 'false');

  CREATE TABLE IF NOT EXISTS grammar_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_name TEXT NOT NULL,
    usage TEXT NOT NULL,
    modifier TEXT NOT NULL,
    gender TEXT NOT NULL,
    number TEXT NOT NULL CHECK(number IN ('singular', 'plural')),
    display_title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS grammar_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grammar_card_id INTEGER NOT NULL UNIQUE,
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_reviewed DATETIME,
    first_reviewed_at DATETIME,
    FOREIGN KEY (grammar_card_id) REFERENCES grammar_cards(id)
  );

  CREATE TABLE IF NOT EXISTS grammar_nouns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    polish_word TEXT NOT NULL,
    english_word TEXT NOT NULL,
    gender TEXT NOT NULL CHECK(gender IN ('masc_pers','masc_anim','masc_inan','fem','neut'))
  );

  CREATE TABLE IF NOT EXISTS reading_stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    theme_key TEXT NOT NULL,
    themes TEXT NOT NULL,
    content_pl TEXT NOT NULL,
    questions_pl TEXT NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reading_story_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    FOREIGN KEY (story_id) REFERENCES reading_stories(id)
  );

  CREATE INDEX IF NOT EXISTS idx_reading_story_tokens_token ON reading_story_tokens(token);

  CREATE TABLE IF NOT EXISTS reading_definitions_cache (
    token TEXT PRIMARY KEY,
    definition_en TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reading_news_cache (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    summary TEXT NOT NULL,
    updated_at DATETIME NOT NULL
  );
`);

// Add columns for existing reading_stories table if needed
try {
  db.exec(`ALTER TABLE reading_stories ADD COLUMN theme_key TEXT`);
} catch {
  // Column already exists
}

try {
  db.exec(`ALTER TABLE reading_stories ADD COLUMN used_at DATETIME`);
} catch {
  // Column already exists
}

// Add first_reviewed_at column if it doesn't exist
try {
  db.exec(`ALTER TABLE reviews ADD COLUMN first_reviewed_at DATETIME`);
} catch {
  // Column already exists
}

// Add review_count column if it doesn't exist
try {
  db.exec(`ALTER TABLE reviews ADD COLUMN review_count INTEGER DEFAULT 0`);
} catch {
  // Column already exists
}

// Add priority column for manually-added cards
try {
  db.exec(`ALTER TABLE reviews ADD COLUMN priority INTEGER DEFAULT 0`);
} catch {
  // Column already exists
}

// Backfill first_reviewed_at for cards reviewed before the migration
db.exec(`
  UPDATE reviews
  SET first_reviewed_at = COALESCE(last_reviewed, next_review)
  WHERE first_reviewed_at IS NULL
    AND (last_reviewed IS NOT NULL OR repetitions > 0)
`);

// Backfill review_count for existing rows (best-effort)
db.exec(`
  UPDATE reviews
  SET review_count = CASE
    WHEN review_count IS NULL THEN CASE
      WHEN last_reviewed IS NOT NULL OR repetitions > 0 THEN 1
      ELSE 0
    END
    ELSE review_count
  END
`);

export default db;
