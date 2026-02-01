import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generateAudio } from "@/lib/tts";

export async function POST(request: NextRequest) {
  const { polishWord } = await request.json();

  const audioPath = await generateAudio(polishWord);
  if (audioPath) {
    db.prepare("UPDATE cards SET audio_path = ? WHERE polish_word = ?").run(audioPath, polishWord);
  }

  return NextResponse.json({ audioPath });
}
