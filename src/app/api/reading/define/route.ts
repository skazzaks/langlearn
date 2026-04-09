import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import db from "@/lib/db";

function normalizeToken(token: string) {
  return token.toLowerCase().trim();
}

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const normalized = normalizeToken(token);
  if (normalized.length === 0 || normalized.length > 40) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const cached = db.prepare(
    "SELECT definition_en FROM reading_definitions_cache WHERE token = ?"
  ).get(normalized) as { definition_en: string } | undefined;

  if (cached?.definition_en) {
    return NextResponse.json({ definition: cached.definition_en });
  }

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 64,
    messages: [
      {
        role: "user",
        content: `Provide a short English gloss (1-6 words) for the Polish word "${normalized}".
If unknown, respond with {"definition_en": "unknown"}.
Return ONLY valid JSON (no markdown fences):
{"definition_en": "..."}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  let definition = "unknown";
  try {
    const parsed = JSON.parse(text) as { definition_en?: string };
    if (parsed.definition_en) {
      definition = String(parsed.definition_en).trim();
    }
  } catch {
    definition = "unknown";
  }

  db.prepare(
    "INSERT OR REPLACE INTO reading_definitions_cache (token, definition_en) VALUES (?, ?)"
  ).run(normalized, definition);

  return NextResponse.json({ definition });
}
