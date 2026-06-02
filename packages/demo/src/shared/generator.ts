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

// Diacritic-rich pool (the sentinel Miguel Ángel Asturias is reserved/injected
// separately at RESERVED_INDEX, NOT here) plus a 2-char surname ('Wei Ng') to
// exercise the bigram path.
const AUTHORS = [
  'Émile Zola', 'Søren Kierkegaard', 'Charlotte Brontë', 'Karel Čapek',
  'Jorge Luis Borges', 'Albert Camus', 'Antoine de Saint-Exupéry',
  'Fyodor Dostoyevskij', 'José Saramago', 'Stanisław Lem', 'Wei Ng',
  'Naguib Mahfouz', 'Halldór Laxness', 'Knut Hamsun', 'Yukio Mishima',
]
const ADJ = ['Silent', 'Crimson', 'Hidden', 'Eternal', 'Broken', 'Golden', 'Distant', 'Hollow']
const NOUN = ['Garden', 'River', 'Empire', 'Shadow', 'Mirror', 'Harvest', 'Lantern', 'Citadel']
const RESERVED_INDEX = 1500 // lands inside the first truckload batch (1000..1999)
// Sentinel author, exclusive to the first truckload batch; used to verify the watcher.
export const SENTINEL_AUTHOR = 'Miguel Ángel Asturias'

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
    } else if (i === RESERVED_INDEX) {
      // Sentinel author exclusive to the first truckload batch (1000..1999) and
      // absent from the seeded classics — search "asturias" is empty before the
      // first truckload and hits after, verifying the change-stream watcher.
      author = SENTINEL_AUTHOR
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
