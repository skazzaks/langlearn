"use client";

import { useState, useEffect, useCallback } from "react";
import MinimalPairCard from "@/components/MinimalPairCard";
import ReviewButtons from "@/components/ReviewButtons";

interface Word {
  id: number;
  polish_word: string;
  english_word: string;
  correct_sound: string;
  audio_path: string | null;
  sound_a: string;
  sound_b: string;
  next_review: string;
}

export default function MinimalPairsPage() {
  const [word, setWord] = useState<Word | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchNextWord = useCallback(async () => {
    setLoading(true);
    setRevealed(false);
    const res = await fetch("/api/minimal-pairs/review");
    const data = await res.json();
    setWord(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const res = await fetch("/api/minimal-pairs");
      const { count } = await res.json();
      if (count === 0) {
        await fetch("/api/minimal-pairs", { method: "POST" });
      }
      setSeeded(true);
      await fetchNextWord();
    }
    init();
  }, [fetchNextWord]);

  async function handleRate(quality: number) {
    if (!word) return;
    setSubmitting(true);
    await fetch("/api/minimal-pairs/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId: word.id, quality }),
    });
    setSubmitting(false);
    await fetchNextWord();
  }

  if (loading && !seeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Loading minimal pairs...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {!word ? (
        <p className="text-gray-500">No minimal pairs available.</p>
      ) : (
        <>
          <MinimalPairCard
            key={word.id + (revealed ? "-r" : "")}
            wordId={word.id}
            polishWord={word.polish_word}
            englishWord={word.english_word}
            soundA={word.sound_a}
            soundB={word.sound_b}
            correctSound={word.correct_sound}
            audioPath={word.audio_path}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
          />

          {revealed && (
            <ReviewButtons onRate={handleRate} disabled={submitting} />
          )}
        </>
      )}
    </div>
  );
}
