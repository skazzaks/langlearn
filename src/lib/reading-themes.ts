export const READING_THEMES = [
  {
    key: "culture",
    label: "Polish culture",
    description: "Food, people, and traditions in Poland.",
  },
  {
    key: "geography",
    label: "Polish geography",
    description: "Regions, cities, and important places in Poland.",
  },
  {
    key: "history",
    label: "Polish history",
    description: "Important events and periods in Poland's past.",
  },
  {
    key: "dialog",
    label: "Everyday dialog",
    description: "Short back-and-forth dialog (e.g., restaurant).",
  },
  {
    key: "story",
    label: "Short story",
    description: "A quick fiction story.",
  },
  {
    key: "news",
    label: "Simple news",
    description: "Latest news about a world event.",
  },
] as const;

export type ReadingThemeKey = (typeof READING_THEMES)[number]["key"];

export const DEFAULT_READING_THEMES: ReadingThemeKey[] = READING_THEMES.map(
  (theme) => theme.key
);

export function normalizeReadingThemes(
  themes: unknown
): ReadingThemeKey[] {
  if (!Array.isArray(themes)) {
    return DEFAULT_READING_THEMES;
  }
  const allowed = new Set(READING_THEMES.map((t) => t.key));
  const normalized = themes
    .map((t) => String(t))
    .filter((t): t is ReadingThemeKey => allowed.has(t as ReadingThemeKey));
  return normalized.length > 0 ? normalized : DEFAULT_READING_THEMES;
}

export function themeLabels(keys: ReadingThemeKey[]): string[] {
  const byKey = new Map(READING_THEMES.map((t) => [t.key, t.label]));
  return keys.map((k) => byKey.get(k) ?? k);
}
