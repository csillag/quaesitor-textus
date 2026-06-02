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

// Diacritic-rich pool (García Márquez is reserved/injected separately, NOT here)
// plus a 2-char surname ('Wei Ng') to exercise the bigram path.
const AUTHORS = [
  'Émile Zola', 'Søren Kierkegaard', 'Charlotte Brontë', 'Karel Čapek',
  'Jorge Luis Borges', 'Albert Camus', 'Antoine de Saint-Exupéry',
  'Fyodor Dostoyevskij', 'José Saramago', 'Stanisław Lem', 'Wei Ng',
  'Naguib Mahfouz', 'Halldór Laxness', 'Knut Hamsun', 'Yukio Mishima',
]
const ADJ = ['Silent', 'Crimson', 'Hidden', 'Eternal', 'Broken', 'Golden', 'Distant', 'Hollow']
const NOUN = ['Garden', 'River', 'Empire', 'Shadow', 'Mirror', 'Harvest', 'Lantern', 'Citadel']
const RESERVED_INDEX = 1500 // lands inside the first truckload batch (1000..1999)

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
      author = 'Gabriel García Márquez'
      title = 'One Hundred Years of Solitude'
      year = 1967
    } else {
      author = AUTHORS[Math.floor(rand() * AUTHORS.length)]
      title = `The ${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUN[Math.floor(rand() * NOUN.length)]}`
      year = -800 + Math.floor(rand() * 2824) // -800 .. 2023
    }
    out.push({ _id: `book-${i}`, author, title, year })
  }
  return out
}
