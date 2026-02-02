"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Flashcard from "@/components/Flashcard";
import type { FlashcardHandle } from "@/components/Flashcard";
import ReviewButtons from "@/components/ReviewButtons";

interface Sentence {
  id: number;
  difficulty: string;
  sentence_pl: string;
  sentence_en: string;
  audio_path: string | null;
}

interface Card {
  id: number;
  polish_word: string;
  english_word: string;
  pronunciation: string;
  notes: string | null;
  audio_path: string;
  sentences: Sentence[];
  next_review: string;
}

export default function Home() {
  const [card, setCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const flashcardRef = useRef<FlashcardHandle>(null);

  const fetchNextCard = useCallback(async () => {
    setLoading(true);
    setRevealed(false);
    const res = await fetch("/api/review");
    const data = await res.json();
    setCard(data);
    setLoading(false);
  }, []);

  const handleRate = useCallback(async (quality: number) => {
    if (!card) return;
    setSubmitting(true);
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, quality }),
    });
    setSubmitting(false);
    await fetchNextCard();
  }, [card, fetchNextCard]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !revealed) {
        setRevealed(true);
      }
      if (e.key === " ") {
        e.preventDefault();
        flashcardRef.current?.playAudio();
      }
      if (revealed && !submitting) {
        if (e.key === "1") handleRate(5);
        else if (e.key === "2") handleRate(3);
        else if (e.key === "3") handleRate(0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [revealed, submitting, handleRate]);

  if (loading && !seeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Loading cards...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {!card ? (
        <p className="text-gray-500">No cards available. Seed the database first.</p>
      ) : (
        <>
          <Flashcard
            ref={flashcardRef}
            key={card.id}
            cardId={card.id}
            polishWord={card.polish_word}
            englishWord={card.english_word}
            pronunciation={card.pronunciation}
            notes={card.notes}
            sentences={card.sentences}
            audioPath={card.audio_path}
            nextReview={card.next_review}
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
