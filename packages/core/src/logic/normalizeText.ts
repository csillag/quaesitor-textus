import type { SearchOptions } from './types'
import { normalizeWithMap } from './normalizeWithMap'

export function normalizeText(text: string, options: SearchOptions = {}): string {
  return normalizeWithMap(text, options).normalized
}
