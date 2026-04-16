# @quaesitor-textus/core

Text search and highlighting for React.

## Installation

```bash
npm install @quaesitor-textus/core
```

Requires React ≥ 18.

## Basic usage

```tsx
import {
  WithSearch,
  SearchInput,
  useSearchContext,
  useFilterFunction,
  HighlightedText,
} from '@quaesitor-textus/core'

const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry']

const FilteredList = () => {
  const { hasPatterns } = useSearchContext()
  const filterFunction = useFilterFunction()
  const results = items.filter(filterFunction)
  return (
    <ul>
      {results.map(item => (
        <li key={item}>
          <HighlightedText text={item} all />
        </li>
      ))}
    </ul>
  )
}

export const App = () => (
  <WithSearch>
    <SearchInput placeholder="Search…" />
    <FilteredList />
  </WithSearch>
)
```

`WithSearch` owns the search state and makes it available to the tree. `SearchInput` reads and updates the query. `useFilterFunction()` returns a filter predicate to pass to `Array.filter`. `HighlightedText` with `all` highlights matches from all active searches in the tree.

## Multi-field search

Each `WithSearch` takes a `name` and a `mapping` — a function that extracts the searchable text from an item. Nest them to search across multiple fields independently.

```tsx
import {
  WithSearch,
  SearchInput,
  useFilterFunction,
  HighlightedText,
} from '@quaesitor-textus/core'

interface Book { author: string; title: string }

const books: Book[] = [
  { author: 'Jane Austen', title: 'Pride and Prejudice' },
  { author: 'Leo Tolstoy', title: 'Anna Karenina' },
]

const BookList = () => {
  const filterFunction = useFilterFunction<Book>()
  return (
    <ul>
      {books.filter(filterFunction).map((book, i) => (
        <li key={i}>
          <HighlightedText text={book.author} searchNames="author" />
          {' — '}
          <HighlightedText text={book.title} searchNames="title" />
        </li>
      ))}
    </ul>
  )
}

export const App = () => (
  <WithSearch name="author" mapping={(b: Book) => b.author}>
    <WithSearch name="title" mapping={(b: Book) => b.title}>
      <SearchInput name="author" placeholder="Search author…" />
      <SearchInput name="title" placeholder="Search title…" />
      <BookList />
    </WithSearch>
  </WithSearch>
)
```

`useFilterFunction<T>()` defaults to AND mode — an item must match every active search field. Pass `'OR'` to match any:

```tsx
const filterFunction = useFilterFunction<Book>('OR')
```

## API

### `<WithSearch>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | `"default search"` | Name of this search entry in the context map. Must be unique within the tree. |
| `mapping` | `(item: T) => string` | `String` | Extracts the searchable text from a domain object. Used by `useFilterFunction`. |
| `options` | `SearchOptions` | — | Tokenisation options (case sensitivity, etc.). |
| `query` | `string` | — | Controlled query value. |
| `onSetQuery` | `(q: string) => void` | — | Called when the query changes (controlled mode). |
| `onReset` | `() => void` | — | Called when the query is cleared. |
| `onChange` | `(old: string, new: string) => void` | — | Called on every query change. Useful for resetting pagination. |

### `<SearchInput>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | `"default search"` | Name of the `WithSearch` entry this input controls. |
| …rest | `InputHTMLAttributes` | — | All other `<input>` props except `value`, `onChange`, and `type`. |

### `useFilterFunction<T>(mode?)`

```ts
function useFilterFunction<T>(mode?: 'AND' | 'OR'): (item: T) => boolean
```

Returns a filter predicate over the current context map. Entries with no active patterns are neutral and do not affect the result. `mode` defaults to `'AND'`.

### `useSearchContext(name?)`

```ts
function useSearchContext(name?: string): {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
}
```

Looks up the named entry in the context map. `name` defaults to `"default search"`. Throws if the name is not found.

### `<HighlightedText>`

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string \| undefined` | Text to render. |
| `patterns` | `string[]` | Local highlight patterns (in addition to context). |
| `searchNames` | `string \| string[]` | Names of context searches whose patterns to highlight. |
| `all` | `boolean` | Highlight patterns from all context searches. |
| `options` | `SearchOptions` | Tokenisation options. |
| `markStyle` | `CSSProperties` | Style applied to `<mark>` elements. |

At least one of `searchNames`, `all`, or `patterns` must be supplied to see highlights.

### `<HighlightedTrimmedText>`

Same props as `HighlightedText` plus `fragmentLength?: number` (default `80`). Trims the text to show only the fragment around the first match.
