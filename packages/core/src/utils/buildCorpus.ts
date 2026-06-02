import { getByPath } from './getByPath'
import { harvestStrings } from './harvestStrings'

export function buildCorpus(item: unknown, fields: string[]): string {
  return fields
    .map(f => harvestStrings(getByPath(item, f)).join(' '))
    .filter(Boolean)
    .join(' ')
}
