import type { SearchOptions } from './types'

export function normalizeText(text: string, options: SearchOptions = {}): string {
  const { caseSensitive = false, diacriticSensitive = false } = options
  let result = text
  if (!diacriticSensitive) {
    result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
  if (!caseSensitive) {
    result = result.toLowerCase()
  }
  return result
}
