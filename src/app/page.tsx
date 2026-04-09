"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Flashcard from "@/components/Flashcard";
import type { FlashcardHandle } from "@/components/Flashcard";
import ReviewButtons from "@/components/ReviewButtons";
import ProgressSidebar from "@/components/ProgressSidebar";
import Celebration from "@/components/Celebration";

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
  review_count: number;
  last_reviewed: string | null;
  is_due?: boolean;
  is_new?: boolean;
}

export default function Home() {
  const [card, setCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const flashcardRef = useRef<FlashcardHandle>(null);

  // Session stats
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [initialDue, setInitialDue] = useState<number | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [newCardsDue, setNewCardsDue] = useState(0);
  const [reviewCardsDue, setReviewCardsDue] = useState(0);
  const [availableNewCards, setAvailableNewCards] = useState(0);
  const [newCardsPerDay, setNewCardsPerDay] = useState(20);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationShown, setCelebrationShown] = useState(false);
  const [addingCards, setAddingCards] = useState(false);

  // Add custom word
  const [showAddWord, setShowAddWord] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [addingWord, setAddingWord] = useState(false);
  const [addWordResult, setAddWordResult] = useState<{ success?: boolean; error?: string; word?: string } | null>(null);

  const fetchNextCard = useCallback(async () => {
    setLoading(true);
    setRevealed(false);
    const res = await fetch("/api/review");
    const data = await res.json();
    setCard(data.card);
    setDueCount(data.stats.dueCount);
    setNewCardsDue(data.stats.newCardsDue);
    setReviewCardsDue(data.stats.reviewCardsDue);
    setAvailableNewCards(data.stats.availableNewCards ?? 0);
    setNewCardsPerDay(data.stats.newCardsPerDay ?? 20);
    if (initialDue === null && data.stats.dueCount > 0) {
      setInitialDue(data.stats.dueCount);
    }
    setLoading(false);
  }, [initialDue]);

  const handleRate = useCallback(async (quality: number) => {
    if (!card) return;
    setSubmitting(true);
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, quality }),
    });
    setReviewedCount((c) => c + 1);
    setTotalRatings((c) => c + 1);
    if (quality > 0) setCorrectCount((c) => c + 1);
    setSubmitting(false);
    await fetchNextCard();
  }, [card, fetchNextCard]);

  const handleAddMoreCards = useCallback(async () => {
    setAddingCards(true);
    await fetch("/api/review/add-cards", { method: "POST" });
    await fetchNextCard();
    setAddingCards(false);
  }, [fetchNextCard]);

  const handleAddWord = useCallback(async () => {
    if (!newWord.trim() || addingWord) return;
    setAddingWord(true);
    setAddWordResult(null);

    try {
      const res = await fetch("/api/cards/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ polishWord: newWord.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        setAddWordResult({ success: true, word: data.card?.polish_word || newWord });
        setNewWord("");
        // Refresh to update available new cards count
        await fetchNextCard();
      } else {
        setAddWordResult({ error: data.error || "Failed to add word" });
      }
    } catch {
      setAddWordResult({ error: "Network error" });
    }

    setAddingWord(false);
    // Clear result after 3 seconds
    setTimeout(() => setAddWordResult(null), 3000);
  }, [newWord, addingWord, fetchNextCard]);

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
      // Don't trigger shortcuts when typing in an input
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;

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

  const totalCards = initialDue !== null
    ? Math.max(initialDue, reviewedCount + dueCount)
    : reviewedCount + dueCount;

  // Show celebration when all due cards are completed
  useEffect(() => {
    if (dueCount === 0 && reviewedCount > 0 && !celebrationShown && !loading) {
      setShowCelebration(true);
      setCelebrationShown(true);
    }
  }, [dueCount, reviewedCount, celebrationShown, loading]);

  if (loading && !seeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Loading cards...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-row">
      {showCelebration && (
        <Celebration onDismiss={() => setShowCelebration(false)} />
      )}
      <ProgressSidebar
        reviewedCount={reviewedCount}
        totalCards={totalCards}
        correctCount={correctCount}
        totalRatings={totalRatings}
        newCardsDue={newCardsDue}
        reviewCardsDue={reviewCardsDue}
      />
      <div className="flex-1 flex flex-col items-center justify-center p-2">
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
              reviewCount={card.review_count}
              lastReviewed={card.last_reviewed}
              isDue={card.is_due}
              isNew={card.is_new}
              revealed={revealed}
              onReveal={() => setRevealed(true)}
            />

            {revealed && (
              <ReviewButtons onRate={handleRate} disabled={submitting} />
            )}

            {celebrationShown && availableNewCards > 0 && (
              <button
                onClick={handleAddMoreCards}
                disabled={addingCards}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {addingCards ? "Adding..." : `Add ${newCardsPerDay} More New Cards Today`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Floating Add Word Button */}
      <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2">
        {/* Result toast */}
        {addWordResult && (
          <div
            className={`px-3 py-2 rounded-lg text-sm font-medium shadow-lg ${
              addWordResult.success
                ? "bg-green-100 text-green-800 border border-green-300"
                : "bg-red-100 text-red-800 border border-red-300"
            }`}
          >
            {addWordResult.success
              ? `Added "${addWordResult.word}"`
              : addWordResult.error}
          </div>
        )}

        {/* Expanded input */}
        {showAddWord && (
          <div className="flex gap-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddWord();
                if (e.key === "Escape") {
                  setShowAddWord(false);
                  setNewWord("");
                }
              }}
              placeholder="Polish word..."
              disabled={addingWord}
              className="w-40 px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 placeholder-gray-400"
              autoFocus
            />
            <button
              onClick={handleAddWord}
              disabled={addingWord || !newWord.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {addingWord ? "..." : "Add"}
            </button>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => {
            setShowAddWord(!showAddWord);
            if (showAddWord) setNewWord("");
          }}
          className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-white text-xl font-bold transition ${
            showAddWord
              ? "bg-gray-500 hover:bg-gray-600"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          title={showAddWord ? "Close" : "Add a word"}
        >
          {showAddWord ? "×" : "+"}
        </button>
      </div>
    </div>
  );
}
