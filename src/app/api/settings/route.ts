import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

interface SettingRow {
  key: string;
  value: string;
}

export async function GET() {
  const rows = db.prepare("SELECT key, value FROM settings").all() as SettingRow[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  const { key, value } = await request.json();

  if (!key || value === undefined) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }

  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, String(value));

  return NextResponse.json({ success: true });
}
