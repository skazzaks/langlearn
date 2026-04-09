"use client";

import { useRef, useEffect } from "react";

// Polish case questions - the key question each case answers
const CASE_QUESTIONS: Record<string, { polish: string; english: string }> = {
  Nominative: { polish: "Kto? Co?", english: "Who? What?" },
  Genitive: { polish: "Kogo? Czego?", english: "Whose? Of what?" },
  Dative: { polish: "Komu? Czemu?", english: "To whom? To what?" },
  Accusative: { polish: "Kogo? Co?", english: "Whom? What?" },
  Instrumental: { polish: "Z kim? Z czym?", english: "With whom? With what?" },
  Locative: { polish: "O kim? O czym?", english: "About whom? About what?" },
  Vocative: { polish: "O!", english: "Hey...!" },
};

interface GrammarCardProps {
  displayTitle: string;
  caseName: string;
  englishSentence: string;
  userInput: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

export default function GrammarCard({
  displayTitle,
  caseName,
  englishSentence,
  userInput,
  onInputChange,
  onSubmit,
  disabled,
}: GrammarCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caseQuestion = CASE_QUESTIONS[caseName];

  useEffect(() => {
    inputRef.current?.focus();
  }, [englishSentence]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        {/* Pattern badge */}
        <div className="mb-3">
          <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
            {displayTitle}
          </span>
        </div>

        {/* Case question prompt */}
        {caseQuestion && (
          <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-lg font-bold text-amber-800 text-center">
              {caseQuestion.polish}
            </p>
            <p className="text-xs text-amber-600 text-center mt-0.5">
              {caseQuestion.english}
            </p>
          </div>
        )}

        {/* English sentence */}
        <p className="text-lg font-medium text-gray-900 mb-6">
          {englishSentence}
        </p>

        {/* Polish input */}
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && userInput.trim() && !disabled) {
                onSubmit();
              }
            }}
            placeholder="Type the Polish translation..."
            disabled={disabled}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button
            onClick={onSubmit}
            disabled={disabled || !userInput.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disabled ? "Checking..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
