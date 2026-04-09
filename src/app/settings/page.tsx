"use client";

import { useState, useEffect } from "react";
import { READING_THEMES, DEFAULT_READING_THEMES, normalizeReadingThemes } from "@/lib/reading-themes";

interface QueueStats {
  total: number;
  queued: number;
  generated: number;
  totalCards: number;
}

interface GenerateResult {
  generated: number;
  errors: string[];
}

export default function SettingsPage() {
  const [count, setCount] = useState("5");
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  // New cards per day setting
  const [newCardsPerDay, setNewCardsPerDay] = useState("20");
  const [savingNewCards, setSavingNewCards] = useState(false);
  const [newCardsSaved, setNewCardsSaved] = useState(false);

  // Grammar new cards per day setting
  const [grammarNewCardsPerDay, setGrammarNewCardsPerDay] = useState("5");
  const [savingGrammarCards, setSavingGrammarCards] = useState(false);
  const [grammarCardsSaved, setGrammarCardsSaved] = useState(false);

  // Reading themes setting
  const [readingThemes, setReadingThemes] = useState<string[]>(DEFAULT_READING_THEMES);
  const [savingThemes, setSavingThemes] = useState(false);
  const [themesSaved, setThemesSaved] = useState(false);

  // Strict writing rules setting
  const [strictWritingRules, setStrictWritingRules] = useState(false);
  const [savingStrictWriting, setSavingStrictWriting] = useState(false);
  const [strictWritingSaved, setStrictWritingSaved] = useState(false);

  const fetchStats = async () => {
    const res = await fetch("/api/generate");
    setStats(await res.json());
  };

  const fetchSettings = async () => {
    const res = await fetch("/api/settings");
    const settings = await res.json();
    if (settings.new_cards_per_day) {
      setNewCardsPerDay(settings.new_cards_per_day);
    }
    if (settings.grammar_new_cards_per_day) {
      setGrammarNewCardsPerDay(settings.grammar_new_cards_per_day);
    }
    if (settings.reading_themes) {
      try {
        const parsed = JSON.parse(settings.reading_themes);
        setReadingThemes(normalizeReadingThemes(parsed));
      } catch {
        setReadingThemes(DEFAULT_READING_THEMES);
      }
    } else {
      setReadingThemes(DEFAULT_READING_THEMES);
    }
    if (settings.strict_writing_rules !== undefined) {
      setStrictWritingRules(settings.strict_writing_rules === "true");
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSettings();
  }, []);

  const handleSaveNewCardsPerDay = async () => {
    setSavingNewCards(true);
    setNewCardsSaved(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "new_cards_per_day", value: newCardsPerDay }),
    });
    setSavingNewCards(false);
    setNewCardsSaved(true);
    setTimeout(() => setNewCardsSaved(false), 2000);
  };

  const handleSaveGrammarCardsPerDay = async () => {
    setSavingGrammarCards(true);
    setGrammarCardsSaved(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "grammar_new_cards_per_day", value: grammarNewCardsPerDay }),
    });
    setSavingGrammarCards(false);
    setGrammarCardsSaved(true);
    setTimeout(() => setGrammarCardsSaved(false), 2000);
  };

  const toggleTheme = (key: string) => {
    setReadingThemes((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const handleSaveReadingThemes = async () => {
    setSavingThemes(true);
    setThemesSaved(false);
    const themesToSave = readingThemes.length > 0 ? readingThemes : DEFAULT_READING_THEMES;
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "reading_themes", value: JSON.stringify(themesToSave) }),
    });
    setSavingThemes(false);
    setThemesSaved(true);
    setTimeout(() => setThemesSaved(false), 2000);
  };

  const handleSaveStrictWritingRules = async () => {
    setSavingStrictWriting(true);
    setStrictWritingSaved(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "strict_writing_rules", value: String(strictWritingRules) }),
    });
    setSavingStrictWriting(false);
    setStrictWritingSaved(true);
    setTimeout(() => setStrictWritingSaved(false), 2000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: Number(count) || 1 }),
      });
      const data: GenerateResult = await res.json();
      setResult(data);
      fetchStats();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto p-4">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Settings</h1>

        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Reading Themes</h2>
          <p className="text-xs text-gray-500 mb-3">
            Choose one or more themes for reading practice. Default is all.
          </p>
          <div className="space-y-2">
            {READING_THEMES.map((theme) => (
              <label key={theme.key} className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={readingThemes.includes(theme.key)}
                  onChange={() => toggleTheme(theme.key)}
                  disabled={savingThemes}
                />
                <span>
                  <span className="font-medium">{theme.label}</span>
                  <span className="block text-xs text-gray-500">{theme.description}</span>
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={handleSaveReadingThemes}
            disabled={savingThemes}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {savingThemes ? "Saving…" : themesSaved ? "Saved!" : "Save Themes"}
          </button>
        </div>

        {/* Daily new cards setting */}
        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Daily Learning</h2>
          <label className="block text-sm text-gray-700">
            New cards per day
            <p className="text-xs text-gray-500 mb-2">
              Maximum number of new cards to introduce each day (plus any due reviews)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newCardsPerDay}
                onChange={(e) => setNewCardsPerDay(e.target.value.replace(/[^0-9]/g, ""))}
                className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                disabled={savingNewCards}
              />
              <button
                onClick={handleSaveNewCardsPerDay}
                disabled={savingNewCards}
                className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingNewCards ? "Saving…" : newCardsSaved ? "Saved!" : "Save"}
              </button>
            </div>
          </label>
          <label className="block text-sm text-gray-700 mt-4">
            Grammar new cards per day
            <p className="text-xs text-gray-500 mb-2">
              Maximum number of new grammar cards to introduce each day
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={grammarNewCardsPerDay}
                onChange={(e) => setGrammarNewCardsPerDay(e.target.value.replace(/[^0-9]/g, ""))}
                className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                disabled={savingGrammarCards}
              />
              <button
                onClick={handleSaveGrammarCardsPerDay}
                disabled={savingGrammarCards}
                className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingGrammarCards ? "Saving…" : grammarCardsSaved ? "Saved!" : "Save"}
              </button>
            </div>
          </label>
        </div>

        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Writing Rules</h2>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={strictWritingRules}
              onChange={(e) => setStrictWritingRules(e.target.checked)}
              disabled={savingStrictWriting}
            />
            <span>
              <span className="font-medium">Strict writing rules</span>
              <span className="block text-xs text-gray-500">
                Require Polish diacritics (ą ć ę ł ń ó ś ź ż) to mark answers as correct.
                If unchecked, missing diacritics are accepted but corrections still show the proper spelling.
              </span>
            </span>
          </label>
          <button
            onClick={handleSaveStrictWritingRules}
            disabled={savingStrictWriting}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {savingStrictWriting ? "Saving…" : strictWritingSaved ? "Saved!" : "Save"}
          </button>
        </div>

        {stats && (
          <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white space-y-1 text-sm text-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Card Stats</h2>
            <p>
              <span className="font-medium">Total cards:</span> {stats.totalCards}
            </p>
            <p>
              <span className="font-medium">Queue total:</span> {stats.total}
            </p>
            <p>
              <span className="font-medium">Queued:</span> {stats.queued}
            </p>
            <p>
              <span className="font-medium">Generated:</span> {stats.generated}
            </p>
          </div>
        )}

        <div className="p-4 border border-gray-300 rounded-lg bg-white space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Generate Cards</h2>
          <label className="block text-sm text-gray-700">
            Number of cards to generate
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              disabled={generating}
            />
          </label>

          <button
            onClick={handleGenerate}
            disabled={generating || !stats || stats.queued === 0}
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? "Generating…" : "Generate Cards"}
          </button>

          {result && (
            <div className="p-3 rounded-lg border border-green-500 bg-green-50 text-sm space-y-1">
              <p className="font-medium text-green-800">
                Generated {result.generated} card{result.generated !== 1 ? "s" : ""}
              </p>
              {result.errors.length > 0 && (
                <div className="text-red-600 mt-2">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc pl-4">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
