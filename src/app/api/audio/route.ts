import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generateAudio, generateSentenceAudio } from "@/lib/tts";

export async function POST(request: NextRequest) {
  const { polishWord, cardId, sentence } = await request.json();

  if (cardId && sentence) {
    const sentenceAudioPath = await generateSentenceAudio(sentence);
    if (sentenceAudioPath) {
      db.prepare("UPDATE cards SET sentence_audio_path = ? WHERE id = ?").run(sentenceAudioPath, cardId);
    }
    return NextResponse.json({ sentenceAudioPath });
  }

  const audioPath = await generateAudio(polishWord);
  if (audioPath) {
    db.prepare("UPDATE cards SET audio_path = ? WHERE polish_word = ?").run(audioPath, polishWord);
  }

  return NextResponse.json({ audioPath });
}
