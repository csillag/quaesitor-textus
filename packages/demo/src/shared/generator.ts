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
// One distinctive diacritic author per truck batch (batch k -> SENTINELS[k-1]),
// injected at index 1000*k + 500, exclusive to that batch.
export const SENTINELS = [
  'Miguel Ángel Asturias', 'Halldór Laxness', 'Émile Zola', 'Søren Kierkegaard',
  'José Saramago', 'Karel Čapek', 'Naguib Mahfouz', 'Knut Hamsun', 'Yukio Mishima',
]
export function batchSentinel(batch: number): string {
  return SENTINELS[Math.min(Math.max(batch, 1), SENTINELS.length) - 1]
}
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
      author = batchSentinel(Math.floor(i / 1000))
      title = 'El Señor Presidente'
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
