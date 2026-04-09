import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generateCardContent } from "@/lib/generate-cards";
import { generateAudio } from "@/lib/tts";

const insertCard = db.prepare(`
  INSERT OR IGNORE INTO cards (polish_word, english_word, pronunciation, notes, audio_path)
  VALUES (@polish_word, @english_word, @pronunciation, @notes, @audio_path)
`);

const insertSentence = db.prepare(`
  INSERT INTO card_sentences (card_id, difficulty, sentence_pl, sentence_en)
  VALUES (@card_id, @difficulty, @sentence_pl, @sentence_en)
`);

const insertReview = db.prepare(`
  INSERT OR IGNORE INTO reviews (card_id, priority) VALUES (?, 1)
`);

export async function POST(request: NextRequest) {
  const { polishWord } = await request.json();

  if (!polishWord || typeof polishWord !== "string") {
    return NextResponse.json({ error: "Missing polishWord" }, { status: 400 });
  }

  const trimmedWord = polishWord.trim().toLowerCase();

  // Check if card already exists
  const existingCard = db.prepare(
    "SELECT id FROM cards WHERE LOWER(polish_word) = ?"
  ).get(trimmedWord) as { id: number } | undefined;

  if (existingCard) {
    // Check if it's still a new card (not yet reviewed)
    const review = db.prepare(
      "SELECT first_reviewed_at FROM reviews WHERE card_id = ?"
    ).get(existingCard.id) as { first_reviewed_at: string | null } | undefined;

    if (review && review.first_reviewed_at === null) {
      // Set priority so this card shows up first
      db.prepare("UPDATE reviews SET priority = 1 WHERE card_id = ?").run(existingCard.id);

      // Bump bonus quota so this new card can be seen today
      const todayStr = new Date().toISOString().split("T")[0];
      const bonusDate = (db.prepare("SELECT value FROM settings WHERE key = 'vocab_bonus_cards_date'").get() as { value: string } | undefined)?.value;

      if (bonusDate === todayStr) {
        const currentBonus = Number(
          (db.prepare("SELECT value FROM settings WHERE key = 'vocab_bonus_cards_count'").get() as { value: string } | undefined)?.value ?? "0"
        );
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("vocab_bonus_cards_count", String(currentBonus + 1));
      } else {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("vocab_bonus_cards_date", todayStr);
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("vocab_bonus_cards_count", "1");
      }

      return NextResponse.json({
        success: true,
        exists: true,
        cardId: existingCard.id,
        message: "Card exists, added to today's queue"
      });
    }

    return NextResponse.json({
      error: "Card already exists and has been reviewed",
      exists: true,
      cardId: existingCard.id
    }, { status: 409 });
  }

  try {
    // Generate card content
    const cardData = await generateCardContent(trimmedWord);

    // Generate audio
    const audioPath = await generateAudio(trimmedWord);

    // Insert card
    const result = insertCard.run({
      polish_word: cardData.polish_word,
      english_word: cardData.english_word,
      pronunciation: cardData.pronunciation,
      notes: cardData.notes,
      audio_path: audioPath,
    });

    if (result.changes === 0) {
      return NextResponse.json({ error: "Failed to insert card" }, { status: 500 });
    }

    const cardId = result.lastInsertRowid as number;

    // Insert sentences
    for (const s of cardData.sentences) {
      insertSentence.run({
        card_id: cardId,
        difficulty: s.difficulty,
        sentence_pl: s.sentence_pl,
        sentence_en: s.sentence_en,
      });
    }

    // Create review entry
    insertReview.run(cardId);

    // Mark as generated in word_queue if it exists there
    const queueEntry = db.prepare(
      "SELECT id FROM word_queue WHERE LOWER(polish_word) = ?"
    ).get(trimmedWord) as { id: number } | undefined;

    if (queueEntry) {
      db.prepare(
        "UPDATE word_queue SET status = 'generated', generated_at = datetime('now'), card_id = ? WHERE id = ?"
      ).run(cardId, queueEntry.id);
    }

    // Add 1 to today's bonus cards so this card shows up immediately
    const todayStr = new Date().toISOString().split("T")[0];
    const bonusDate = (db.prepare("SELECT value FROM settings WHERE key = 'vocab_bonus_cards_date'").get() as { value: string } | undefined)?.value;

    if (bonusDate === todayStr) {
      // Add to existing bonus
      const currentBonus = Number(
        (db.prepare("SELECT value FROM settings WHERE key = 'vocab_bonus_cards_count'").get() as { value: string } | undefined)?.value ?? "0"
      );
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("vocab_bonus_cards_count", String(currentBonus + 1));
    } else {
      // New day, set bonus to 1
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("vocab_bonus_cards_date", todayStr);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("vocab_bonus_cards_count", "1");
    }

    return NextResponse.json({
      success: true,
      cardId,
      card: {
        polish_word: cardData.polish_word,
        english_word: cardData.english_word,
      }
    });
  } catch (err) {
    console.error("Failed to generate card:", err);
    return NextResponse.json({
      error: `Failed to generate: ${(err as Error).message}`
    }, { status: 500 });
  }
}
