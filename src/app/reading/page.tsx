"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { READING_THEMES, type ReadingThemeKey } from "@/lib/reading-themes";

interface ReadingStory {
  id: number;
  themes: string[];
  content_pl: string;
  questions_pl: string[];
  created_at: string;
}

interface GradeResult {
  correct: boolean;
  feedback_en: string;
  corrected_pl: string;
  score_reason: string;
}

interface ReadingStats {
  reviewedTotal: number;
  baseTotal: number;
  allowedTotal: number;
  storyUniqueTokens: number;
  storyReviewedTokens: number;
  storyReviewedPercent: number;
}

interface TextPart {
  text: string;
  isWord: boolean;
}

function splitText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const regex = /[\p{L}]+(?:-[\p{L}]+)*/gu;
  let lastIndex = 0;
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), isWord: false });
    }
    parts.push({ text: match[0], isWord: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isWord: false });
  }
  return parts;
}

function normalizeToken(token: string) {
  return token.toLowerCase();
}

export default function ReadingPage() {
  const [story, setStory] = useState<ReadingStory | null>(null);
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingNext, setLoadingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<Record<string, string>>({});
  const [loadingDefinitions, setLoadingDefinitions] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<string[]>([]);
  const [grading, setGrading] = useState(false);
  const [gradeResults, setGradeResults] = useState<GradeResult[] | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const fetchStory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reading", { method: "POST" });
      const data = await res.json();
      setStory(data.story);
      setStats(data.stats ?? null);
      setAnswers(data.story?.questions_pl?.map(() => "") ?? []);
      setGradeResults(null);
      setGradeError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNext = async () => {
    setLoadingNext(true);
    setError(null);
    try {
      const res = await fetch("/api/reading", { method: "POST" });
      const data = await res.json();
      setStory(data.story);
      setStats(data.stats ?? null);
      setAnswers(data.story?.questions_pl?.map(() => "") ?? []);
      setGradeResults(null);
      setGradeError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingNext(false);
    }
  };

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  const paragraphs = useMemo(() => {
    if (!story?.content_pl) return [];
    return story.content_pl
      .split(/\n\s*\n/g)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [story]);

  const themeLabels = useMemo(() => {
    if (!story?.themes) return [];
    const map = new Map(READING_THEMES.map((t) => [t.key, t.label]));
    return story.themes.map((t: string) => map.get(t as ReadingThemeKey) ?? t);
  }, [story]);

  const requestDefinition = useCallback(
    async (token: string) => {
      const normalized = normalizeToken(token);
      if (definitions[normalized] || loadingDefinitions[normalized]) return;
      setLoadingDefinitions((prev) => ({ ...prev, [normalized]: true }));
      try {
        const res = await fetch("/api/reading/define", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: normalized }),
        });
        const data = await res.json();
        if (data.definition) {
          setDefinitions((prev) => ({ ...prev, [normalized]: data.definition }));
        }
      } finally {
        setLoadingDefinitions((prev) => ({ ...prev, [normalized]: false }));
      }
    },
    [definitions, loadingDefinitions]
  );

  const handleAnswerChange = (index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setGradeResults(null);
    setGradeError(null);
  };

  const handleGrade = async () => {
    if (!story) return;
    setGrading(true);
    setGradeError(null);
    try {
      const res = await fetch("/api/reading/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: story.id,
          questions: story.questions_pl,
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGradeError(data?.error ?? "Could not grade answers");
        setGradeResults(null);
      } else {
        setGradeResults(data.results ?? null);
      }
    } catch (err) {
      setGradeError((err as Error).message);
    } finally {
      setGrading(false);
    }
  };

  const renderTextWithDefinitions = (text: string) =>
    splitText(text).map((part, partIndex) => {
      if (!part.isWord) {
        return <span key={partIndex}>{part.text}</span>;
      }
      const normalized = normalizeToken(part.text);
      const definition = definitions[normalized];
      const isLoading = loadingDefinitions[normalized];
      const isHovered = hoveredToken === normalized;
      return (
        <span
          key={partIndex}
          className="relative inline-block cursor-help underline decoration-dotted decoration-gray-400"
          onMouseEnter={() => {
            setHoveredToken(normalized);
            requestDefinition(part.text);
          }}
          onMouseLeave={() => setHoveredToken(null)}
        >
          {part.text}
          {isHovered && (
            <span className="pointer-events-none absolute z-10 -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
              {isLoading ? "Loading..." : definition || "unknown"}
            </span>
          )}
        </span>
      );
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Generating reading text...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-600 text-sm">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Reading</h1>
              {themeLabels.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Themes: {themeLabels.join(", ")}
                </p>
              )}
              {stats && (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5">
                    Reviewed in story: {stats.storyReviewedTokens}/{stats.storyUniqueTokens} ({stats.storyReviewedPercent}%)
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5">
                    Allowed vocab: {stats.allowedTotal} (Reviewed {stats.reviewedTotal}, Base {stats.baseTotal})
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleNext}
              disabled={loadingNext}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingNext ? "Generating…" : "Next"}
            </button>
          </div>

          {!story ? (
            <p className="text-gray-500">No story available.</p>
          ) : (
            <>
              <div className="space-y-3 text-gray-800 text-base leading-relaxed">
                {paragraphs.map((paragraph, index) => (
                  <p key={index}>{renderTextWithDefinitions(paragraph)}</p>
                ))}
              </div>

              <div className="mt-6 border-t pt-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">
                  Pytania sprawdzajace
                </h2>
                <div className="space-y-4 text-sm text-gray-700">
                  {story.questions_pl.map((q, i) => (
                    <div key={i} className="space-y-2">
                      <p className="font-medium text-gray-800">
                        {renderTextWithDefinitions(q)}
                      </p>
                      <textarea
                        rows={3}
                        value={answers[i] ?? ""}
                        onChange={(e) => handleAnswerChange(i, e.target.value)}
                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                        placeholder="Odpowiedz po polsku..."
                      />
                      {gradeResults?.[i] && (
                        <div className={`rounded border px-3 py-2 text-xs ${
                          gradeResults[i].correct
                            ? "border-green-400 bg-green-50 text-green-800"
                            : "border-red-400 bg-red-50 text-red-800"
                        }`}>
                          <p className="font-semibold">
                            {gradeResults[i].correct ? "Correct" : "Incorrect"}
                          </p>
                          {gradeResults[i].corrected_pl && (
                            <p className="mt-1 text-gray-800">
                              <span className="font-medium">Corrected:</span>{" "}
                              {gradeResults[i].corrected_pl}
                            </p>
                          )}
                          <p className="mt-1 text-gray-700">
                            {gradeResults[i].feedback_en}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {gradeError && (
                  <p className="mt-3 text-xs text-red-600">{gradeError}</p>
                )}
                <button
                  onClick={handleGrade}
                  disabled={grading}
                  className="mt-3 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {grading ? "Checking..." : "Check answers"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
