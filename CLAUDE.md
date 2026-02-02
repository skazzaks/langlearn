# LangLearn - Project Notes

## ElevenLabs TTS (src/lib/tts.ts)

- The voice is Rachel (`21m00Tcm4TlvDq8ikWAM`). Do NOT change the voice ID to try to fix Polish pronunciation — switching to a different voice (e.g. a native Polish voice like Agata HQ) was tried and did not work.
- Instead, force Polish pronunciation by using the `language_code: "pl"` parameter combined with Polish-language `previous_text` and `next_text` context strings to prime the model into Polish mode. The surrounding Polish text prevents the model from falling back to English pronunciation for words that look like English (e.g. "piec").
- Audio files are cached in `public/audio/`. If you change TTS settings, you must delete the cached mp3 files for the changes to take effect.
- The database column `minimal_pair_words.audio_path` also caches paths — set it to NULL when regenerating audio.

## Card Generation (src/lib/generate-cards.ts)

- After generating sentences via Claude API, each sentence is validated:
  1. Check that the sentence contains the exact target word (not a different case/conjugation)
  2. Check that the sentence is grammatically correct Polish
  3. If either check fails, the sentence is regenerated (up to 2 retries)
- This prevents issues like "pomogę mnie" where Claude forces the target word into a grammatically incorrect position.
- The initial prompt also explicitly instructs Claude to include the exact word form and use correct grammar.
