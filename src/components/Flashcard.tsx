"use client";

import { useRef, useState, useMemo } from "react";

interface FlashcardProps {
  cardId: number;
  polishWord: string;
  englishWord: string;
  pronunciation: string;
  exampleSentencePl: string;
  exampleSentenceEn: string;
  audioPath: string;
  sentenceAudioPath?: string;
  nextReview: string;
  revealed: boolean;
  onReveal: () => void;
}

export default function Flashcard({
  cardId,
  polishWord,
  englishWord,
  pronunciation,
  exampleSentencePl,
  exampleSentenceEn,
  audioPath,
  sentenceAudioPath: initialSentenceAudioPath,
  nextReview,
  revealed,
  onReveal,
}: FlashcardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const sentenceAudioRef = useRef<HTMLAudioElement>(null);
  const [sentenceAudioPath, setSentenceAudioPath] = useState(initialSentenceAudioPath);
  const [loadingSentenceAudio, setLoadingSentenceAudio] = useState(false);

  const dueLabel = useMemo(() => {
    const normalized = nextReview.endsWith("Z") ? nextReview : nextReview.replace(" ", "T") + "Z";
    const due = new Date(normalized).getTime();
    if (isNaN(due)) return "Due now";
    const diffMs = due - Date.now();
    if (diffMs <= 0) return "Due now";
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return `Due in ${Math.ceil(diffHours * 60)}m`;
    if (diffHours < 24) return `Due in ${Math.round(diffHours)}h`;
    const diffDays = Math.round(diffHours / 24);
    return `Due in ${diffDays}d`;
  }, [nextReview]);

  function playAudio() {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div
        className="bg-white rounded-2xl shadow-lg p-8 min-h-[320px] flex flex-col items-center justify-center cursor-pointer select-none"
        onClick={!revealed ? onReveal : undefined}
      >
        <p className="text-5xl font-bold text-gray-900 mb-3">{polishWord}</p>
        <p className="text-lg text-gray-400 mb-2">{pronunciation}</p>
        <p className="text-xs text-gray-400 mb-4">{dueLabel}</p>

        {audioPath && (
          <>
            <audio ref={audioRef} src={audioPath} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                playAudio();
              }}
              className="mb-6 px-4 py-2 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition text-sm font-medium"
            >
              &#9654; Play Audio
            </button>
          </>
        )}

        {!revealed && (
          <p className="text-sm text-gray-400 mt-4">Tap to reveal</p>
        )}

        {revealed && (
          <div className="mt-4 w-full border-t pt-4 text-center">
            <p className="text-2xl font-semibold text-gray-800 mb-3">
              {englishWord}
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <p className="text-gray-700 italic">
                {exampleSentencePl}
                {sentenceAudioPath && (
                  <audio ref={sentenceAudioRef} src={sentenceAudioPath} />
                )}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (sentenceAudioPath) {
                      if (sentenceAudioRef.current) {
                        sentenceAudioRef.current.currentTime = 0;
                        sentenceAudioRef.current.play();
                      }
                      return;
                    }
                    setLoadingSentenceAudio(true);
                    try {
                      const res = await fetch("/api/audio", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ cardId, sentence: exampleSentencePl }),
                      });
                      const data = await res.json();
                      if (data.sentenceAudioPath) {
                        setSentenceAudioPath(data.sentenceAudioPath);
                        const audio = new Audio(data.sentenceAudioPath);
                        audio.play();
                      }
                    } finally {
                      setLoadingSentenceAudio(false);
                    }
                  }}
                  disabled={loadingSentenceAudio}
                  className="inline-flex items-center ml-2 text-blue-500 hover:text-blue-700 transition disabled:opacity-50"
                  title="Play sentence audio"
                >
                  {loadingSentenceAudio ? "⏳" : "🔊"}
                </button>
              </p>
              <p className="text-gray-500 text-sm mt-1">{exampleSentenceEn}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
