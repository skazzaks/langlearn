"use client";

import { useState, useEffect, useCallback } from "react";
import GrammarCard from "@/components/GrammarCard";
import GrammarFeedback from "@/components/GrammarFeedback";
import ProgressSidebar from "@/components/ProgressSidebar";
import Celebration from "@/components/Celebration";

interface HighlightedWord {
  word: string;
  base_form: string;
  ending: string;
}

interface Sentence {
  english: string;
  correct_polish: string;
  highlighted_words: HighlightedWord[];
  grammar_reminder: string;
}

interface CardData {
  id: number;
  case_name: string;
  usage: string;
  modifier: string;
  gender: string;
  number: string;
  display_title: string;
  resolved_gender?: string;
}

interface CheckResult {
  correct: boolean;
  feedback: string | null;
  user_errors: { word: string; issue: string }[];
}

export default function GrammarPage() {
  const [card, setCard] = useState<CardData | null>(null);
  const [sentence, setSentence] = useState<Sentence | null>(null);
  const [userInput, setUserInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  // Session stats
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [initialDue, setInitialDue] = useState<number | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [newCardsDue, setNewCardsDue] = useState(0);
  const [reviewCardsDue, setReviewCardsDue] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationShown, setCelebrationShown] = useState(false);

  const fetchNextCard = useCallback(async () => {
    setLoading(true);
    setChecked(false);
    setCheckResult(null);
    setUserInput("");
    setError(null);

    try {
      const res = await fetch("/api/grammar/review");
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to load card");
      }
      const data = await res.json();
      setCard(data.card);
      setSentence(data.sentence);
      setDueCount(data.stats.dueCount);
      setNewCardsDue(data.stats.newCardsDue);
      setReviewCardsDue(data.stats.reviewCardsDue);
      if (initialDue === null && data.stats.dueCount > 0) {
        setInitialDue(data.stats.dueCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load card");
    }

    setLoading(false);
  }, [initialDue]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!userInput.trim() || !sentence || !card || checking) return;
    setChecking(true);

    try {
      const res = await fetch("/api/grammar/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAnswer: userInput,
          correctPolish: sentence.correct_polish,
          englishSentence: sentence.english,
          grammarPattern: card.display_title,
        }),
      });
      const result = await res.json();
      setCheckResult(result);
      setChecked(true);
    } catch {
      setCheckResult({
        correct: false,
        feedback: "Could not evaluate answer. Please self-rate.",
        user_errors: [],
      });
      setChecked(true);
    }

    setChecking(false);
  }, [userInput, sentence, card, checking]);

  const handleRate = useCallback(async (quality: number) => {
    if (!card || submitting) return;
    setSubmitting(true);

    await fetch("/api/grammar/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grammarCardId: card.id, quality }),
    });

    setReviewedCount((c) => c + 1);
    setTotalRatings((c) => c + 1);
    if (quality > 0) setCorrectCount((c) => c + 1);
    setSubmitting(false);
    await fetchNextCard();
  }, [card, submitting, fetchNextCard]);

  // Seed on first visit
  useEffect(() => {
    async function init() {
      const res = await fetch("/api/grammar/cards");
      const data = await res.json();
      if (data.count === 0) {
        await fetch("/api/grammar/cards", { method: "POST" });
      }
      setSeeded(true);
      await fetchNextCard();
    }
    init();
  }, [fetchNextCard]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in input
      if (!checked && (e.target as HTMLElement)?.tagName === "INPUT") return;

      if (checked && !submitting) {
        if (e.key === "1") handleRate(5);
        else if (e.key === "2") handleRate(3);
        else if (e.key === "3") handleRate(0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [checked, submitting, handleRate]);

  // Celebration
  useEffect(() => {
    if (dueCount === 0 && reviewedCount > 0 && !celebrationShown && !loading) {
      setShowCelebration(true);
      setCelebrationShown(true);
    }
  }, [dueCount, reviewedCount, celebrationShown, loading]);

  const totalCards = initialDue !== null
    ? Math.max(initialDue, reviewedCount + dueCount)
    : reviewedCount + dueCount;

  if (loading && !seeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Loading grammar cards...</p>
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
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {loading && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600 mb-3"></div>
            <p className="text-gray-500 text-sm">Generating sentence...</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center space-y-3">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchNextCard}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        )}

        {!card && !loading && !error && (
          <p className="text-gray-500">No grammar cards available. Seed the database first.</p>
        )}

        {card && sentence && !loading && !error && !checked && (
          <GrammarCard
            displayTitle={card.display_title}
            caseName={card.case_name}
            englishSentence={sentence.english}
            userInput={userInput}
            onInputChange={setUserInput}
            onSubmit={handleSubmitAnswer}
            disabled={checking}
          />
        )}

        {card && sentence && checked && checkResult && (
          <GrammarFeedback
            correct={checkResult.correct}
            caseName={card.case_name}
            englishSentence={sentence.english}
            correctPolish={sentence.correct_polish}
            userAnswer={userInput}
            highlightedWords={sentence.highlighted_words}
            userErrors={checkResult.user_errors}
            feedback={checkResult.feedback}
            grammarReminder={sentence.grammar_reminder}
            onRate={handleRate}
            disabled={submitting}
          />
        )}
      </div>
    </div>
  );
}
