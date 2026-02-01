import db from "./db";
import { generateAudio, generateSentenceAudio } from "./tts";
import seedWords from "../../seed-words.json";

interface SeedWord {
  polish_word: string;
  english_word: string;
  pronunciation: string;
  example_sentence_pl: string;
  example_sentence_en: string;
}

const insertCard = db.prepare(`
  INSERT OR IGNORE INTO cards (polish_word, english_word, pronunciation, example_sentence_pl, example_sentence_en, audio_path, sentence_audio_path)
  VALUES (@polish_word, @english_word, @pronunciation, @example_sentence_pl, @example_sentence_en, @audio_path, @sentence_audio_path)
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
    const audioPath = await generateAudio(word.polish_word, word.example_sentence_pl);
    const sentenceAudioPath = await generateSentenceAudio(word.example_sentence_pl);
    const result = insertCard.run({ ...word, audio_path: audioPath, sentence_audio_path: sentenceAudioPath });
    if (result.changes > 0) {
      insertReview.run(result.lastInsertRowid);
      inserted++;
    }
  }

  const total = (db.prepare("SELECT COUNT(*) as count FROM cards").get() as { count: number }).count;
  insertLog.run(batchNumber, total);

  return { inserted, total };
}
