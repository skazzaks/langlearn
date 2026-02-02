import Anthropic from "@anthropic-ai/sdk";
import db from "./db";
import { generateAudio } from "./tts";

interface GeneratedWord {
  polish_word: string;
  english_word: string;
  pronunciation: string;
  notes: string;
  sentences: {
    difficulty: "easy" | "medium" | "hard";
    sentence_pl: string;
    sentence_en: string;
  }[];
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
  INSERT OR IGNORE INTO reviews (card_id) VALUES (?)
`);

const updateQueueStatus = db.prepare(`
  UPDATE word_queue SET status = 'generated', generated_at = datetime('now'), card_id = ?
  WHERE id = ?
`);

const insertLog = db.prepare(`
  INSERT INTO generation_log (batch_number, total_generated) VALUES (?, ?)
`);

function sentenceContainsWord(sentence: string, word: string): boolean {
  // Case-insensitive check that the word appears as a whole word
  const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "iu");
  return regex.test(sentence);
}

async function validateAndFixSentences(
  client: Anthropic,
  polishWord: string,
  sentences: GeneratedWord["sentences"],
): Promise<GeneratedWord["sentences"]> {
  const maxRetries = 2;
  const result = [...sentences];

  for (let i = 0; i < result.length; i++) {
    let attempts = 0;
    while (!sentenceContainsWord(result[i].sentence_pl, polishWord) && attempts < maxRetries) {
      attempts++;
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `The Polish sentence "${result[i].sentence_pl}" was supposed to contain the exact word "${polishWord}" but it does not, or it is grammatically incorrect.

Generate a replacement ${result[i].difficulty}-difficulty Polish sentence that:
1. Contains the exact word "${polishWord}" (this exact form, not a different case/conjugation)
2. Is grammatically correct Polish
3. Has a natural, correct English translation

Return ONLY valid JSON (no markdown fences):
{ "sentence_pl": "...", "sentence_en": "..." }`,
          },
        ],
      });
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      const fixed = JSON.parse(text) as { sentence_pl: string; sentence_en: string };
      result[i] = { ...result[i], ...fixed };
    }

    // Grammar check — ask Claude to verify even if the word is present
    if (sentenceContainsWord(result[i].sentence_pl, polishWord) && attempts === 0) {
      const checkMsg = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `Is this Polish sentence grammatically correct? "${result[i].sentence_pl}" (meaning: "${result[i].sentence_en}")

If correct, respond with ONLY: {"correct": true}
If incorrect, respond with ONLY valid JSON (no markdown fences): {"correct": false, "sentence_pl": "corrected sentence", "sentence_en": "corrected translation"}

The sentence MUST still contain the exact word "${polishWord}".`,
          },
        ],
      });
      const text = checkMsg.content[0].type === "text" ? checkMsg.content[0].text : "";
      const check = JSON.parse(text) as { correct: boolean; sentence_pl?: string; sentence_en?: string };
      if (!check.correct && check.sentence_pl && sentenceContainsWord(check.sentence_pl, polishWord)) {
        result[i] = { ...result[i], sentence_pl: check.sentence_pl, sentence_en: check.sentence_en! };
      }
    }
  }

  return result;
}

export async function generateCardContent(polishWord: string): Promise<GeneratedWord> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Generate a Polish language flashcard for the word "${polishWord}". Each sentence MUST contain the exact word "${polishWord}" in that exact form. Return ONLY valid JSON (no markdown fences) in this exact format:
{
  "polish_word": "${polishWord}",
  "english_word": "English translation(s)",
  "pronunciation": "approximate English phonetic pronunciation",
  "notes": "Brief grammar/usage notes for an English speaker learning Polish",
  "sentences": [
    { "difficulty": "easy", "sentence_pl": "Simple Polish sentence that contains '${polishWord}'", "sentence_en": "English translation" },
    { "difficulty": "medium", "sentence_pl": "Intermediate Polish sentence that contains '${polishWord}'", "sentence_en": "English translation" },
    { "difficulty": "hard", "sentence_pl": "Advanced Polish sentence that contains '${polishWord}'", "sentence_en": "English translation" }
  ]
}

IMPORTANT: Every sentence_pl MUST contain the exact word "${polishWord}" and be grammatically correct Polish.
Keep pronunciation as an English phonetic approximation (e.g. "tahk" for "tak"). Notes should mention grammar, cases, or common usage patterns relevant to this word.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const card = JSON.parse(text) as GeneratedWord;

  card.sentences = await validateAndFixSentences(client, polishWord, card.sentences);

  return card;
}

export async function generateCards(count: number): Promise<{
  generated: number;
  errors: string[];
}> {
  const cap = Math.min(count, 100);

  const queuedWords = db
    .prepare(
      "SELECT id, polish_word FROM word_queue WHERE status = 'queued' ORDER BY frequency_rank ASC LIMIT ?"
    )
    .all(cap) as { id: number; polish_word: string }[];

  if (queuedWords.length === 0) {
    return { generated: 0, errors: ["No queued words available"] };
  }

  const lastBatch = db
    .prepare("SELECT MAX(batch_number) as n FROM generation_log")
    .get() as { n: number | null };
  const batchNumber = (lastBatch?.n ?? 0) + 1;

  let generated = 0;
  const errors: string[] = [];

  for (const qw of queuedWords) {
    try {
      const cardData = await generateCardContent(qw.polish_word);
      const audioPath = await generateAudio(qw.polish_word);

      const result = insertCard.run({
        polish_word: cardData.polish_word,
        english_word: cardData.english_word,
        pronunciation: cardData.pronunciation,
        notes: cardData.notes,
        audio_path: audioPath,
      });

      if (result.changes > 0) {
        const cardId = result.lastInsertRowid;
        for (const s of cardData.sentences) {
          insertSentence.run({
            card_id: cardId,
            difficulty: s.difficulty,
            sentence_pl: s.sentence_pl,
            sentence_en: s.sentence_en,
          });
        }
        insertReview.run(cardId);
        updateQueueStatus.run(cardId, qw.id);
        generated++;
      } else {
        // Card already existed (UNIQUE constraint on polish_word)
        updateQueueStatus.run(null, qw.id);
        generated++;
      }
    } catch (err) {
      errors.push(`${qw.polish_word}: ${(err as Error).message}`);
    }
  }

  insertLog.run(batchNumber, generated);
  return { generated, errors };
}

export function getQueueStats() {
  const total = (
    db.prepare("SELECT COUNT(*) as c FROM word_queue").get() as { c: number }
  ).c;
  const queued = (
    db
      .prepare("SELECT COUNT(*) as c FROM word_queue WHERE status = 'queued'")
      .get() as { c: number }
  ).c;
  const generated = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM word_queue WHERE status = 'generated'"
      )
      .get() as { c: number }
  ).c;
  const totalCards = (
    db.prepare("SELECT COUNT(*) as c FROM cards").get() as { c: number }
  ).c;
  return { total, queued, generated, totalCards };
}
