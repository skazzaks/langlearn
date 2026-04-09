import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";

// Mirrors the schema from src/lib/db.ts — uses in-memory DB so tests are isolated
function createTestDb() {
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
      review_count INTEGER DEFAULT 0,
      next_review DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_reviewed DATETIME,
      first_reviewed_at DATETIME,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT INTO settings (key, value) VALUES ('new_cards_per_day', '20');
  `);
  return db;
}

function insertCard(db: ReturnType<typeof createTestDb>, word: string, id?: number) {
  const result = db.prepare(
    "INSERT INTO cards (polish_word, english_word, pronunciation) VALUES (?, ?, ?)"
  ).run(word, `${word}_en`, `${word}_pron`);
  return Number(result.lastInsertRowid);
}

function insertReview(
  db: ReturnType<typeof createTestDb>,
  cardId: number,
  opts: {
    nextReview?: string;
    firstReviewedAt?: string | null;
    lastReviewed?: string | null;
    repetitions?: number;
  } = {}
) {
  db.prepare(`
    INSERT INTO reviews (card_id, next_review, first_reviewed_at, last_reviewed, repetitions)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    cardId,
    opts.nextReview ?? new Date().toISOString().replace("T", " ").replace("Z", ""),
    opts.firstReviewedAt ?? null,
    opts.lastReviewed ?? null,
    opts.repetitions ?? 0
  );
}

// Replicates the GET handler's query logic
function getNextCard(db: ReturnType<typeof createTestDb>) {
  const newCardsPerDay = Number(
    (db.prepare("SELECT value FROM settings WHERE key = 'new_cards_per_day'").get() as { value: string })?.value ?? "20"
  );

  const newCardsToday = (db.prepare(
    "SELECT COUNT(*) as count FROM reviews WHERE DATE(first_reviewed_at) = DATE('now')"
  ).get() as { count: number }).count;

  const dueReviewedCount = (db.prepare(
    "SELECT COUNT(*) as count FROM reviews WHERE first_reviewed_at IS NOT NULL AND datetime(replace(replace(next_review,'T',' '),'Z','')) <= datetime('now')"
  ).get() as { count: number }).count;

  const availableNewCards = (db.prepare(
    "SELECT COUNT(*) as count FROM reviews WHERE first_reviewed_at IS NULL"
  ).get() as { count: number }).count;

  const newCardsRemaining = Math.max(0, newCardsPerDay - newCardsToday);
  const newCardsDueToday = Math.min(newCardsRemaining, availableNewCards);
  const dueCount = dueReviewedCount + newCardsDueToday;

  // Phase 1: due reviewed cards
  const dueReviewedCard = db.prepare(`
    SELECT c.*, r.ease_factor, r.interval, r.repetitions, r.next_review
    FROM cards c JOIN reviews r ON r.card_id = c.id
    WHERE r.first_reviewed_at IS NOT NULL AND datetime(replace(replace(r.next_review,'T',' '),'Z','')) <= datetime('now')
    ORDER BY datetime(replace(replace(r.next_review,'T',' '),'Z','')) ASC
    LIMIT 1
  `).get() as { id: number; polish_word: string } | undefined;

  if (dueReviewedCard) return { card: dueReviewedCard, dueCount, phase: "due" as const };

  // Phase 2: new cards
  if (newCardsRemaining > 0) {
    const newCard = db.prepare(`
      SELECT c.*, r.ease_factor, r.interval, r.repetitions, r.next_review
      FROM cards c JOIN reviews r ON r.card_id = c.id
      WHERE r.first_reviewed_at IS NULL
      ORDER BY c.id ASC
      LIMIT 1
    `).get() as { id: number; polish_word: string } | undefined;

    if (newCard) return { card: newCard, dueCount, phase: "new" as const };
  }

  // Phase 3: continue beyond session
  const nextFutureCard = db.prepare(`
    SELECT c.*, r.ease_factor, r.interval, r.repetitions, r.next_review
    FROM cards c JOIN reviews r ON r.card_id = c.id
    WHERE r.first_reviewed_at IS NOT NULL
    ORDER BY datetime(replace(replace(r.next_review,'T',' '),'Z','')) ASC
    LIMIT 1
  `).get() as { id: number; polish_word: string } | undefined;

  if (nextFutureCard) return { card: nextFutureCard, dueCount: 0, phase: "continue" as const };

  return { card: null, dueCount: 0, phase: "empty" as const };
}

describe("review session logic", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("phase 1: due reviewed cards served first", () => {
    it("returns a due reviewed card before a new card", () => {
      const dueId = insertCard(db, "stary");
      const newId = insertCard(db, "nowy");
      // "stary" was reviewed before, is due now
      insertReview(db, dueId, {
        nextReview: "2020-01-01 00:00:00",
        firstReviewedAt: "2020-01-01 00:00:00",
        lastReviewed: "2020-01-01 00:00:00",
        repetitions: 1,
      });
      // "nowy" has never been reviewed
      insertReview(db, newId);

      const result = getNextCard(db);
      expect(result.phase).toBe("due");
      expect(result.card?.polish_word).toBe("stary");
    });

    it("counts multiple due reviewed cards in dueCount", () => {
      for (const word of ["a", "b", "c"]) {
        const id = insertCard(db, word);
        insertReview(db, id, {
          nextReview: "2020-01-01 00:00:00",
          firstReviewedAt: "2020-01-01 00:00:00",
          repetitions: 1,
        });
      }
      const result = getNextCard(db);
      expect(result.dueCount).toBe(3);
    });

    it("treats ISO next_review on same day as due", () => {
      const dueId = insertCard(db, "iso");
      const pastIso = new Date(Date.now() - 60 * 1000)
        .toISOString();
      insertReview(db, dueId, {
        nextReview: pastIso,
        firstReviewedAt: "2025-01-01 00:00:00",
        repetitions: 1,
      });

      const result = getNextCard(db);
      expect(result.phase).toBe("due");
      expect(result.dueCount).toBe(1);
      expect(result.card?.polish_word).toBe("iso");
    });
  });

  describe("phase 2: new cards after due cards exhausted", () => {
    it("serves new cards when no due reviewed cards exist", () => {
      const id = insertCard(db, "nowy");
      insertReview(db, id); // first_reviewed_at = NULL → new card

      const result = getNextCard(db);
      expect(result.phase).toBe("new");
      expect(result.card?.polish_word).toBe("nowy");
    });

    it("serves new cards in card id order", () => {
      const id1 = insertCard(db, "pierwszy");
      const id2 = insertCard(db, "drugi");
      insertReview(db, id1);
      insertReview(db, id2);

      const result = getNextCard(db);
      expect(result.card?.polish_word).toBe("pierwszy");
    });

    it("respects new_cards_per_day limit", () => {
      // Set limit to 2
      db.prepare("UPDATE settings SET value = '2' WHERE key = 'new_cards_per_day'").run();

      // Create 3 new cards
      for (const word of ["a", "b", "c"]) {
        const id = insertCard(db, word);
        insertReview(db, id);
      }

      // Simulate 2 cards already introduced today
      const reviewed1 = insertCard(db, "already1");
      insertReview(db, reviewed1, {
        firstReviewedAt: new Date().toISOString().replace("T", " ").replace("Z", ""),
        nextReview: "2099-01-01 00:00:00", // far future, not due
        repetitions: 1,
      });
      const reviewed2 = insertCard(db, "already2");
      insertReview(db, reviewed2, {
        firstReviewedAt: new Date().toISOString().replace("T", " ").replace("Z", ""),
        nextReview: "2099-01-01 00:00:00",
        repetitions: 1,
      });

      const result = getNextCard(db);
      // 2 already introduced today, limit is 2, so no new cards allowed
      expect(result.dueCount).toBe(0);
      // Should fall through to phase 3 (continue), not phase 2 (new)
      expect(result.phase).not.toBe("new");
    });
  });

  describe("phase 3: continue beyond session", () => {
    it("returns next future card when session is done", () => {
      // One reviewed card, due far in the future
      const id = insertCard(db, "przyszly");
      insertReview(db, id, {
        nextReview: "2099-06-01 00:00:00",
        firstReviewedAt: "2025-01-01 00:00:00",
        repetitions: 2,
      });

      const result = getNextCard(db);
      expect(result.phase).toBe("continue");
      expect(result.dueCount).toBe(0);
      expect(result.card?.polish_word).toBe("przyszly");
    });

    it("picks the soonest future card", () => {
      const farId = insertCard(db, "daleki");
      insertReview(db, farId, {
        nextReview: "2099-12-01 00:00:00",
        firstReviewedAt: "2025-01-01 00:00:00",
        repetitions: 1,
      });
      const soonId = insertCard(db, "bliski");
      insertReview(db, soonId, {
        nextReview: "2099-01-01 00:00:00",
        firstReviewedAt: "2025-01-01 00:00:00",
        repetitions: 1,
      });

      const result = getNextCard(db);
      expect(result.card?.polish_word).toBe("bliski");
    });

    it("returns null when no cards exist at all", () => {
      const result = getNextCard(db);
      expect(result.phase).toBe("empty");
      expect(result.card).toBeNull();
    });

    it("does not serve new cards when daily limit is 0", () => {
      db.prepare("UPDATE settings SET value = '0' WHERE key = 'new_cards_per_day'").run();

      const newId = insertCard(db, "nowy");
      insertReview(db, newId); // first_reviewed_at = NULL

      const reviewedId = insertCard(db, "przyszly");
      insertReview(db, reviewedId, {
        nextReview: "2099-06-01 00:00:00",
        firstReviewedAt: "2025-01-01 00:00:00",
        repetitions: 2,
      });

      const result = getNextCard(db);
      expect(result.phase).toBe("continue");
      expect(result.card?.polish_word).toBe("przyszly");
    });
  });

  describe("dueCount calculation", () => {
    it("sums due reviewed cards and available new cards", () => {
      // 2 due reviewed cards
      for (const word of ["due1", "due2"]) {
        const id = insertCard(db, word);
        insertReview(db, id, {
          nextReview: "2020-01-01 00:00:00",
          firstReviewedAt: "2020-01-01 00:00:00",
          repetitions: 1,
        });
      }
      // 3 new cards
      for (const word of ["new1", "new2", "new3"]) {
        const id = insertCard(db, word);
        insertReview(db, id);
      }

      const result = getNextCard(db);
      expect(result.dueCount).toBe(5); // 2 due + 3 new
    });

    it("is 0 when only future cards exist", () => {
      const id = insertCard(db, "future");
      insertReview(db, id, {
        nextReview: "2099-01-01 00:00:00",
        firstReviewedAt: "2025-01-01 00:00:00",
        repetitions: 1,
      });

      const result = getNextCard(db);
      expect(result.dueCount).toBe(0);
    });
  });
});

describe("backfill migration", () => {
  it("sets first_reviewed_at from last_reviewed for pre-migration cards", () => {
    const db = createTestDb();
    const id = insertCard(db, "stary");
    // Simulate a pre-migration card: has last_reviewed and repetitions but no first_reviewed_at
    db.prepare(`
      INSERT INTO reviews (card_id, last_reviewed, repetitions, next_review, first_reviewed_at)
      VALUES (?, '2025-01-15 10:00:00', 3, '2025-02-15 10:00:00', NULL)
    `).run(id);

    // Run the backfill
    db.exec(`
      UPDATE reviews
      SET first_reviewed_at = COALESCE(last_reviewed, next_review)
      WHERE first_reviewed_at IS NULL
        AND (last_reviewed IS NOT NULL OR repetitions > 0)
    `);

    const review = db.prepare("SELECT first_reviewed_at FROM reviews WHERE card_id = ?").get(id) as { first_reviewed_at: string };
    expect(review.first_reviewed_at).toBe("2025-01-15 10:00:00");
  });

  it("falls back to next_review when last_reviewed is null", () => {
    const db = createTestDb();
    const id = insertCard(db, "dziwny");
    // Has repetitions > 0 but no last_reviewed (edge case)
    db.prepare(`
      INSERT INTO reviews (card_id, last_reviewed, repetitions, next_review, first_reviewed_at)
      VALUES (?, NULL, 1, '2025-03-01 10:00:00', NULL)
    `).run(id);

    db.exec(`
      UPDATE reviews
      SET first_reviewed_at = COALESCE(last_reviewed, next_review)
      WHERE first_reviewed_at IS NULL
        AND (last_reviewed IS NOT NULL OR repetitions > 0)
    `);

    const review = db.prepare("SELECT first_reviewed_at FROM reviews WHERE card_id = ?").get(id) as { first_reviewed_at: string };
    expect(review.first_reviewed_at).toBe("2025-03-01 10:00:00");
  });

  it("does not touch genuinely new cards", () => {
    const db = createTestDb();
    const id = insertCard(db, "nowy");
    // Genuinely new: no last_reviewed, repetitions = 0
    db.prepare(`
      INSERT INTO reviews (card_id, last_reviewed, repetitions, first_reviewed_at)
      VALUES (?, NULL, 0, NULL)
    `).run(id);

    db.exec(`
      UPDATE reviews
      SET first_reviewed_at = COALESCE(last_reviewed, next_review)
      WHERE first_reviewed_at IS NULL
        AND (last_reviewed IS NOT NULL OR repetitions > 0)
    `);

    const review = db.prepare("SELECT first_reviewed_at FROM reviews WHERE card_id = ?").get(id) as { first_reviewed_at: string | null };
    expect(review.first_reviewed_at).toBeNull();
  });
});

describe("datetime format", () => {
  it("stored next_review without T or Z compares correctly with datetime('now')", () => {
    const db = createTestDb();
    const id = insertCard(db, "test");

    // Store in the correct format (no T, no Z)
    const pastDate = "2020-01-01 12:00:00.000";
    db.prepare(`
      INSERT INTO reviews (card_id, next_review, first_reviewed_at, repetitions)
      VALUES (?, ?, '2020-01-01 00:00:00', 1)
    `).run(id, pastDate);

    // This query should find it as due
    const count = (db.prepare(
      "SELECT COUNT(*) as count FROM reviews WHERE next_review <= datetime('now')"
    ).get() as { count: number }).count;

    expect(count).toBe(1);
  });

  it("ISO format with T and Z also compares correctly for past dates", () => {
    // This test documents that for dates far in the past, both formats work.
    // The bug manifests for same-day comparisons where "T" sorts differently.
    const db = createTestDb();
    const id = insertCard(db, "test");

    const isoDate = "2020-01-01T12:00:00.000Z";
    db.prepare(`
      INSERT INTO reviews (card_id, next_review, first_reviewed_at, repetitions)
      VALUES (?, ?, '2020-01-01 00:00:00', 1)
    `).run(id, isoDate);

    const count = (db.prepare(
      "SELECT COUNT(*) as count FROM reviews WHERE next_review <= datetime('now')"
    ).get() as { count: number }).count;

    // ISO format still works for far-past dates, but the space format is
    // more reliable for same-day edge cases
    expect(count).toBe(1);
  });

  it("normalized format matches datetime() output format", () => {
    const now = new Date();
    const normalized = now.toISOString().replace("T", " ").replace("Z", "");
    // Should look like "2026-02-05 14:30:00.000"
    expect(normalized).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });
});
