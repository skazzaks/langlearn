"use client";

import { useRef, useState } from "react";

interface MinimalPairCardProps {
  wordId: number;
  polishWord: string;
  englishWord: string;
  soundA: string;
  soundB: string;
  correctSound: string;
  audioPath: string | null;
  revealed: boolean;
  onReveal: () => void;
}

export default function MinimalPairCard({
  wordId,
  polishWord,
  englishWord,
  soundA,
  soundB,
  correctSound,
  audioPath: initialAudioPath,
  revealed,
  onReveal,
}: MinimalPairCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPath, setAudioPath] = useState(initialAudioPath);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const correctSoundLabel = correctSound === "a" ? soundA : soundB;

  async function handlePlay(e: React.MouseEvent) {
    e.stopPropagation();

    if (audioPath) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    setLoadingAudio(true);
    try {
      const res = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minimalPairWordId: wordId, polishWord }),
      });
      const data = await res.json();
      if (data.audioPath) {
        setAudioPath(data.audioPath);
        const audio = new Audio(data.audioPath);
        audio.play();
      }
    } finally {
      setLoadingAudio(false);
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div
        className="bg-white rounded-2xl shadow-lg p-8 min-h-[320px] flex flex-col items-center justify-center cursor-pointer select-none"
        onClick={!revealed ? onReveal : undefined}
      >
        <p className="text-2xl font-bold text-gray-900 mb-6">
          <span className="text-blue-600">{soundA}</span>
          {" "}vs{" "}
          <span className="text-purple-600">{soundB}</span>
        </p>

        {audioPath && <audio ref={audioRef} src={audioPath} />}
        <button
          onClick={handlePlay}
          disabled={loadingAudio}
          className="mb-6 px-6 py-3 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition text-sm font-medium disabled:opacity-50"
        >
          {loadingAudio ? "Loading..." : "Play Word"}
        </button>

        {!revealed && (
          <p className="text-sm text-gray-400 mt-4">Tap to reveal</p>
        )}

        {revealed && (
          <div className="mt-4 w-full border-t pt-4 text-center">
            <p className="text-lg text-green-700 font-semibold mb-2">
              This word has: <span className="text-xl">{correctSoundLabel}</span>
            </p>
            <p className="text-3xl font-bold text-gray-900 mb-1">{polishWord}</p>
            <p className="text-gray-500">&ldquo;{englishWord}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}
