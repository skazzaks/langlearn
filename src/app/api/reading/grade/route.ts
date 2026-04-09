import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import db from "@/lib/db";
import { getBooleanSetting } from "@/lib/settings";

interface GradeResult {
  correct: boolean;
  feedback_en: string;
  corrected_pl: string;
  score_reason: string;
}

function clampText(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function safeJsonParse(text: string): GradeResult | null {
  try {
    return JSON.parse(text) as GradeResult;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as GradeResult;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const storyId = Number(body.storyId);
  const questions = Array.isArray(body.questions) ? body.questions : [];
  const answers = Array.isArray(body.answers) ? body.answers : [];

  if (!storyId || questions.length === 0) {
    return NextResponse.json({ error: "Missing storyId or questions" }, { status: 400 });
  }

  if (questions.length !== answers.length) {
    return NextResponse.json({ error: "Questions and answers length mismatch" }, { status: 400 });
  }

  const story = db.prepare(
    "SELECT id, content_pl, questions_pl FROM reading_stories WHERE id = ?"
  ).get(storyId) as { id: number; content_pl: string; questions_pl: string } | undefined;

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const strictWritingRules = getBooleanSetting("strict_writing_rules", false);
  let storyQuestions: string[] = [];
  try {
    const parsed = JSON.parse(story.questions_pl);
    storyQuestions = Array.isArray(parsed) ? parsed.map((q) => String(q)) : [];
  } catch {
    storyQuestions = [];
  }

  if (storyQuestions.length !== questions.length) {
    return NextResponse.json({ error: "Question count mismatch" }, { status: 400 });
  }

  const client = new Anthropic();

  const results: GradeResult[] = [];
  for (let i = 0; i < questions.length; i++) {
    const question = String(questions[i]);
    const answer = clampText(String(answers[i] ?? ""), 500).trim();

    if (!answer) {
      results.push({
        correct: false,
        feedback_en: "No answer provided. Try answering in Polish using details from the story.",
        corrected_pl: "",
        score_reason: "Empty answer.",
      });
      continue;
    }

    const prompt = `You are grading a Polish reading comprehension answer.

Story (Polish):
${clampText(story.content_pl, 1400)}

Question (Polish): ${question}
Student answer (Polish): ${answer}

Rules:
1) Mark "correct" only if the meaning matches the story (strict).
2) Always provide a corrected Polish answer (even if correct).
3) Provide feedback in English (1-3 sentences).
4) Provide a short score_reason (English).
5) Strict writing rules are ${strictWritingRules ? "ON" : "OFF"}.
   - If OFF: do not mark answers wrong solely for missing Polish diacritics (ą ć ę ł ń ó ś ź ż). Treat missing diacritics as acceptable if the meaning is correct, but provide corrected_pl with proper diacritics.
   - If ON: require correct diacritics.

Return ONLY valid JSON (no markdown fences):
{"correct": true|false, "feedback_en": "...", "corrected_pl": "...", "score_reason": "..."}`
;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = safeJsonParse(text);
    if (parsed && typeof parsed.correct === "boolean") {
      results.push(parsed);
    } else {
      results.push({
        correct: false,
        feedback_en: "Could not grade this answer. Try again.",
        corrected_pl: "",
        score_reason: "Model response invalid.",
      });
    }
  }

  return NextResponse.json({ results });
}
