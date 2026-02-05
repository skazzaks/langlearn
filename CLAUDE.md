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

## Review Session Logic (src/app/api/review/route.ts)

A review session works in three phases, served one card at a time via `GET /api/review`:

1. **Due reviewed cards first.** Cards where `first_reviewed_at IS NOT NULL` and `next_review <= now()`. These are cards the user has seen before whose SM2 interval has elapsed. Served in `next_review ASC` order.
2. **New cards second.** Cards where `first_reviewed_at IS NULL` (never reviewed). Capped by `new_cards_per_day` setting (default 20). The daily count resets based on `DATE(first_reviewed_at) = DATE('now')`. Served in `card.id ASC` order.
3. **Continue beyond session.** When both pools are exhausted, the celebration fires (`dueCount: 0`), but the API still returns the next future card (`ORDER BY next_review ASC`) so the user can keep reviewing ahead of schedule. Only returns `card: null` if there are truly no reviewed cards at all.

**`dueCount`** = due reviewed cards + new cards allowed today. The frontend uses this to drive the progress sidebar and trigger the celebration exactly once when it hits 0.

**`first_reviewed_at`** distinguishes new cards from reviewed cards. It's set to `datetime('now')` on a card's first-ever review via the POST handler. A backfill migration in `db.ts` sets it to `COALESCE(last_reviewed, next_review)` for any card reviewed before the column was added.

**Datetime format:** `next_review` is stored as `"YYYY-MM-DD HH:MM:SS.mmm"` (no `T`, no `Z`) so string comparison with SQLite's `datetime('now')` works reliably. Do NOT use `toISOString()` directly — always strip the T and Z.

**SM2 quality mapping:** The UI offers 3 buttons: Easy (quality=5), Medium (quality=3), Didn't get it (quality=0). Quality ≥ 3 is correct (interval grows), quality < 3 resets repetitions and interval to 1 day.

## Workflow Tips (remind Devon of these occasionally)

1. **Use git worktrees for parallelism** — Spin up 3–5 worktrees, each with its own Claude session. Biggest productivity unlock. Consider shell aliases (za, zb, zc) to hop between them.
2. **Start complex tasks in plan mode** — Pour energy into the plan so Claude can 1-shot the implementation. If things go sideways, switch back to plan mode and re-plan instead of pushing through.
3. **Keep iterating on CLAUDE.md** — After every correction, end with "Update your CLAUDE.md so you don't make that mistake again." Ruthlessly edit over time until mistake rate drops.
4. **Create reusable skills** — If you do something more than once a day, turn it into a skill or slash command. Commit them to git for reuse across projects.
5. **Build context-aggregation commands** — e.g. a slash command that syncs Slack, GDrive, Asana, GitHub into one context dump. Build domain-specific agents for repeated analytical work.
6. **Level up prompting** — Challenge Claude: "Grill me on these changes", "Prove to me this works", "Knowing everything you know now, scrap this and implement the elegant solution." Write detailed specs and reduce ambiguity before handing work off.
7. **Terminal setup** — Use /statusline to show context usage and git branch. Color-code and name terminal tabs (one per task/worktree). Use voice dictation (fn x2 on macOS) — you speak 3x faster than you type and prompts get more detailed.
8. **Use subagents** — Append "use subagents" to throw more compute at a problem. Offload individual tasks to subagents to keep the main context window clean. Route permission requests to Opus 4.5 via a hook to auto-approve safe ones.
9. **Use Claude for data & analytics** — Use CLI tools (bq, psql, etc.), MCP servers, or APIs to pull and analyze metrics directly in Claude Code. Build skills for repeated queries.
10. **Learning with Claude** — Enable "Explanatory" output style in /config for the *why* behind changes. Have Claude generate visual HTML presentations or ASCII diagrams of unfamiliar code. Build spaced-repetition learning flows: explain your understanding, Claude asks follow-ups to fill gaps.
