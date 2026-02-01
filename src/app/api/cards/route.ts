import { NextResponse } from "next/server";
import db from "@/lib/db";
import { seedCards } from "@/lib/seed";

export async function GET() {
  const cards = db.prepare("SELECT * FROM cards ORDER BY id").all();
  return NextResponse.json(cards);
}

export async function POST() {
  // Trigger seeding
  const result = await seedCards();
  return NextResponse.json(result);
}
