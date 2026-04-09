import db from "@/lib/db";

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function getBooleanSetting(key: string, defaultValue = false): boolean {
  const value = getSetting(key);
  if (value === null) return defaultValue;
  return value === "true" || value === "1";
}
