"use client";

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

interface HighlightedWord {
  word: string;
  base_form: string;
  ending: string;
}

interface UserError {
  word: string;
  issue: string;
}

interface GrammarFeedbackProps {
  correct: boolean;
  caseName: string;
  englishSentence: string;
  correctPolish: string;
  userAnswer: string;
  highlightedWords: HighlightedWord[];
  userErrors: UserError[];
  feedback: string | null;
  grammarReminder: string;
  onRate: (quality: number) => void;
  disabled: boolean;
}

function highlightEndings(sentence: string, words: HighlightedWord[]) {
  const tokens = sentence.split(/\s+/);
  const highlightMap = new Map<string, HighlightedWord>();
  for (const w of words) {
    highlightMap.set(w.word.toLowerCase(), w);
  }

  return tokens.map((token, i) => {
    const cleanToken = token.replace(/[.,!?;:]+$/, "");
    const punctuation = token.slice(cleanToken.length);
    const hw = highlightMap.get(cleanToken.toLowerCase());

    if (hw && hw.ending && cleanToken.toLowerCase().endsWith(hw.ending.toLowerCase())) {
      const stem = cleanToken.slice(0, cleanToken.length - hw.ending.length);
      return (
        <span key={i}>
          {i > 0 && " "}
          {stem}
          <span className="text-blue-600 font-bold">{cleanToken.slice(stem.length)}</span>
          {punctuation}
        </span>
      );
    }

    return (
      <span key={i}>
        {i > 0 && " "}
        {token}
      </span>
    );
  });
}

function highlightAnswer(userAnswer: string, errors: UserError[]) {
  const tokens = userAnswer.split(/\s+/);
  const errorSet = new Set(errors.map(e => e.word.toLowerCase()));

  return tokens.map((token, i) => {
    const cleanToken = token.replace(/[.,!?;:]+$/, "");
    const isError = errorSet.has(cleanToken.toLowerCase());

    return (
      <span
        key={i}
        className={isError ? "text-red-600 font-bold" : "text-emerald-700 font-semibold"}
      >
        {i > 0 && " "}
        {token}
      </span>
    );
  });
}

export default function GrammarFeedback({
  correct,
  caseName,
  englishSentence,
  correctPolish,
  userAnswer,
  highlightedWords,
  userErrors,
  feedback,
  grammarReminder,
  onRate,
  disabled,
}: GrammarFeedbackProps) {
  const caseQuestion = CASE_QUESTIONS[caseName];

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* Correct/Incorrect banner */}
      <div
        className={`rounded-lg px-4 py-3 text-center font-semibold ${
          correct
            ? "bg-green-100 text-green-800 border border-green-300"
            : "bg-red-100 text-red-800 border border-red-300"
        }`}
      >
        {correct ? "Correct!" : "Not quite right"}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 space-y-4">
        {/* Case question reminder */}
        {caseQuestion && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="font-semibold text-amber-700">{caseName}:</span>
            <span className="text-amber-600">{caseQuestion.polish}</span>
            <span className="text-gray-400">({caseQuestion.english})</span>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Original question</p>
          <p className="text-base text-gray-900">{englishSentence}</p>
        </div>

        {/* Correct Polish with highlighted endings */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Correct answer</p>
          <p className="text-base text-gray-900">
            {highlightEndings(correctPolish, highlightedWords)}
          </p>
        </div>

        {/* User's answer with correctness highlighting */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Your answer</p>
          <p className="text-base text-gray-900">
            {highlightAnswer(userAnswer, userErrors)}
          </p>
        </div>

        {/* Error explanations */}
        {!correct && userErrors.length > 0 && (
          <div className="text-sm text-gray-700 space-y-1">
            {userErrors.map((err, i) => (
              <p key={i}>
                <span className="font-medium text-red-600">{err.word}</span>: {err.issue}
              </p>
            ))}
          </div>
        )}

        {/* Feedback from Claude */}
        {feedback && !correct && (
          <p className="text-sm text-gray-600 italic">{feedback}</p>
        )}

        {/* Grammar reminder */}
        {grammarReminder && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Grammar rule</p>
            <p className="text-sm text-amber-900">{grammarReminder}</p>
          </div>
        )}
      </div>

      {/* Rating buttons */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => onRate(5)}
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-green-100 text-green-700 text-sm font-semibold hover:bg-green-200 transition disabled:opacity-50"
        >
          1 Easy
        </button>
        <button
          onClick={() => onRate(3)}
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-yellow-100 text-yellow-700 text-sm font-semibold hover:bg-yellow-200 transition disabled:opacity-50"
        >
          2 Medium
        </button>
        <button
          onClick={() => onRate(0)}
          disabled={disabled}
          className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-semibold hover:bg-red-200 transition disabled:opacity-50"
        >
          3 Didn&apos;t get it
        </button>
      </div>
    </div>
  );
}
