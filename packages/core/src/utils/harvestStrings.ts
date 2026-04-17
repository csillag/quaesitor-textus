export function harvestStrings(value: unknown): string[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value.flatMap(harvestStrings)
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(harvestStrings)
  return [String(value)]
}
