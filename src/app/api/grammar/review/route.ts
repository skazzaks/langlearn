import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import db from "@/lib/db";
import { sm2 } from "@/lib/sm2";

const anthropic = new Anthropic();

const GENDERS = ["masc_pers", "masc_anim", "masc_inan", "fem", "neut"];

const GENDER_LABELS: Record<string, string> = {
  masc_pers: "masculine personal",
  masc_anim: "masculine animate",
  masc_inan: "masculine inanimate",
  fem: "feminine",
  neut: "neuter",
};

interface GrammarCardRow {
  id: number;
  case_name: string;
  usage: string;
  modifier: string;
  gender: string;
  number: string;
  display_title: string;
}

interface GrammarReviewRow {
  grammar_card_id: number;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
  last_reviewed: string | null;
  first_reviewed_at: string | null;
}

interface NounRow {
  polish_word: string;
  english_word: string;
  gender: string;
}

interface GeneratedSentence {
  english: string;
  correct_polish: string;
  highlighted_words: { word: string; base_form: string; ending: string }[];
  grammar_reminder: string;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function generateSentence(card: GrammarCardRow, resolvedGender: string): Promise<GeneratedSentence> {
  // Get noun pool
  const reviewedVocabCount = (db.prepare(
    "SELECT COUNT(*) as count FROM reviews WHERE first_reviewed_at IS NOT NULL"
  ).get() as { count: number }).count;

  let nouns: NounRow[];
  if (reviewedVocabCount >= 100) {
    // Use vocabulary cards — let Claude pick nouns of the right gender
    const vocabWords = db.prepare(
      "SELECT polish_word, english_word FROM cards"
    ).all() as { polish_word: string; english_word: string }[];
    nouns = vocabWords.map(w => ({ ...w, gender: resolvedGender }));
  } else {
    nouns = db.prepare(
      "SELECT polish_word, english_word, gender FROM grammar_nouns WHERE gender = ?"
    ).all(resolvedGender) as NounRow[];
  }

  const selectedNouns = pickRandom(nouns, 8);
  const nounList = selectedNouns.map(n => `${n.polish_word} (${n.english_word})`).join(", ");

  const genderLabel = GENDER_LABELS[resolvedGender] || resolvedGender;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `You are a Polish language teacher creating a grammar exercise.

TASK: Create an English sentence and its EXACT Polish translation that demonstrates this grammar pattern:
- Case: ${card.case_name}
- Usage: ${card.usage}
- Number: ${card.number}
- Gender: ${genderLabel}

Available nouns (pick one): ${nounList}

CRITICAL REQUIREMENTS:
1. The sentence must be something a REAL PERSON would actually say in everyday life
   - Good: "I'm going to the new store." / "She's talking about her old friend."
   - Bad: "The color of old meetings is pretty." / "I see the concept of big ideas."
2. The Polish sentence MUST mean EXACTLY the same thing as the English sentence
3. The Polish must be natural, grammatically correct Polish that a native speaker would say
4. The sentence must naturally require the ${card.case_name} case for the ${card.usage} usage
5. Include an adjective that agrees with the noun in case, number, and gender
6. Keep the sentence simple (A2-B1 level) - 5-10 words in Polish

Think of a realistic SITUATION first (shopping, talking to friends, describing your day, asking for directions, etc.), then write a sentence that fits that situation AND demonstrates the grammar pattern.

If the available nouns don't fit naturally, pick the one that works best and build a sensible sentence around it.

Return ONLY valid JSON: { "english": "...", "correct_polish": "...", "highlighted_words": [{ "word": "declined form", "base_form": "dictionary form", "ending": "case ending" }], "grammar_reminder": "1-sentence rule explanation" }`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  // Extract JSON - handle potential markdown wrapping
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse Claude response as JSON");
  }
  return JSON.parse(jsonMatch[0]) as GeneratedSentence;
}

export async function GET() {
  // Get settings
  const newCardsPerDay = Number(
    (db.prepare("SELECT value FROM settings WHERE key = 'grammar_new_cards_per_day'").get() as { value: string } | undefined)?.value ?? "5"
  );

  // Count new grammar cards introduced today
  const newCardsToday = (db.prepare(
    "SELECT COUNT(*) as count FROM grammar_reviews WHERE DATE(first_reviewed_at) = DATE('now')"
  ).get() as { count: number }).count;

  // Count due reviewed cards
  const dueReviewedCount = (db.prepare(
    "SELECT COUNT(*) as count FROM grammar_reviews WHERE first_reviewed_at IS NOT NULL AND next_review <= datetime('now')"
  ).get() as { count: number }).count;

  // Count available new cards
  const availableNewCards = (db.prepare(
    "SELECT COUNT(*) as count FROM grammar_reviews WHERE first_reviewed_at IS NULL"
  ).get() as { count: number }).count;

  const newCardsRemaining = Math.max(0, newCardsPerDay - newCardsToday);
  const newCardsDueToday = Math.min(newCardsRemaining, availableNewCards);
  const dueCount = dueReviewedCount + newCardsDueToday;

  // Phase 1: Due reviewed cards
  const dueReviewedCard = db.prepare(`
    SELECT gc.* FROM grammar_cards gc
    JOIN grammar_reviews gr ON gr.grammar_card_id = gc.id
    WHERE gr.first_reviewed_at IS NOT NULL AND gr.next_review <= datetime('now')
    ORDER BY gr.next_review ASC
    LIMIT 1
  `).get() as GrammarCardRow | undefined;

  let card = dueReviewedCard;

  // Phase 2: New cards
  if (!card && newCardsRemaining > 0) {
    card = db.prepare(`
      SELECT gc.* FROM grammar_cards gc
      JOIN grammar_reviews gr ON gr.grammar_card_id = gc.id
      WHERE gr.first_reviewed_at IS NULL
      ORDER BY gc.id ASC
      LIMIT 1
    `).get() as GrammarCardRow | undefined;
  }

  // Phase 3: Continue beyond session — prefer new cards, then future reviewed cards
  if (!card) {
    // First try unreviewed new cards (beyond daily limit)
    card = db.prepare(`
      SELECT gc.* FROM grammar_cards gc
      JOIN grammar_reviews gr ON gr.grammar_card_id = gc.id
      WHERE gr.first_reviewed_at IS NULL
      ORDER BY gc.id ASC
      LIMIT 1
    `).get() as GrammarCardRow | undefined;

    // If no new cards left, fall back to next future reviewed card
    if (!card) {
      card = db.prepare(`
        SELECT gc.* FROM grammar_cards gc
        JOIN grammar_reviews gr ON gr.grammar_card_id = gc.id
        WHERE gr.first_reviewed_at IS NOT NULL
        ORDER BY gr.next_review ASC
        LIMIT 1
      `).get() as GrammarCardRow | undefined;
    }

    if (!card) {
      return NextResponse.json({
        card: null,
        sentence: null,
        stats: { dueCount: 0, newCardsDue: 0, reviewCardsDue: 0 },
      });
    }

    // Generate sentence for beyond-session card
    const resolvedGender = card.gender === "all_genders"
      ? GENDERS[Math.floor(Math.random() * GENDERS.length)]
      : card.gender;

    try {
      const sentence = await generateSentence(card, resolvedGender);
      const displayTitle = card.gender === "all_genders"
        ? card.display_title.replace("All Genders", GENDER_LABELS[resolvedGender] || resolvedGender)
        : card.display_title;

      return NextResponse.json({
        card: { ...card, display_title: displayTitle, resolved_gender: resolvedGender },
        sentence,
        stats: { dueCount: 0, newCardsDue: 0, reviewCardsDue: 0 },
      });
    } catch (error) {
      console.error("Failed to generate sentence:", error);
      return NextResponse.json(
        { error: "Failed to generate sentence" },
        { status: 500 }
      );
    }
  }

  // Resolve gender for "all_genders" cards
  const resolvedGender = card.gender === "all_genders"
    ? GENDERS[Math.floor(Math.random() * GENDERS.length)]
    : card.gender;

  try {
    const sentence = await generateSentence(card, resolvedGender);
    const displayTitle = card.gender === "all_genders"
      ? card.display_title.replace("All Genders", GENDER_LABELS[resolvedGender] || resolvedGender)
      : card.display_title;

    return NextResponse.json({
      card: { ...card, display_title: displayTitle, resolved_gender: resolvedGender },
      sentence,
      stats: { dueCount, newCardsDue: newCardsDueToday, reviewCardsDue: dueReviewedCount },
    });
  } catch (error) {
    console.error("Failed to generate sentence:", error);
    return NextResponse.json(
      { error: "Failed to generate sentence" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { grammarCardId, quality } = await request.json();

  const review = db.prepare(
    "SELECT * FROM grammar_reviews WHERE grammar_card_id = ?"
  ).get(grammarCardId) as GrammarReviewRow | undefined;

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

  const nextReviewStr = result.nextReview.toISOString().replace("T", " ").replace("Z", "");

  if (review.first_reviewed_at === null) {
    db.prepare(`
      UPDATE grammar_reviews
      SET ease_factor = ?, interval = ?, repetitions = ?, next_review = ?, last_reviewed = datetime('now'), first_reviewed_at = datetime('now')
      WHERE grammar_card_id = ?
    `).run(result.easeFactor, result.interval, result.repetitions, nextReviewStr, grammarCardId);
  } else {
    db.prepare(`
      UPDATE grammar_reviews
      SET ease_factor = ?, interval = ?, repetitions = ?, next_review = ?, last_reviewed = datetime('now')
      WHERE grammar_card_id = ?
    `).run(result.easeFactor, result.interval, result.repetitions, nextReviewStr, grammarCardId);
  }

  return NextResponse.json({ success: true, nextReview: result.nextReview });
}
