import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBooleanSetting } from "@/lib/settings";

const anthropic = new Anthropic();

const POLISH_DIACRITICS_MAP: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
  Ą: "A",
  Ć: "C",
  Ę: "E",
  Ł: "L",
  Ń: "N",
  Ó: "O",
  Ś: "S",
  Ź: "Z",
  Ż: "Z",
};

const DIACRITIC_ISSUE_REGEX = /diacritic|accent|ogonek|kresk|diakryt/i;

function stripPolishDiacritics(text: string): string {
  const replaced = text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => POLISH_DIACRITICS_MAP[char] ?? char);
  return replaced.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalize(s: string, strictWritingRules: boolean): string {
  const base = s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?,;:]+/g, "");
  return strictWritingRules ? base : stripPolishDiacritics(base);
}

interface CheckResult {
  correct: boolean;
  feedback: string | null;
  user_errors: { word: string; issue: string }[];
}

export async function POST(request: NextRequest) {
  const { userAnswer, correctPolish, englishSentence, grammarPattern } = await request.json();
  const strictWritingRules = getBooleanSetting("strict_writing_rules", false);

  if (!userAnswer || !correctPolish) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Exact match check
  if (normalize(userAnswer, strictWritingRules) === normalize(correctPolish, strictWritingRules)) {
    return NextResponse.json({ correct: true, feedback: null, user_errors: [] });
  }

  // Ask Claude to evaluate
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are a Polish language teacher evaluating a student's grammar translation.

English sentence: "${englishSentence}"
Expected Polish: "${correctPolish}"
Student wrote: "${userAnswer}"
Grammar pattern being practiced: ${grammarPattern}

EVALUATION RULES:
1. ${strictWritingRules ? "STRICT MODE: Require correct Polish diacritics (ą ć ę ł ń ó ś ź ż)" : "LENIENT MODE: Accept answers missing diacritics if grammar is otherwise correct. Mention proper spelling in feedback."}
2. BE STRICT on case endings - this is the main learning objective
3. Accept valid alternative translations that correctly demonstrate the grammar pattern
4. Minor word order differences are OK if meaning and grammar are correct
5. The student's answer must mean the same thing as the English sentence

Return ONLY valid JSON: { "correct": true/false, "feedback": "brief explanation or null if correct", "user_errors": [{ "word": "wrong word", "issue": "explanation" }] }`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        correct: false,
        feedback: "Could not evaluate answer",
        user_errors: [],
      });
    }

    const result = JSON.parse(jsonMatch[0]) as CheckResult;

    if (!strictWritingRules) {
      const normalizedUser = normalize(userAnswer, false);
      const normalizedCorrect = normalize(correctPolish, false);
      if (normalizedUser === normalizedCorrect) {
        return NextResponse.json({ correct: true, feedback: null, user_errors: [] });
      }

      const filteredErrors = result.user_errors.filter((err) => !DIACRITIC_ISSUE_REGEX.test(err.issue));
      const feedbackIsDiacritic = !!result.feedback && DIACRITIC_ISSUE_REGEX.test(result.feedback);
      if (filteredErrors.length === 0 && (result.user_errors.length > 0 || feedbackIsDiacritic)) {
        return NextResponse.json({ correct: true, feedback: null, user_errors: [] });
      }
      if (filteredErrors.length !== result.user_errors.length) {
        return NextResponse.json({ ...result, user_errors: filteredErrors });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to evaluate answer:", error);
    return NextResponse.json({
      correct: false,
      feedback: "Could not evaluate answer. Please self-rate.",
      user_errors: [],
    });
  }
}
