import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST() {
  // Get the new_cards_per_day setting
  const newCardsPerDay = Number(
    (db.prepare("SELECT value FROM settings WHERE key = 'new_cards_per_day'").get() as { value: string } | undefined)?.value ?? "20"
  );

  const todayStr = new Date().toISOString().split("T")[0];

  // Check current bonus date
  const bonusDate = (db.prepare("SELECT value FROM settings WHERE key = 'vocab_bonus_cards_date'").get() as { value: string } | undefined)?.value;

  if (bonusDate === todayStr) {
    // Add to existing bonus
    const currentBonus = Number(
      (db.prepare("SELECT value FROM settings WHERE key = 'vocab_bonus_cards_count'").get() as { value: string } | undefined)?.value ?? "0"
    );
    const newBonus = currentBonus + newCardsPerDay;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("vocab_bonus_cards_count", String(newBonus));
  } else {
    // New day, reset bonus
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("vocab_bonus_cards_date", todayStr);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("vocab_bonus_cards_count", String(newCardsPerDay));
  }

  return NextResponse.json({ success: true, added: newCardsPerDay });
}
