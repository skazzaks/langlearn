import { NextResponse } from "next/server";
import db from "@/lib/db";
import { seedMinimalPairs } from "@/lib/seed-minimal-pairs";

export async function GET() {
  const result = db.prepare("SELECT COUNT(*) as count FROM minimal_pair_words").get() as { count: number };
  return NextResponse.json({ count: result.count });
}

export async function POST() {
  const result = seedMinimalPairs();
  return NextResponse.json(result);
}
