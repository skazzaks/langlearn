import db from "./db";
import { generateAudio } from "./tts";
import seedWords from "../../seed-words.json";

interface SeedSentence {
  difficulty: string;
  sentence_pl: string;
  sentence_en: string;
}

interface SeedWord {
  polish_word: string;
  english_word: string;
  pronunciation: string;
  notes: string;
  sentences: SeedSentence[];
}

const insertCard = db.prepare(`
  INSERT OR IGNORE INTO cards (polish_word, english_word, pronunciation, notes, audio_path)
  VALUES (@polish_word, @english_word, @pronunciation, @notes, @audio_path)
`);

const insertSentence = db.prepare(`
  INSERT INTO card_sentences (card_id, difficulty, sentence_pl, sentence_en)
  VALUES (@card_id, @difficulty, @sentence_pl, @sentence_en)
`);

const insertReview = db.prepare(`
  INSERT OR IGNORE INTO reviews (card_id)
  VALUES (?)
`);

const insertLog = db.prepare(`
  INSERT INTO generation_log (batch_number, total_generated)
  VALUES (?, ?)
`);

export async function seedCards() {
  const existing = (db.prepare("SELECT COUNT(*) as count FROM cards").get() as { count: number }).count;
  if (existing >= seedWords.length) {
    return { inserted: 0, total: existing };
  }

  const lastBatch = db.prepare("SELECT MAX(batch_number) as n FROM generation_log").get() as { n: number | null };
  const batchNumber = (lastBatch?.n ?? 0) + 1;

  let inserted = 0;
  for (const word of seedWords as SeedWord[]) {
    const audioPath = await generateAudio(word.polish_word);
    const result = insertCard.run({
      polish_word: word.polish_word,
      english_word: word.english_word,
      pronunciation: word.pronunciation,
      notes: word.notes,
      audio_path: audioPath,
    });
    if (result.changes > 0) {
      const cardId = result.lastInsertRowid;
      for (const s of word.sentences) {
        insertSentence.run({
          card_id: cardId,
          difficulty: s.difficulty,
          sentence_pl: s.sentence_pl,
          sentence_en: s.sentence_en,
        });
      }
      insertReview.run(cardId);
      inserted++;
    }
  }

  const total = (db.prepare("SELECT COUNT(*) as count FROM cards").get() as { count: number }).count;
  insertLog.run(batchNumber, total);

  return { inserted, total };
}
