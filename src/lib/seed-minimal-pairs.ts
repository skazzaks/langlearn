import db from "./db";
import seedData from "../../seed-minimal-pairs.json";

interface SeedWord {
  polish_word: string;
  english_word: string;
  correct_sound: string;
}

interface SeedPair {
  sound_a: string;
  sound_b: string;
  description: string;
  words: SeedWord[];
}

const insertPair = db.prepare(`
  INSERT OR IGNORE INTO minimal_pairs (sound_a, sound_b, description)
  VALUES (@sound_a, @sound_b, @description)
`);

const insertWord = db.prepare(`
  INSERT INTO minimal_pair_words (pair_id, polish_word, english_word, correct_sound)
  VALUES (@pair_id, @polish_word, @english_word, @correct_sound)
`);

const insertReview = db.prepare(`
  INSERT OR IGNORE INTO minimal_pair_reviews (word_id)
  VALUES (?)
`);

export function seedMinimalPairs() {
  const existing = (
    db.prepare("SELECT COUNT(*) as count FROM minimal_pair_words").get() as { count: number }
  ).count;

  if (existing > 0) {
    return { inserted: 0, total: existing };
  }

  let inserted = 0;
  for (const pair of seedData as SeedPair[]) {
    const result = insertPair.run({
      sound_a: pair.sound_a,
      sound_b: pair.sound_b,
      description: pair.description,
    });

    const pairId = result.lastInsertRowid || (
      db.prepare("SELECT id FROM minimal_pairs WHERE sound_a = ? AND sound_b = ?")
        .get(pair.sound_a, pair.sound_b) as { id: number }
    ).id;

    for (const word of pair.words) {
      const wordResult = insertWord.run({
        pair_id: pairId,
        polish_word: word.polish_word,
        english_word: word.english_word,
        correct_sound: word.correct_sound,
      });
      insertReview.run(wordResult.lastInsertRowid);
      inserted++;
    }
  }

  const total = (
    db.prepare("SELECT COUNT(*) as count FROM minimal_pair_words").get() as { count: number }
  ).count;

  return { inserted, total };
}
