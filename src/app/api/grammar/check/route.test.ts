import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockText = JSON.stringify({
  correct: false,
  feedback: "Missing diacritics.",
  user_errors: [],
});

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = {
        create: vi.fn().mockImplementation(() => {
          return Promise.resolve({ content: [{ type: "text", text: mockText }] });
        }),
      };
    },
  };
});

vi.mock("@/lib/db", async () => {
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return { default: db };
});

import db from "@/lib/db";
import { POST } from "./route";

function makeRequest(body: unknown) {
  const req = new Request("http://localhost/api/grammar/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return new NextRequest(req);
}

describe("/api/grammar/check strict writing rules", () => {
  beforeEach(() => {
    db.exec("DELETE FROM settings");
    mockText = JSON.stringify({
      correct: false,
      feedback: "Missing diacritics.",
      user_errors: [],
    });
  });

  it("accepts missing diacritics when strict rules are off", async () => {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("strict_writing_rules", "false");
    const request = makeRequest({
      userAnswer: "zadnych rzeczy",
      correctPolish: "żadnych rzeczy",
      englishSentence: "none of the things",
      grammarPattern: "Genitive plural",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.correct).toBe(true);
  });

  it("requires diacritics when strict rules are on", async () => {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("strict_writing_rules", "true");
    const request = makeRequest({
      userAnswer: "zadnych rzeczy",
      correctPolish: "żadnych rzeczy",
      englishSentence: "none of the things",
      grammarPattern: "Genitive plural",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.correct).toBe(false);
  });

  it("ignores diacritic-only feedback from the model when strict rules are off", async () => {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("strict_writing_rules", "false");
    mockText = JSON.stringify({
      correct: false,
      feedback: "Missing diacritics: should be 'dużych'.",
      user_errors: [{ word: "duzych", issue: "Missing diacritic: should be 'dużych'" }],
    });

    const request = makeRequest({
      userAnswer: "Te duzych ksiazek",
      correctPolish: "Te dużo książek",
      englishSentence: "There are many books",
      grammarPattern: "Genitive plural",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.correct).toBe(true);
    expect(json.user_errors).toHaveLength(0);
  });
});
