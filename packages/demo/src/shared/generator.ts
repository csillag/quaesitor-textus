// Reuse the canonical sample classics rather than duplicating them.
import { books as classics } from '../../../core/stories/data/books'

export interface Book { _id: string; author: string; title: string; year: number }
export const TOTAL_BOOKS = 10000
export const SEED_COUNT = 1000
export const TRUCK_SIZE = 1000

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Diacritic-rich pool (the per-batch sentinels in SENTINELS are injected
// separately, NOT here) plus a 2-char surname ('Wei Ng') to exercise the
// bigram path.
const AUTHORS = [
  'Émile Zola', 'Søren Kierkegaard', 'Charlotte Brontë', 'Karel Čapek',
  'Jorge Luis Borges', 'Albert Camus', 'Antoine de Saint-Exupéry',
  'Fyodor Dostoyevskij', 'José Saramago', 'Stanisław Lem', 'Wei Ng',
  'Naguib Mahfouz', 'Halldór Laxness', 'Knut Hamsun', 'Yukio Mishima',
]
// One distinctive book per truck batch (batch k -> SENTINELS[k-1]), injected at
// index 1000*k + 500, exclusive to that batch. The TITLE is unique (never used
// by generated/classic books), so searching it returns exactly that one book —
// the unambiguous proof the watcher indexed the batch.
// Authors AND titles here are absent from both the seeded `classics` and the
// generated `AUTHORS` pool (asserted below), so searching a sentinel's author OR
// title returns nothing until its batch is delivered — the watcher proof.
export const SENTINELS: { author: string; title: string }[] = [
  { author: 'Miguel Ángel Asturias', title: 'El Señor Presidente' },
  { author: 'Wisława Szymborska', title: 'Sól' },
  { author: 'Tomas Tranströmer', title: 'Östersjöar' },
  { author: 'László Krasznahorkai', title: 'Sátántangó' },
  { author: 'Herta Müller', title: 'Atemschaukel' },
  { author: 'Kenzaburō Ōe', title: 'Manʼen Gannen no Futtobōru' },
  { author: 'Cees Nooteboom', title: 'Rituelen' },
  { author: 'Péter Esterházy', title: 'Harmonia Cælestis' },
  { author: 'Olga Tokarczuk', title: 'Księgi Jakubowe' },
]
export function batchSentinel(batch: number): { author: string; title: string } {
  return SENTINELS[Math.min(Math.max(batch, 1), SENTINELS.length) - 1]
}

// Fail loudly if the data invariants the demo relies on ever break:
//  - classics must fit inside the seed (else they leak into truck batches),
//  - no sentinel may collide with a classic or with the generated author pool.
;(() => {
  if (classics.length > SEED_COUNT) {
    throw new Error(`generator: classics (${classics.length}) exceed SEED_COUNT (${SEED_COUNT}); they would leak into truck batches`)
  }
  const cAuthors = new Set(classics.map((b) => b.author))
  const cTitles = new Set(classics.map((b) => b.title))
  const pool = new Set(AUTHORS)
  for (const s of SENTINELS) {
    if (cAuthors.has(s.author) || cTitles.has(s.title)) {
      throw new Error(`generator: sentinel "${s.author} / ${s.title}" collides with a seeded classic`)
    }
    if (pool.has(s.author)) {
      throw new Error(`generator: sentinel author "${s.author}" also appears in the generated pool`)
    }
  }
})()
// A pool author guaranteed to recur frequently within any batch (~67/1000).
export function batchCommonAuthor(_batch: number): string {
  return 'Jorge Luis Borges'
}
const ADJ = ['Silent', 'Crimson', 'Hidden', 'Eternal', 'Broken', 'Golden', 'Distant', 'Hollow']
const NOUN = ['Garden', 'River', 'Empire', 'Shadow', 'Mirror', 'Harvest', 'Lantern', 'Citadel']

export function generateBooks(count: number = TOTAL_BOOKS): Book[] {
  const rand = mulberry32(0x9e3779b9)
  const out: Book[] = []
  for (let i = 0; i < count; i++) {
    let author: string
    let title: string
    let year: number
    if (i < classics.length) {
      author = classics[i].author
      title = classics[i].title
      year = classics[i].year
    } else if (i >= 1000 && i % 1000 === 500) {
      // index 1000*k + 500 -> batch k's unique sentinel
      const s = batchSentinel(Math.floor(i / 1000))
      author = s.author
      title = s.title
      year = 1946
    } else {
      author = AUTHORS[Math.floor(rand() * AUTHORS.length)]
      title = `The ${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUN[Math.floor(rand() * NOUN.length)]}`
      year = -800 + Math.floor(rand() * 2824) // -800 .. 2023
    }
    out.push({ _id: `book-${i}`, author, title, year })
  }
  return out
}
