import { NextResponse } from "next/server";
import {
  getLatestReadingStory,
  getReadingStatsForStory,
  getOrCreateReadingStory,
  getSelectedReadingThemes,
  pickThemeForRequest,
} from "@/lib/reading";

export async function GET() {
  const story = getLatestReadingStory();
  const stats = story ? getReadingStatsForStory(story.content_pl) : null;
  return NextResponse.json({ story, stats });
}

export async function POST() {
  const themes = getSelectedReadingThemes();
  const theme = pickThemeForRequest(themes);
  const story = await getOrCreateReadingStory(theme);
  const stats = getReadingStatsForStory(story.content_pl);
  return NextResponse.json({ story, stats });
}
