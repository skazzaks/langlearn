import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sm2 } from "@/lib/sm2";

interface ReviewRow {
  id: number;
  card_id: number;
  ease_factor: number;
  interval: number;
  repetitions: number;
  review_count: number;
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
  review_count: number;
  next_review: string;
  last_reviewed: string | null;
  first_reviewed_at: string | null;
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

function normalizeNextReview(nextReview: string): number | null {
  if (!nextReview) return null;
  const cleaned = nextReview.replace("T", " ").replace("Z", "");
  const iso = cleaned.includes(" ")
    ? `${cleaned.replace(" ", "T")}Z`
    : `${cleaned}Z`;
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? null : ts;
}

function computeIsDue(nextReview: string): boolean {
  const ts = normalizeNextReview(nextReview);
  if (ts === null) return false;
  return ts <= Date.now();
}

export async function GET() {
  // Get settings
  const newCardsPerDay = Number(
    (db.prepare("SELECT value FROM settings WHERE key = 'new_cards_per_day'").get() as { value: string } | undefined)?.value ?? "20"
  );

  // Check for bonus cards added today
  const bonusDate = (db.prepare("SELECT value FROM settings WHERE key = 'vocab_bonus_cards_date'").get() as { value: string } | undefined)?.value;
  const todayStr = new Date().toISOString().split("T")[0];
  const bonusCards = bonusDate === todayStr
    ? Number((db.prepare("SELECT value FROM settings WHERE key = 'vocab_bonus_cards_count'").get() as { value: string } | undefined)?.value ?? "0")
    : 0;

  // Effective daily limit = base + bonus
  const effectiveLimit = newCardsPerDay + bonusCards;

  // Count new cards introduced today (first_reviewed_at is today)
  const newCardsToday = (db.prepare(
    "SELECT COUNT(*) as count FROM reviews WHERE DATE(first_reviewed_at) = DATE('now')"
  ).get() as { count: number }).count;

  // Count due reviewed cards (cards that have been seen before and are due)
  const dueReviewedCount = (db.prepare(
    "SELECT COUNT(*) as count FROM reviews WHERE first_reviewed_at IS NOT NULL AND datetime(replace(replace(next_review,'T',' '),'Z','')) <= datetime('now')"
  ).get() as { count: number }).count;

  // Count available new cards (never reviewed)
  const availableNewCards = (db.prepare(
    "SELECT COUNT(*) as count FROM reviews WHERE first_reviewed_at IS NULL"
  ).get() as { count: number }).count;

  // Calculate how many new cards we can still show today
  const newCardsRemaining = Math.max(0, effectiveLimit - newCardsToday);
  const newCardsDueToday = Math.min(newCardsRemaining, availableNewCards);

  // Total due = reviewed cards due + new cards allowed today
  const dueCount = dueReviewedCount + newCardsDueToday;

  // First, try to get a due reviewed card (priority to cards user has seen before)
  const dueReviewedCard = db.prepare(`
    SELECT c.*, r.ease_factor, r.interval, r.repetitions, r.review_count, r.next_review, r.last_reviewed, r.first_reviewed_at
    FROM cards c
    JOIN reviews r ON r.card_id = c.id
    WHERE r.first_reviewed_at IS NOT NULL AND datetime(replace(replace(r.next_review,'T',' '),'Z','')) <= datetime('now')
    ORDER BY datetime(replace(replace(r.next_review,'T',' '),'Z','')) ASC, RANDOM()
    LIMIT 1
  `).get() as CardRow | undefined;

  if (dueReviewedCard) {
    const isDue = computeIsDue(dueReviewedCard.next_review);
    const card = { ...getCardWithSentences(dueReviewedCard), is_due: isDue, is_new: false };
    return NextResponse.json({ card, stats: { dueCount: Math.max(dueCount, isDue ? 1 : 0), newCardsDue: newCardsDueToday, reviewCardsDue: Math.max(dueReviewedCount, isDue ? 1 : 0), availableNewCards, newCardsPerDay } });
  }

  // If no reviewed cards due, show a new card (if we haven't hit the daily limit)
  if (newCardsRemaining > 0) {
    const newCard = db.prepare(`
      SELECT c.*, r.ease_factor, r.interval, r.repetitions, r.review_count, r.next_review, r.last_reviewed, r.first_reviewed_at
      FROM cards c
      JOIN reviews r ON r.card_id = c.id
      WHERE r.first_reviewed_at IS NULL
      ORDER BY COALESCE(r.priority, 0) DESC, c.id ASC
      LIMIT 1
    `).get() as CardRow | undefined;

    if (newCard) {
      const isDue = computeIsDue(newCard.next_review);
      const card = { ...getCardWithSentences(newCard), is_due: isDue, is_new: true };
      return NextResponse.json({ card, stats: { dueCount: Math.max(dueCount, 1), newCardsDue: Math.max(newCardsDueToday, 1), reviewCardsDue: dueReviewedCount, availableNewCards, newCardsPerDay } });
    }
  }

  // Phase 3: Continue beyond session — fall back to next future reviewed card
  const nextFutureCard = db.prepare(`
    SELECT c.*, r.ease_factor, r.interval, r.repetitions, r.review_count, r.next_review, r.last_reviewed, r.first_reviewed_at
    FROM cards c
    JOIN reviews r ON r.card_id = c.id
    WHERE r.first_reviewed_at IS NOT NULL
    ORDER BY datetime(replace(replace(r.next_review,'T',' '),'Z','')) ASC
    LIMIT 1
  `).get() as CardRow | undefined;

  if (nextFutureCard) {
    const isDue = computeIsDue(nextFutureCard.next_review);
    const card = { ...getCardWithSentences(nextFutureCard), is_due: isDue, is_new: false };
    const adjustedDueCount = isDue ? 1 : 0;
    return NextResponse.json({ card, stats: { dueCount: adjustedDueCount, newCardsDue: 0, reviewCardsDue: isDue ? 1 : 0, availableNewCards, newCardsPerDay } });
  }

  return NextResponse.json({ card: null, stats: { dueCount: 0, newCardsDue: 0, reviewCardsDue: 0, availableNewCards, newCardsPerDay } });
}

interface ReviewRowWithFirst extends ReviewRow {
  first_reviewed_at: string | null;
}

export async function POST(request: NextRequest) {
  const { cardId, quality } = await request.json();

  const review = db.prepare("SELECT * FROM reviews WHERE card_id = ?").get(cardId) as ReviewRowWithFirst | undefined;
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

  const nextReviewStr = result.nextReview.toISOString().replace('T', ' ').replace('Z', '');

  // Set first_reviewed_at if this is the first review
  if (review.first_reviewed_at === null) {
    db.prepare(`
      UPDATE reviews
      SET ease_factor = ?, interval = ?, repetitions = ?, review_count = COALESCE(review_count, 0) + 1, next_review = ?, last_reviewed = datetime('now'), first_reviewed_at = datetime('now')
      WHERE card_id = ?
    `).run(result.easeFactor, result.interval, result.repetitions, nextReviewStr, cardId);
  } else {
    db.prepare(`
      UPDATE reviews
      SET ease_factor = ?, interval = ?, repetitions = ?, review_count = COALESCE(review_count, 0) + 1, next_review = ?, last_reviewed = datetime('now')
      WHERE card_id = ?
    `).run(result.easeFactor, result.interval, result.repetitions, nextReviewStr, cardId);
  }

  return NextResponse.json({ success: true, nextReview: result.nextReview });
}
