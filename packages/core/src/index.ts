// Logic (zero-dependency)
export type { SearchOptions, HighlightSpan } from './logic/types'
export { parseInput } from './logic/parseInput'
export { normalizeText } from './logic/normalizeText'
export { matchItem } from './logic/matchItem'
export { getHighlightPositions } from './logic/getHighlightPositions'
export { trimAroundMatch } from './logic/trimAroundMatch'
export type { TrimOptions } from './logic/trimAroundMatch'

// React hooks
export { useSearch } from './hooks/useSearch'
export type { UseSearchResult } from './hooks/useSearch'

// Context
export { WithSearch } from './context/WithSearch'
export { useSearchContext } from './context/useSearchContext'
export type { SearchContextValue } from './context/SearchContext'
export type { WithSearchProps } from './context/WithSearch'

// Components
export { SearchInput } from './components/SearchInput'
export { HighlightedText } from './components/HighlightedText'
