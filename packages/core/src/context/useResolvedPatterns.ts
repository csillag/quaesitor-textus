import { useContext, useMemo } from 'react'
import { SearchContext } from './SearchContext'

export function useResolvedPatterns(
  searchNames?: string | string[],
  all?: boolean,
  localPatterns?: string[]
): string[] {
  const map = useContext(SearchContext)

  return useMemo(() => {
    const contextPatterns: string[] = []

    if (all) {
      for (const entry of Object.values(map)) {
        contextPatterns.push(...entry.patterns)
      }
    } else if (searchNames !== undefined) {
      const names = Array.isArray(searchNames) ? searchNames : [searchNames]
      for (const name of names) {
        if (!(name in map)) {
          console.warn(
            `quaesitor-textus: HighlightedText references unknown search name "${name}". No WithSearch with that name found in the tree.`
          )
          continue
        }
        contextPatterns.push(...map[name].patterns)
      }
    }

    return [...new Set([...contextPatterns, ...(localPatterns ?? [])])]
  }, [map, searchNames, all, localPatterns])
}
