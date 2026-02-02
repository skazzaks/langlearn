import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sm2 } from "@/lib/sm2";

interface ReviewRow {
  id: number;
  card_id: number;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
  last_reviewed: string | null;
}

interface CardRow {
  id: number;
  polish_word: string;
  english_word: string;
  pronunciation: string;
  notes: string | null;
  audio_path: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
}

interface SentenceRow {
  id: number;
  difficulty: string;
  sentence_pl: string;
  sentence_en: string;
  audio_path: string | null;
}

function getCardWithSentences(card: CardRow) {
  const sentences = db.prepare(
    "SELECT id, difficulty, sentence_pl, sentence_en, audio_path FROM card_sentences WHERE card_id = ? ORDER BY CASE difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END"
  ).all(card.id) as SentenceRow[];
  return { ...card, sentences };
}

export async function GET() {
  const dueCard = db.prepare(`
    SELECT c.*, r.ease_factor, r.interval, r.repetitions, r.next_review
    FROM cards c
    JOIN reviews r ON r.card_id = c.id
    WHERE r.next_review <= datetime('now')
    ORDER BY r.next_review ASC, RANDOM()
    LIMIT 1
  `).get() as CardRow | undefined;

  if (dueCard) {
    return NextResponse.json(getCardWithSentences(dueCard));
  }

  const randomCard = db.prepare(`
    SELECT c.*, r.ease_factor, r.interval, r.repetitions, r.next_review
    FROM cards c
    JOIN reviews r ON r.card_id = c.id
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as CardRow | undefined;

  if (!randomCard) {
    return NextResponse.json(null);
  }

  return NextResponse.json(getCardWithSentences(randomCard));
}

export async function POST(request: NextRequest) {
  const { cardId, quality } = await request.json();

  const review = db.prepare("SELECT * FROM reviews WHERE card_id = ?").get(cardId) as ReviewRow | undefined;
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const result = sm2(
    {
      easeFactor: review.ease_factor,
      interval: review.interval,
      repetitions: review.repetitions,
    },
    quality
  );

  db.prepare(`
    UPDATE reviews
    SET ease_factor = ?, interval = ?, repetitions = ?, next_review = ?, last_reviewed = datetime('now')
    WHERE card_id = ?
  `).run(result.easeFactor, result.interval, result.repetitions, result.nextReview.toISOString(), cardId);

  return NextResponse.json({ success: true, nextReview: result.nextReview });
}
