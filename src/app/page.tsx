"use client";

import { useState, useEffect, useCallback } from "react";
import Flashcard from "@/components/Flashcard";
import ReviewButtons from "@/components/ReviewButtons";

interface Card {
  id: number;
  polish_word: string;
  english_word: string;
  pronunciation: string;
  example_sentence_pl: string;
  example_sentence_en: string;
  audio_path: string;
  sentence_audio_path: string;
}

export default function Home() {
  const [card, setCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchNextCard = useCallback(async () => {
    setLoading(true);
    setRevealed(false);
    const res = await fetch("/api/review");
    const data = await res.json();
    setCard(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const res = await fetch("/api/cards");
      const cards = await res.json();
      if (cards.length === 0) {
        await fetch("/api/cards", { method: "POST" });
      }
      setSeeded(true);
      await fetchNextCard();
    }
    init();
  }, [fetchNextCard]);

  async function handleRate(quality: number) {
    if (!card) return;
    setSubmitting(true);
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, quality }),
    });
    setSubmitting(false);
    await fetchNextCard();
  }

  if (loading && !seeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Loading cards...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">LangLearn</h1>

      {!card ? (
        <p className="text-gray-500">No cards available. Seed the database first.</p>
      ) : (
        <>
          <Flashcard
            polishWord={card.polish_word}
            englishWord={card.english_word}
            pronunciation={card.pronunciation}
            exampleSentencePl={card.example_sentence_pl}
            exampleSentenceEn={card.example_sentence_en}
            audioPath={card.audio_path}
            sentenceAudioPath={card.sentence_audio_path}
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
