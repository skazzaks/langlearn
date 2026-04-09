import { NextResponse } from "next/server";
import db from "@/lib/db";
import { seedGrammar } from "@/lib/seed-grammar";

export async function GET() {
  const result = db.prepare("SELECT COUNT(*) as count FROM grammar_cards").get() as { count: number };
  return NextResponse.json({ count: result.count });
}

export async function POST() {
  const result = seedGrammar();
  return NextResponse.json(result);
}
