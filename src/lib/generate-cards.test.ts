import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Anthropic SDK
const cardResponse = JSON.stringify({
  polish_word: "dom",
  english_word: "house / home",
  pronunciation: "dohm",
  notes: "Masculine noun. Cases: domu (gen), domowi (dat).",
  sentences: [
    { difficulty: "easy", sentence_pl: "To jest dom.", sentence_en: "This is a house." },
    { difficulty: "medium", sentence_pl: "Mój dom jest duży.", sentence_en: "My house is big." },
    { difficulty: "hard", sentence_pl: "Dom, w którym mieszkam, jest stary.", sentence_en: "The house I live in is old." },
  ],
});

const grammarOk = JSON.stringify({ correct: true });

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      _callCount = 0;
      messages = {
        create: vi.fn().mockImplementation(() => {
          this._callCount++;
          const text = this._callCount === 1 ? cardResponse : grammarOk;
          return Promise.resolve({ content: [{ type: "text", text }] });
        }),
      };

      constructor() {
        const self = this;
        this.messages = {
          create: vi.fn().mockImplementation(() => {
            self._callCount++;
            const text = self._callCount === 1 ? cardResponse : grammarOk;
            return Promise.resolve({ content: [{ type: "text", text }] });
          }),
        };
      }
    },
  };
});

// Mock TTS
vi.mock("./tts", () => ({
  generateAudio: vi.fn().mockResolvedValue("/audio/dom.mp3"),
}));

// Mock db with in-memory SQLite
vi.mock("./db", async () => {
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      polish_word TEXT UNIQUE NOT NULL,
      english_word TEXT NOT NULL,
      pronunciation TEXT NOT NULL,
      notes TEXT,
      audio_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE card_sentences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      sentence_pl TEXT NOT NULL,
      sentence_en TEXT NOT NULL,
      audio_path TEXT,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL UNIQUE,
      ease_factor REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      next_review DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_reviewed DATETIME,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );
    CREATE TABLE generation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_number INTEGER NOT NULL,
      total_generated INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE word_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      frequency_rank INTEGER NOT NULL UNIQUE,
      polish_word TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'generated')),
      generated_at DATETIME,
      card_id INTEGER,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );
    CREATE INDEX idx_word_queue_status ON word_queue(status, frequency_rank);
  `);
  return { default: db };
});

import db from "./db";
import { generateCards, getQueueStats, generateCardContent } from "./generate-cards";

function seedQueue(words: { rank: number; word: string }[]) {
  const insert = db.prepare(
    "INSERT INTO word_queue (frequency_rank, polish_word) VALUES (?, ?)"
  );
  for (const w of words) {
    insert.run(w.rank, w.word);
  }
}

function clearAll() {
  db.exec("DELETE FROM word_queue");
  db.exec("DELETE FROM reviews");
  db.exec("DELETE FROM card_sentences");
  db.exec("DELETE FROM cards");
  db.exec("DELETE FROM generation_log");
}

describe("generateCardContent", () => {
  it("returns card data from Claude API", async () => {
    const result = await generateCardContent("dom");
    expect(result.polish_word).toBe("dom");
    expect(result.english_word).toBe("house / home");
    expect(result.sentences).toHaveLength(3);
  });
});

describe("generateCards", () => {
  beforeEach(clearAll);

  it("generates cards from queued words", async () => {
    seedQueue([{ rank: 1, word: "dom" }]);

    const result = await generateCards(5);
    expect(result.generated).toBe(1);
    expect(result.errors).toHaveLength(0);

    const card = db.prepare("SELECT * FROM cards WHERE polish_word = 'dom'").get() as Record<string, unknown>;
    expect(card).toBeTruthy();
    expect(card.english_word).toBe("house / home");
    expect(card.audio_path).toBe("/audio/dom.mp3");

    const sentences = db.prepare("SELECT * FROM card_sentences WHERE card_id = ?").all(card.id) as Record<string, unknown>[];
    expect(sentences).toHaveLength(3);

    const review = db.prepare("SELECT * FROM reviews WHERE card_id = ?").get(card.id);
    expect(review).toBeTruthy();

    const qw = db.prepare("SELECT * FROM word_queue WHERE polish_word = 'dom'").get() as Record<string, unknown>;
    expect(qw.status).toBe("generated");
  });

  it("returns error when queue is empty", async () => {
    const result = await generateCards(5);
    expect(result.generated).toBe(0);
    expect(result.errors).toContain("No queued words available");
  });

  it("caps count at 100", async () => {
    seedQueue([{ rank: 1, word: "dom" }]);
    const result = await generateCards(200);
    expect(result.generated).toBe(1);
  });
});

describe("getQueueStats", () => {
  beforeEach(clearAll);

  it("returns correct counts", () => {
    seedQueue([
      { rank: 1, word: "dom" },
      { rank: 2, word: "kot" },
    ]);
    const stats = getQueueStats();
    expect(stats.total).toBe(2);
    expect(stats.queued).toBe(2);
    expect(stats.generated).toBe(0);
    expect(stats.totalCards).toBe(0);
  });
});
