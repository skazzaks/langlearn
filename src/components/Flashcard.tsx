"use client";

import { useRef, useState, useMemo, useEffect, useImperativeHandle, forwardRef } from "react";

interface Sentence {
  id: number;
  difficulty: string;
  sentence_pl: string;
  sentence_en: string;
  audio_path: string | null;
}

interface FlashcardProps {
  cardId: number;
  polishWord: string;
  englishWord: string;
  pronunciation: string;
  notes: string | null;
  sentences: Sentence[];
  audioPath: string;
  nextReview: string;
  revealed: boolean;
  onReveal: () => void;
}

const difficultyConfig: Record<string, { label: string; color: string; dot: string }> = {
  easy: { label: "Easy", color: "text-green-600", dot: "bg-green-500" },
  medium: { label: "Medium", color: "text-yellow-600", dot: "bg-yellow-500" },
  hard: { label: "Hard", color: "text-red-600", dot: "bg-red-500" },
};

function SentenceBlock({ sentence }: { sentence: Sentence }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPath, setAudioPath] = useState(sentence.audio_path);
  const [loading, setLoading] = useState(false);

  const config = difficultyConfig[sentence.difficulty] || difficultyConfig.easy;

  async function handlePlay(e: React.MouseEvent) {
    e.stopPropagation();
    if (audioPath) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentenceId: sentence.id, sentence: sentence.sentence_pl }),
      });
      const data = await res.json();
      if (data.sentenceAudioPath) {
        setAudioPath(data.sentenceAudioPath);
        const audio = new Audio(data.sentenceAudioPath);
        audio.play();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
        <span className={`text-xs font-semibold uppercase ${config.color}`}>{config.label}</span>
      </div>
      <p className="text-gray-700 italic">
        {sentence.sentence_pl}
        {audioPath && <audio ref={audioRef} src={audioPath} />}
        <button
          onClick={handlePlay}
          disabled={loading}
          className="inline-flex items-center ml-2 text-blue-500 hover:text-blue-700 transition disabled:opacity-50"
          title="Play sentence audio"
        >
          {loading ? "\u23F3" : "\uD83D\uDD0A"}
        </button>
      </p>
      <p className="text-gray-500 text-sm mt-0.5">{sentence.sentence_en}</p>
    </div>
  );
}

export interface FlashcardHandle {
  playAudio: () => void;
}

const Flashcard = forwardRef<FlashcardHandle, FlashcardProps>(function Flashcard({
  polishWord,
  englishWord,
  pronunciation,
  notes,
  sentences,
  audioPath,
  nextReview,
  revealed,
  onReveal,
}, ref) {
  const audioRef = useRef<HTMLAudioElement>(null);

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

  useImperativeHandle(ref, () => ({ playAudio }));

  useEffect(() => {
    if (audioPath && audioRef.current) {
      audioRef.current.play();
    }
  }, [audioPath]);

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
          <div className="mt-4 w-full border-t pt-4">
            <p className="text-2xl font-semibold text-gray-800 mb-4 text-center">
              {englishWord}
            </p>
            <div className="bg-gray-50 rounded-lg p-4">
              {sentences.map((s) => (
                <SentenceBlock key={s.id} sentence={s} />
              ))}
            </div>
            {notes && (
              <div className="mt-4 bg-amber-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">{"\uD83D\uDCDD"} Notes</p>
                <p className="text-sm text-amber-900">{notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default Flashcard;
