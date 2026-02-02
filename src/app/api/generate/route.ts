import { NextRequest, NextResponse } from "next/server";
import { generateCards, getQueueStats } from "@/lib/generate-cards";

export async function GET() {
  const stats = getQueueStats();
  return NextResponse.json(stats);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const count = Math.min(Math.max(Number(body.count) || 1, 1), 100);

  const result = await generateCards(count);
  return NextResponse.json(result);
}
