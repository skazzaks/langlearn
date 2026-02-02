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

  const fetchStats = async () => {
    const res = await fetch("/api/generate");
    setStats(await res.json());
  };

  useEffect(() => {
    fetchStats();
  }, []);

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
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Settings</h1>

      {stats && (
        <div className="mb-6 p-4 border border-gray-700 rounded-lg space-y-1 text-sm">
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

      <div className="space-y-3">
        <label className="block text-sm font-medium">
          Number of cards to generate
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))}
            className="mt-1 block w-full rounded border border-gray-600 bg-transparent px-3 py-2 text-sm"
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
      </div>

      {result && (
        <div className="mt-4 p-4 rounded-lg border border-green-700 text-sm space-y-1">
          <p className="font-medium">
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
  );
}
