import db from "./db";
import frequencyList from "../../data/polish-frequency-50000.json";

const existing = (db.prepare("SELECT COUNT(*) as c FROM word_queue").get() as { c: number }).c;
if (existing > 0) {
  console.log(`Word queue already has ${existing} entries, skipping.`);
  process.exit(0);
}

// Skip words that already exist as cards
const existingWords = new Set(
  (db.prepare("SELECT polish_word FROM cards").all() as { polish_word: string }[]).map(r => r.polish_word)
);

const insert = db.prepare(
  "INSERT OR IGNORE INTO word_queue (frequency_rank, polish_word) VALUES (?, ?)"
);

const tx = db.transaction(() => {
  let count = 0;
  for (const entry of frequencyList as { rank: number; word: string }[]) {
    if (existingWords.has(entry.word)) continue;
    insert.run(entry.rank, entry.word);
    count++;
  }
  return count;
});

const count = tx();
console.log(`Seeded ${count} words into word_queue.`);
