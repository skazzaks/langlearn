"use client";

import { useState, useEffect } from "react";

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
