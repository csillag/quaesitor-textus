import type { SearchOptions } from './types'

export function parseInput(text: string, options: SearchOptions = {}): string[] {
  const { minLength = 2 } = options
  const patterns = text.trim().split(' ').filter(s => s.length > 0)
  if (patterns.length === 1 && patterns[0].length < minLength) {
    return []
  }
  return patterns
}
