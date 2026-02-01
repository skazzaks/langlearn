import fs from "fs";
import path from "path";

const AUDIO_DIR = path.join(process.cwd(), "public", "audio");

export async function generateAudio(polishWord: string, exampleSentence?: string): Promise<string> {
  const safeName = polishWord.replace(/\s+/g, "_").toLowerCase();
  const fileName = `${safeName}.mp3`;
  const filePath = path.join(AUDIO_DIR, fileName);
  const publicPath = `/audio/${fileName}`;

  // Return cached file if it exists
  if (fs.existsSync(filePath)) {
    return publicPath;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("ELEVENLABS_API_KEY not set, skipping audio generation");
    return "";
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // default: Rachel

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: polishWord,
        model_id: "eleven_multilingual_v2",
        language_code: "pl",
        previous_text: exampleSentence || "",
        voice_settings: { stability: 0.7, similarity_boost: 0.75, speed: 0.85 },
      }),
    }
  );

  if (!res.ok) {
    console.error(`ElevenLabs API error: ${res.status}`);
    return "";
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.writeFileSync(filePath, buffer);

  return publicPath;
}

export async function generateSentenceAudio(sentence: string): Promise<string> {
  const safeName = sentence.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 80);
  const fileName = `sentence_${safeName}.mp3`;
  const filePath = path.join(AUDIO_DIR, fileName);
  const publicPath = `/audio/${fileName}`;

  if (fs.existsSync(filePath)) {
    return publicPath;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("ELEVENLABS_API_KEY not set, skipping sentence audio generation");
    return "";
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: sentence,
        model_id: "eleven_multilingual_v2",
        language_code: "pl",
        voice_settings: { stability: 0.7, similarity_boost: 0.75, speed: 0.85 },
      }),
    }
  );

  if (!res.ok) {
    console.error(`ElevenLabs API error (sentence): ${res.status}`);
    return "";
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.writeFileSync(filePath, buffer);

  return publicPath;
}
