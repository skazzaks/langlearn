import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sm2 } from "@/lib/sm2";

interface ReviewRow {
  word_id: number;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
  last_reviewed: string | null;
}

interface WordRow {
  id: number;
  pair_id: number;
  polish_word: string;
  english_word: string;
  correct_sound: string;
  audio_path: string | null;
  sound_a: string;
  sound_b: string;
  next_review: string;
}

export async function GET() {
  const dueWord = db.prepare(`
    SELECT w.*, p.sound_a, p.sound_b, r.next_review
    FROM minimal_pair_words w
    JOIN minimal_pairs p ON p.id = w.pair_id
    JOIN minimal_pair_reviews r ON r.word_id = w.id
    WHERE r.next_review <= datetime('now')
    ORDER BY r.next_review ASC, RANDOM()
    LIMIT 1
  `).get() as WordRow | undefined;

  if (dueWord) {
    return NextResponse.json(dueWord);
  }

  const randomWord = db.prepare(`
    SELECT w.*, p.sound_a, p.sound_b, r.next_review
    FROM minimal_pair_words w
    JOIN minimal_pairs p ON p.id = w.pair_id
    JOIN minimal_pair_reviews r ON r.word_id = w.id
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as WordRow | undefined;

  return NextResponse.json(randomWord || null);
}

export async function POST(request: NextRequest) {
  const { wordId, quality } = await request.json();

  const review = db.prepare(
    "SELECT * FROM minimal_pair_reviews WHERE word_id = ?"
  ).get(wordId) as ReviewRow | undefined;

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
    UPDATE minimal_pair_reviews
    SET ease_factor = ?, interval = ?, repetitions = ?, next_review = ?, last_reviewed = datetime('now')
    WHERE word_id = ?
  `).run(result.easeFactor, result.interval, result.repetitions, result.nextReview.toISOString(), wordId);

  return NextResponse.json({ success: true, nextReview: result.nextReview });
}
