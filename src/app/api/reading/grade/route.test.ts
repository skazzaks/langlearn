import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Anthropic SDK
const responses = [
  JSON.stringify({
    correct: true,
    feedback_en: "Good answer.",
    corrected_pl: "To jest poprawna odpowiedz.",
    score_reason: "Meaning matches story.",
  }),
  JSON.stringify({
    correct: false,
    feedback_en: "The meaning is off.",
    corrected_pl: "Poprawna odpowiedz jest inna.",
    score_reason: "Does not match story facts.",
  }),
];

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      _callCount = 0;
      messages = {
        create: vi.fn().mockImplementation(() => {
          const text = responses[this._callCount] ?? responses[0];
          this._callCount += 1;
          return Promise.resolve({ content: [{ type: "text", text }] });
        }),
      };
    },
  };
});

// Mock db with in-memory SQLite
vi.mock("@/lib/db", async () => {
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE reading_stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      theme_key TEXT NOT NULL,
      themes TEXT NOT NULL,
      content_pl TEXT NOT NULL,
      questions_pl TEXT NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("strict_writing_rules", "false");
  return { default: db };
});

import db from "@/lib/db";
import { POST } from "./route";

function insertStory() {
  const result = db.prepare(
    "INSERT INTO reading_stories (theme_key, themes, content_pl, questions_pl) VALUES (?, ?, ?, ?)"
  ).run(
    "culture",
    JSON.stringify(["culture"]),
    "Ala ma kota.",
    JSON.stringify(["Kim jest Ala?", "Co ma Ala?"])
  );
  return Number(result.lastInsertRowid);
}

function makeRequest(body: unknown) {
  const req = new Request("http://localhost/api/reading/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return new NextRequest(req);
}

describe("/api/reading/grade", () => {
  beforeEach(() => {
    db.exec("DELETE FROM reading_stories");
  });

  it("grades answers successfully", async () => {
    const storyId = insertStory();
    const request = makeRequest({
      storyId,
      questions: ["Kim jest Ala?", "Co ma Ala?"],
      answers: ["Ala jest dziewczyna.", "Ala ma kota."],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.results).toHaveLength(2);
    expect(json.results[0].correct).toBe(true);
    expect(json.results[1].correct).toBe(false);
  });

  it("returns 400 when question and answer lengths mismatch", async () => {
    const storyId = insertStory();
    const request = makeRequest({
      storyId,
      questions: ["Kim jest Ala?", "Co ma Ala?"],
      answers: ["Ala jest dziewczyna."],
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when question count doesn't match story", async () => {
    const storyId = insertStory();
    const request = makeRequest({
      storyId,
      questions: ["Kim jest Ala?"],
      answers: ["Ala jest dziewczyna."],
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
