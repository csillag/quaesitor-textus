import type { DemoPredicate } from '../shared/predicate'
import type { Book } from '../shared/generator'

export interface BooksResponse { items: Book[]; total: number; page: number; pageSize: number }

export async function searchBooks(
  predicate: DemoPredicate, page: number, pageSize: number,
): Promise<BooksResponse> {
  const params = new URLSearchParams({
    filter: JSON.stringify(predicate), page: String(page), pageSize: String(pageSize),
  })
  const res = await fetch(`/api/books?${params}`)
  if (!res.ok) throw new Error(`search failed: ${res.status}`)
  return res.json()
}

export async function truckload(): Promise<{ inserted: number; total: number; sampleAuthors: string[] }> {
  const res = await fetch('/api/truckload', { method: 'POST' })
  if (!res.ok) throw new Error(`truckload failed: ${res.status}`)
  return res.json()
}
