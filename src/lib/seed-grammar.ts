import db from "./db";

interface GrammarPattern {
  case_name: string;
  usage: string;
  modifier: string;
  gender: string;
}

// 32 patterns × 2 (singular/plural) = 64 cards
const PATTERNS: GrammarPattern[] = [
  // Genitive (Dopełniacz) - 8 patterns
  { case_name: "Genitive", usage: "Negation", modifier: "Adj + Noun", gender: "fem" },
  { case_name: "Genitive", usage: "Negation", modifier: "Adj + Noun", gender: "masc_inan" },
  { case_name: "Genitive", usage: "Negation", modifier: "Adj + Noun", gender: "neut" },
  { case_name: "Genitive", usage: "Negation", modifier: "Adj + Noun", gender: "masc_anim" },
  { case_name: "Genitive", usage: "Possession", modifier: "Adj + Noun", gender: "fem" },
  { case_name: "Genitive", usage: "Possession", modifier: "Adj + Noun", gender: "masc_inan" },
  { case_name: "Genitive", usage: "Possession", modifier: "Adj + Noun", gender: "neut" },
  { case_name: "Genitive", usage: "Possession", modifier: "Adj + Noun", gender: "masc_pers" },
  // Accusative (Biernik) - 8 patterns
  { case_name: "Accusative", usage: "Direct object", modifier: "Adj + Noun", gender: "fem" },
  { case_name: "Accusative", usage: "Direct object", modifier: "Adj + Noun", gender: "masc_inan" },
  { case_name: "Accusative", usage: "Direct object", modifier: "Adj + Noun", gender: "masc_anim" },
  { case_name: "Accusative", usage: "Direct object", modifier: "Adj + Noun", gender: "neut" },
  { case_name: "Accusative", usage: "Direction (motion)", modifier: "Adj + Noun", gender: "fem" },
  { case_name: "Accusative", usage: "Direction (motion)", modifier: "Adj + Noun", gender: "masc_inan" },
  { case_name: "Accusative", usage: "Direct object", modifier: "Adj + Noun", gender: "masc_pers" },
  { case_name: "Accusative", usage: "Direction (motion)", modifier: "Adj + Noun", gender: "neut" },
  // Dative (Celownik) - 4 patterns
  { case_name: "Dative", usage: "Indirect object", modifier: "Adj + Noun", gender: "fem" },
  { case_name: "Dative", usage: "Indirect object", modifier: "Adj + Noun", gender: "masc_pers" },
  { case_name: "Dative", usage: "Indirect object", modifier: "Adj + Noun", gender: "masc_anim" },
  { case_name: "Dative", usage: "Indirect object", modifier: "Adj + Noun", gender: "neut" },
  // Instrumental (Narzędnik) - 4 patterns
  { case_name: "Instrumental", usage: "With (z + instr.)", modifier: "Adj + Noun", gender: "fem" },
  { case_name: "Instrumental", usage: "With (z + instr.)", modifier: "Adj + Noun", gender: "masc_pers" },
  { case_name: "Instrumental", usage: "Profession (być)", modifier: "Adj + Noun", gender: "masc_pers" },
  { case_name: "Instrumental", usage: "Profession (być)", modifier: "Adj + Noun", gender: "fem" },
  // Locative (Miejscownik) - 4 patterns
  { case_name: "Locative", usage: "Location (w/na)", modifier: "Adj + Noun", gender: "fem" },
  { case_name: "Locative", usage: "Location (w/na)", modifier: "Adj + Noun", gender: "masc_inan" },
  { case_name: "Locative", usage: "Location (w/na)", modifier: "Adj + Noun", gender: "neut" },
  { case_name: "Locative", usage: "About (o + loc.)", modifier: "Adj + Noun", gender: "all_genders" },
  // Vocative (Wołacz) - 2 patterns
  { case_name: "Vocative", usage: "Address", modifier: "Adj + Noun", gender: "masc_pers" },
  { case_name: "Vocative", usage: "Address", modifier: "Adj + Noun", gender: "fem" },
  // Nominative (Mianownik) - 2 patterns (baseline / subject)
  { case_name: "Nominative", usage: "Subject", modifier: "Adj + Noun", gender: "all_genders" },
  { case_name: "Nominative", usage: "Subject", modifier: "Adj + Noun", gender: "fem" },
];

const GENDER_LABELS: Record<string, string> = {
  masc_pers: "Masc. Personal",
  masc_anim: "Masc. Animate",
  masc_inan: "Masc. Inanimate",
  fem: "Fem.",
  neut: "Neut.",
  all_genders: "All Genders",
};

// 100 nouns: 20 per gender
const NOUNS: { polish_word: string; english_word: string; gender: string }[] = [
  // Masculine personal (masc_pers) - 20
  { polish_word: "student", english_word: "student", gender: "masc_pers" },
  { polish_word: "nauczyciel", english_word: "teacher", gender: "masc_pers" },
  { polish_word: "lekarz", english_word: "doctor", gender: "masc_pers" },
  { polish_word: "przyjaciel", english_word: "friend", gender: "masc_pers" },
  { polish_word: "sąsiad", english_word: "neighbor", gender: "masc_pers" },
  { polish_word: "kelner", english_word: "waiter", gender: "masc_pers" },
  { polish_word: "kierowca", english_word: "driver", gender: "masc_pers" },
  { polish_word: "chłopiec", english_word: "boy", gender: "masc_pers" },
  { polish_word: "mężczyzna", english_word: "man", gender: "masc_pers" },
  { polish_word: "ojciec", english_word: "father", gender: "masc_pers" },
  { polish_word: "brat", english_word: "brother", gender: "masc_pers" },
  { polish_word: "dziadek", english_word: "grandfather", gender: "masc_pers" },
  { polish_word: "kolega", english_word: "colleague", gender: "masc_pers" },
  { polish_word: "dentysta", english_word: "dentist", gender: "masc_pers" },
  { polish_word: "policjant", english_word: "policeman", gender: "masc_pers" },
  { polish_word: "aktor", english_word: "actor", gender: "masc_pers" },
  { polish_word: "muzyk", english_word: "musician", gender: "masc_pers" },
  { polish_word: "pisarz", english_word: "writer", gender: "masc_pers" },
  { polish_word: "sportowiec", english_word: "athlete", gender: "masc_pers" },
  { polish_word: "turysta", english_word: "tourist", gender: "masc_pers" },
  // Masculine animate (masc_anim) - 20
  { polish_word: "pies", english_word: "dog", gender: "masc_anim" },
  { polish_word: "kot", english_word: "cat", gender: "masc_anim" },
  { polish_word: "koń", english_word: "horse", gender: "masc_anim" },
  { polish_word: "ptak", english_word: "bird", gender: "masc_anim" },
  { polish_word: "wilk", english_word: "wolf", gender: "masc_anim" },
  { polish_word: "niedźwiedź", english_word: "bear", gender: "masc_anim" },
  { polish_word: "lew", english_word: "lion", gender: "masc_anim" },
  { polish_word: "królik", english_word: "rabbit", gender: "masc_anim" },
  { polish_word: "słoń", english_word: "elephant", gender: "masc_anim" },
  { polish_word: "tygrys", english_word: "tiger", gender: "masc_anim" },
  { polish_word: "orzeł", english_word: "eagle", gender: "masc_anim" },
  { polish_word: "delfin", english_word: "dolphin", gender: "masc_anim" },
  { polish_word: "motyl", english_word: "butterfly", gender: "masc_anim" },
  { polish_word: "rekin", english_word: "shark", gender: "masc_anim" },
  { polish_word: "pingwin", english_word: "penguin", gender: "masc_anim" },
  { polish_word: "wąż", english_word: "snake", gender: "masc_anim" },
  { polish_word: "żółw", english_word: "turtle", gender: "masc_anim" },
  { polish_word: "papuga", english_word: "parrot", gender: "masc_anim" },
  { polish_word: "owad", english_word: "insect", gender: "masc_anim" },
  { polish_word: "ryba", english_word: "fish", gender: "masc_anim" },
  // Masculine inanimate (masc_inan) - 20
  { polish_word: "dom", english_word: "house", gender: "masc_inan" },
  { polish_word: "stół", english_word: "table", gender: "masc_inan" },
  { polish_word: "telefon", english_word: "phone", gender: "masc_inan" },
  { polish_word: "komputer", english_word: "computer", gender: "masc_inan" },
  { polish_word: "samochód", english_word: "car", gender: "masc_inan" },
  { polish_word: "klucz", english_word: "key", gender: "masc_inan" },
  { polish_word: "zegar", english_word: "clock", gender: "masc_inan" },
  { polish_word: "parasol", english_word: "umbrella", gender: "masc_inan" },
  { polish_word: "plecak", english_word: "backpack", gender: "masc_inan" },
  { polish_word: "obraz", english_word: "painting", gender: "masc_inan" },
  { polish_word: "ser", english_word: "cheese", gender: "masc_inan" },
  { polish_word: "chleb", english_word: "bread", gender: "masc_inan" },
  { polish_word: "park", english_word: "park", gender: "masc_inan" },
  { polish_word: "pokój", english_word: "room", gender: "masc_inan" },
  { polish_word: "kościół", english_word: "church", gender: "masc_inan" },
  { polish_word: "rower", english_word: "bicycle", gender: "masc_inan" },
  { polish_word: "most", english_word: "bridge", gender: "masc_inan" },
  { polish_word: "pociąg", english_word: "train", gender: "masc_inan" },
  { polish_word: "kwiat", english_word: "flower", gender: "masc_inan" },
  { polish_word: "kapelusz", english_word: "hat", gender: "masc_inan" },
  // Feminine (fem) - 20
  { polish_word: "kobieta", english_word: "woman", gender: "fem" },
  { polish_word: "książka", english_word: "book", gender: "fem" },
  { polish_word: "kawa", english_word: "coffee", gender: "fem" },
  { polish_word: "szkoła", english_word: "school", gender: "fem" },
  { polish_word: "ulica", english_word: "street", gender: "fem" },
  { polish_word: "lampa", english_word: "lamp", gender: "fem" },
  { polish_word: "torba", english_word: "bag", gender: "fem" },
  { polish_word: "ryba", english_word: "fish", gender: "fem" },
  { polish_word: "herbata", english_word: "tea", gender: "fem" },
  { polish_word: "gazeta", english_word: "newspaper", gender: "fem" },
  { polish_word: "droga", english_word: "road", gender: "fem" },
  { polish_word: "góra", english_word: "mountain", gender: "fem" },
  { polish_word: "rzeka", english_word: "river", gender: "fem" },
  { polish_word: "piosenka", english_word: "song", gender: "fem" },
  { polish_word: "praca", english_word: "work", gender: "fem" },
  { polish_word: "zupa", english_word: "soup", gender: "fem" },
  { polish_word: "ręka", english_word: "hand", gender: "fem" },
  { polish_word: "noga", english_word: "leg", gender: "fem" },
  { polish_word: "głowa", english_word: "head", gender: "fem" },
  { polish_word: "muza", english_word: "music", gender: "fem" },
  // Neuter (neut) - 20
  { polish_word: "dziecko", english_word: "child", gender: "neut" },
  { polish_word: "okno", english_word: "window", gender: "neut" },
  { polish_word: "piwo", english_word: "beer", gender: "neut" },
  { polish_word: "mleko", english_word: "milk", gender: "neut" },
  { polish_word: "miasto", english_word: "city", gender: "neut" },
  { polish_word: "morze", english_word: "sea", gender: "neut" },
  { polish_word: "słońce", english_word: "sun", gender: "neut" },
  { polish_word: "niebo", english_word: "sky", gender: "neut" },
  { polish_word: "jedzenie", english_word: "food", gender: "neut" },
  { polish_word: "mieszkanie", english_word: "apartment", gender: "neut" },
  { polish_word: "jabłko", english_word: "apple", gender: "neut" },
  { polish_word: "jajko", english_word: "egg", gender: "neut" },
  { polish_word: "biuro", english_word: "office", gender: "neut" },
  { polish_word: "krzesło", english_word: "chair", gender: "neut" },
  { polish_word: "łóżko", english_word: "bed", gender: "neut" },
  { polish_word: "zdanie", english_word: "sentence", gender: "neut" },
  { polish_word: "pytanie", english_word: "question", gender: "neut" },
  { polish_word: "zdjęcie", english_word: "photo", gender: "neut" },
  { polish_word: "imię", english_word: "name", gender: "neut" },
  { polish_word: "serce", english_word: "heart", gender: "neut" },
];

export function seedGrammar(): { inserted: number; total: number } {
  // Check if already seeded
  const existing = db.prepare("SELECT COUNT(*) as count FROM grammar_cards").get() as { count: number };
  if (existing.count > 0) {
    return { inserted: 0, total: existing.count };
  }

  const insertCard = db.prepare(`
    INSERT INTO grammar_cards (case_name, usage, modifier, gender, number, display_title)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertReview = db.prepare(`
    INSERT OR IGNORE INTO grammar_reviews (grammar_card_id) VALUES (?)
  `);

  const insertNoun = db.prepare(`
    INSERT INTO grammar_nouns (polish_word, english_word, gender) VALUES (?, ?, ?)
  `);

  let inserted = 0;

  const seedAll = db.transaction(() => {
    // Insert 64 grammar cards (32 patterns × singular + plural)
    for (const pattern of PATTERNS) {
      for (const number of ["singular", "plural"] as const) {
        const genderLabel = GENDER_LABELS[pattern.gender] || pattern.gender;
        const displayTitle = `${pattern.case_name} - ${pattern.usage} - ${pattern.modifier} - ${genderLabel} - ${number.charAt(0).toUpperCase() + number.slice(1)}`;
        const result = insertCard.run(
          pattern.case_name,
          pattern.usage,
          pattern.modifier,
          pattern.gender,
          number,
          displayTitle
        );
        insertReview.run(result.lastInsertRowid);
        inserted++;
      }
    }

    // Insert 100 nouns
    for (const noun of NOUNS) {
      insertNoun.run(noun.polish_word, noun.english_word, noun.gender);
    }
  });

  seedAll();

  return { inserted, total: inserted };
}
