"use client";

import { useEffect, useState } from "react";

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Celebration({ onDismiss }: { onDismiss: () => void }) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 50; i++) {
      pieces.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 6,
      });
    }
    setConfetti(pieces);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 cursor-pointer"
      onClick={onDismiss}
    >
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((piece) => (
          <div
            key={piece.id}
            className="absolute -top-4 animate-confetti"
            style={{
              left: `${piece.left}%`,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
            }}
          >
            <div
              className="rounded-sm animate-spin"
              style={{
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                animationDuration: `${0.5 + Math.random()}s`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Message */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 mx-4 text-center animate-bounce-in">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Amazing work!
        </h2>
        <p className="text-gray-600 mb-4">
          You finished all your cards for today!
        </p>
        <p className="text-4xl mb-4">🐇🥕</p>
        <p className="text-sm text-gray-400">Tap anywhere to continue</p>
      </div>
    </div>
  );
}
