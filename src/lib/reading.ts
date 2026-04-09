import Anthropic from "@anthropic-ai/sdk";
import db from "./db";
import frequencyList from "../../data/polish-frequency-50000.json";
import {
  DEFAULT_READING_THEMES,
  READING_THEMES,
  ReadingThemeKey,
  normalizeReadingThemes,
} from "./reading-themes";

interface ReadingStory {
  id: number;
  themes: ReadingThemeKey[];
  content_pl: string;
  questions_pl: string[];
  created_at: string;
}

export interface ReadingStats {
  reviewedTotal: number;
  baseTotal: number;
  allowedTotal: number;
  storyUniqueTokens: number;
  storyReviewedTokens: number;
  storyReviewedPercent: number;
}

export interface ReadingStoryRow {
  id: number;
  themes: string;
  content_pl: string;
  questions_pl: string;
  created_at: string;
}

const BASE_WORD_LIMIT = 500;
const MAX_RETRIES = 2;
const MIN_QUEUE_SIZE = 3;
const NEWS_CACHE_TTL_MS = 60 * 60 * 1000;

const BASE_WORDS = (frequencyList as { rank: number; word: string }[])
  .slice(0, BASE_WORD_LIMIT)
  .map((w) => w.word.toLowerCase());

function getReviewedWords(): string[] {
  const rows = db.prepare(
    `
      SELECT c.polish_word as word
      FROM cards c
      JOIN reviews r ON r.card_id = c.id
      WHERE r.first_reviewed_at IS NOT NULL
    `
  ).all() as { word: string }[];
  return rows.map((r) => r.word.toLowerCase());
}

function getAllowedWords(): string[] {
  const allowed = new Set<string>(BASE_WORDS);
  for (const word of getReviewedWords()) {
    allowed.add(word);
  }
  return Array.from(allowed);
}

function getThemeByKey(key: ReadingThemeKey) {
  return READING_THEMES.find((t) => t.key === key);
}

function tokenizeWords(text: string): string[] {
  const tokens: string[] = [];
  const regex = /[\p{L}]+(?:-[\p{L}]+)*/gu;
  for (const match of text.matchAll(regex)) {
    tokens.push(match[0].toLowerCase());
  }
  return tokens;
}

export function getReadingStatsForStory(content: string): ReadingStats {
  const reviewedSet = new Set(getReviewedWords());
  const baseSet = new Set(BASE_WORDS);
  const allowedSet = new Set<string>([...baseSet, ...reviewedSet]);
  const uniqueTokens = Array.from(new Set(tokenizeWords(content)));
  const storyReviewedTokens = uniqueTokens.filter((t) => reviewedSet.has(t)).length;
  const storyUniqueTokens = uniqueTokens.length;
  const storyReviewedPercent =
    storyUniqueTokens > 0
      ? Math.round((storyReviewedTokens / storyUniqueTokens) * 100)
      : 0;

  return {
    reviewedTotal: reviewedSet.size,
    baseTotal: BASE_WORDS.length,
    allowedTotal: allowedSet.size,
    storyUniqueTokens,
    storyReviewedTokens,
    storyReviewedPercent,
  };
}

function limitParagraphs(text: string): string {
  const parts = text
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 3) {
    return parts.join("\n\n");
  }
  const first = parts.slice(0, 2);
  const rest = parts.slice(2).join(" ");
  return [...first, rest].join("\n\n");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

function extractTag(xml: string, tag: string): string {
  const cdata = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, "i");
  const plain = new RegExp(`<${tag}>(.*?)<\\/${tag}>`, "i");
  const cdataMatch = xml.match(cdata);
  if (cdataMatch) {
    return decodeHtmlEntities(stripTags(cdataMatch[1])).trim();
  }
  const plainMatch = xml.match(plain);
  if (plainMatch) {
    return decodeHtmlEntities(stripTags(plainMatch[1])).trim();
  }
  return "";
}

async function fetchNewsSummary(): Promise<string> {
  const feeds = [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://feeds.bbci.co.uk/news/rss.xml",
  ];

  for (const url of feeds) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi))
        .slice(0, 3)
        .map((match) => match[1]);
      const lines = items
        .map((item) => {
          const title = extractTag(item, "title");
          const description = extractTag(item, "description");
          if (!title) return "";
          const trimmedDesc = description ? description.slice(0, 180) : "";
          return trimmedDesc ? `${title} — ${trimmedDesc}` : title;
        })
        .filter(Boolean);
      if (lines.length > 0) {
        return lines.join("\n");
      }
    } catch {
      // Try next feed
    } finally {
      clearTimeout(timeout);
    }
  }

  return "";
}

async function getCachedNewsSummary(): Promise<string> {
  const row = db.prepare(
    "SELECT summary, updated_at FROM reading_news_cache WHERE id = 1"
  ).get() as { summary: string; updated_at: string } | undefined;

  if (row?.summary && row.updated_at) {
    const ageMs = Date.now() - new Date(row.updated_at).getTime();
    if (Number.isFinite(ageMs) && ageMs < NEWS_CACHE_TTL_MS) {
      return row.summary;
    }
  }

  const fetched = await fetchNewsSummary();
  if (fetched) {
    db.prepare(
      "INSERT OR REPLACE INTO reading_news_cache (id, summary, updated_at) VALUES (1, ?, ?)"
    ).run(fetched, new Date().toISOString());
    return fetched;
  }

  return row?.summary ?? "";
}

function buildPrompt(options: {
  theme: ReadingThemeKey;
  allowedWords: string[];
  newsSummary: string;
  avoidWords: string[];
}) {
  const selectedTheme = getThemeByKey(options.theme);
  const themeInfo = selectedTheme
    ? `${selectedTheme.label}: ${selectedTheme.description}`
    : options.theme;
  const selectedLabel = selectedTheme?.label ?? options.theme;
  const avoidList = options.avoidWords.length
    ? `Avoid these words: ${options.avoidWords.join(", ")}.`
    : "";

  return `You write short Polish reading practice texts.

Theme: ${selectedLabel}
Theme description:
${themeInfo}

Rules:
1) Use ONLY words from the Allowed Words list (case-insensitive).
2) Do NOT change word forms or add new words. Use exact forms from the list.
3) Keep sentences short and simple.
4) Write 1 to 3 short paragraphs.
5) End with exactly 2 comprehension questions in Polish.
6) Write about this single theme only. Do NOT combine themes.
${avoidList}

Allowed Words:
${options.allowedWords.join(", ")}

${options.newsSummary ? `Real news summary (English, for grounding):\n${options.newsSummary}\n` : ""}

Return ONLY valid JSON (no markdown fences):
{
  "content_pl": "Polish text (1–3 paragraphs, separated by blank lines)",
  "questions_pl": ["Question 1 in Polish", "Question 2 in Polish"]
}
`;
}

function parseJsonResponse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function getSelectedReadingThemes(): ReadingThemeKey[] {
  const row = db.prepare(
    "SELECT value FROM settings WHERE key = 'reading_themes'"
  ).get() as { value: string } | undefined;
  if (!row?.value) return DEFAULT_READING_THEMES;
  try {
    const parsed = JSON.parse(row.value);
    return normalizeReadingThemes(parsed);
  } catch {
    return DEFAULT_READING_THEMES;
  }
}

function backfillThemeKey() {
  const rows = db.prepare(
    `
      SELECT id, themes, theme_key
      FROM reading_stories
      WHERE theme_key IS NULL OR theme_key = ''
    `
  ).all() as { id: number; themes: string; theme_key: string | null }[];

  if (rows.length === 0) return;

  const update = db.prepare(
    "UPDATE reading_stories SET theme_key = ? WHERE id = ?"
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      let key = "culture";
      try {
        const parsed = JSON.parse(row.themes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          key = String(parsed[0]);
        }
      } catch {
        // use default
      }
      update.run(key, row.id);
    }
  });
  tx();
}

function countUnusedStories(theme: ReadingThemeKey): number {
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM reading_stories WHERE theme_key = ? AND used_at IS NULL"
  ).get(theme) as { count: number };
  return row.count;
}

function getNextUnusedStory(theme: ReadingThemeKey): ReadingStory | null {
  backfillThemeKey();
  const row = db.prepare(
    `
      SELECT id, themes, content_pl, questions_pl, created_at
      FROM reading_stories
      WHERE theme_key = ? AND used_at IS NULL
      ORDER BY id ASC
      LIMIT 1
    `
  ).get(theme) as
    | {
        id: number;
        themes: string;
        content_pl: string;
        questions_pl: string;
        created_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    themes: normalizeReadingThemes(JSON.parse(row.themes)),
    content_pl: row.content_pl,
    questions_pl: JSON.parse(row.questions_pl),
    created_at: row.created_at,
  };
}

function markStoryUsed(id: number) {
  db.prepare(
    "UPDATE reading_stories SET used_at = datetime('now') WHERE id = ?"
  ).run(id);
}

export function pickThemeForRequest(
  themes: ReadingThemeKey[]
): ReadingThemeKey {
  backfillThemeKey();
  const counts = themes.map((theme) => ({
    theme,
    count: countUnusedStories(theme),
  }));
  const available = counts.filter((c) => c.count > 0);
  const pool = available.length > 0 ? available : counts;
  return pool[Math.floor(Math.random() * pool.length)].theme;
}

export async function prewarmThemeQueue(theme: ReadingThemeKey) {
  const current = countUnusedStories(theme);
  const needed = Math.max(0, MIN_QUEUE_SIZE - current);
  for (let i = 0; i < needed; i++) {
    await generateReadingStory(theme);
  }
}

export async function getOrCreateReadingStory(
  theme: ReadingThemeKey
): Promise<ReadingStory> {
  const cached = getNextUnusedStory(theme);
  if (cached) {
    markStoryUsed(cached.id);
    if (countUnusedStories(theme) < MIN_QUEUE_SIZE) {
      void prewarmThemeQueue(theme);
    }
    return cached;
  }

  const story = await generateReadingStory(theme);
  markStoryUsed(story.id);
  if (countUnusedStories(theme) < MIN_QUEUE_SIZE) {
    void prewarmThemeQueue(theme);
  }
  return story;
}

export async function generateReadingStory(
  theme: ReadingThemeKey
): Promise<ReadingStory> {
  const client = new Anthropic();
  const allowedWords = getAllowedWords();
  const allowedSet = new Set(allowedWords);
  const newsSummary =
    theme === "news" ? await getCachedNewsSummary() : "";

  let lastStory: { content_pl: string; questions_pl: string[] } | null = null;
  let avoidWords: string[] = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const prompt = buildPrompt({
      theme,
      allowedWords,
      newsSummary,
      avoidWords,
    });
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = parseJsonResponse(text);
    if (!parsed || typeof parsed.content_pl !== "string") {
      continue;
    }

    const content = limitParagraphs(parsed.content_pl.trim());
    const questions = Array.isArray(parsed.questions_pl)
      ? parsed.questions_pl.slice(0, 2).map((q: unknown) => String(q))
      : [];

    lastStory = {
      content_pl: content,
      questions_pl: questions.length === 2 ? questions : ["", ""],
    };

    const tokens = tokenizeWords(content);
    const unknown = Array.from(new Set(tokens.filter((t) => !allowedSet.has(t))));
    if (unknown.length === 0) {
      break;
    }
    avoidWords = unknown.slice(0, 50);
  }

  if (!lastStory) {
    throw new Error("Failed to generate reading story");
  }

  const insertStory = db.prepare(
    `
      INSERT INTO reading_stories (theme_key, themes, content_pl, questions_pl)
      VALUES (?, ?, ?, ?)
    `
  );
  const insertToken = db.prepare(
    "INSERT INTO reading_story_tokens (story_id, token) VALUES (?, ?)"
  );

  const tokens = Array.from(
    new Set(tokenizeWords(lastStory.content_pl))
  );

  const tx = db.transaction(() => {
    const result = insertStory.run(
      theme,
      JSON.stringify([theme]),
      lastStory!.content_pl,
      JSON.stringify(lastStory!.questions_pl)
    );
    const storyId = Number(result.lastInsertRowid);
    for (const token of tokens) {
      insertToken.run(storyId, token);
    }
    return storyId;
  });

  const storyId = tx();
  const row = db.prepare(
    "SELECT id, themes, content_pl, questions_pl, created_at FROM reading_stories WHERE id = ?"
  ).get(storyId) as {
    id: number;
    themes: string;
    content_pl: string;
    questions_pl: string;
    created_at: string;
  };

  return {
    id: row.id,
    themes: normalizeReadingThemes(JSON.parse(row.themes)),
    content_pl: row.content_pl,
    questions_pl: JSON.parse(row.questions_pl),
    created_at: row.created_at,
  };
}

export function getLatestReadingStory(): ReadingStory | null {
  const row = db.prepare(
    "SELECT id, themes, content_pl, questions_pl, created_at FROM reading_stories ORDER BY id DESC LIMIT 1"
  ).get() as
    | {
        id: number;
        themes: string;
        content_pl: string;
        questions_pl: string;
        created_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    themes: normalizeReadingThemes(JSON.parse(row.themes)),
    content_pl: row.content_pl,
    questions_pl: JSON.parse(row.questions_pl),
    created_at: row.created_at,
  };
}
