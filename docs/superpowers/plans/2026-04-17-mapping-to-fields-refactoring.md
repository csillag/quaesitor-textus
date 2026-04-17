# Mapping → Fields Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the opaque `mapping: (item: T) => string` prop on `WithSearch` with serializable `field: string` / `fields: string[]` field-path props, exposing them throughout the context so future server-side packages can read them.

**Architecture:** Two new utility functions (`harvestStrings`, `getByPath`) do the path traversal and leaf-string extraction. `SearchEntry` in context stores `fields: string[]` directly. `useFilterFunction` composes the utilities to build the corpus at filter time.

**Tech Stack:** TypeScript, React 18, Vitest, pnpm workspaces. All changes are in `packages/core`. Story files in both packages need updating. No new dependencies.

---

## File Map

| Action | File |
|--------|------|
| Create | `packages/core/src/utils/harvestStrings.ts` |
| Create | `packages/core/src/utils/harvestStrings.test.ts` |
| Create | `packages/core/src/utils/getByPath.ts` |
| Create | `packages/core/src/utils/getByPath.test.ts` |
| Modify | `packages/core/src/context/SearchContext.ts` |
| Modify | `packages/core/src/context/WithSearch.tsx` |
| Modify | `packages/core/src/context/WithSearch.test.tsx` |
| Modify | `packages/core/src/hooks/useFilterFunction.ts` |
| Modify | `packages/core/src/hooks/useFilterFunction.test.tsx` |
| Modify | `packages/core/src/index.ts` |
| Modify | `packages/core/stories/BookSearchDemo.stories.tsx` |
| Modify | `packages/antd/stories/BookSearchDemo.stories.tsx` |
| Modify | `packages/core/README.md` |
| Modify | `packages/antd/README.md` |

---

## Task 1: `harvestStrings` utility

**Files:**
- Create: `packages/core/src/utils/harvestStrings.ts`
- Create: `packages/core/src/utils/harvestStrings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/utils/harvestStrings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { harvestStrings } from './harvestStrings'

describe('harvestStrings', () => {
  it('returns string wrapped in array', () => {
    expect(harvestStrings('hello')).toEqual(['hello'])
  })
  it('coerces number to string', () => {
    expect(harvestStrings(42)).toEqual(['42'])
  })
  it('coerces boolean to string', () => {
    expect(harvestStrings(true)).toEqual(['true'])
  })
  it('returns empty array for null', () => {
    expect(harvestStrings(null)).toEqual([])
  })
  it('returns empty array for undefined', () => {
    expect(harvestStrings(undefined)).toEqual([])
  })
  it('flattens a string array', () => {
    expect(harvestStrings(['foo', 'bar'])).toEqual(['foo', 'bar'])
  })
  it('flattens nested arrays', () => {
    expect(harvestStrings(['foo', ['bar', 'baz']])).toEqual(['foo', 'bar', 'baz'])
  })
  it('harvests leaf values from an object', () => {
    expect(harvestStrings({ name: 'Alice', age: 30 })).toEqual(['Alice', '30'])
  })
  it('skips nullish values in objects', () => {
    expect(harvestStrings({ name: 'Alice', alias: null })).toEqual(['Alice'])
  })
  it('recursively harvests nested objects', () => {
    expect(harvestStrings({ meta: { title: 'T', count: 1 } })).toEqual(['T', '1'])
  })
  it('handles mixed array of primitives and objects', () => {
    expect(harvestStrings([{ name: 'Alice' }, 'extra'])).toEqual(['Alice', 'extra'])
  })
})
```

- [ ] **Step 2: Run test — expect failure (file not found)**

```bash
cd packages/core && pnpm exec vitest run src/utils/harvestStrings.test.ts
```

Expected: test run fails with "Cannot find module './harvestStrings'"

- [ ] **Step 3: Implement `harvestStrings`**

Create `packages/core/src/utils/harvestStrings.ts`:

```typescript
export function harvestStrings(value: unknown): string[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value.flatMap(harvestStrings)
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(harvestStrings)
  return [String(value)]
}
```

- [ ] **Step 4: Run test — expect all pass**

```bash
cd packages/core && pnpm exec vitest run src/utils/harvestStrings.test.ts
```

Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/utils/harvestStrings.ts packages/core/src/utils/harvestStrings.test.ts
git commit -m "feat(core): add harvestStrings utility"
```

---

## Task 2: `getByPath` utility

**Files:**
- Create: `packages/core/src/utils/getByPath.ts`
- Create: `packages/core/src/utils/getByPath.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/utils/getByPath.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getByPath } from './getByPath'

describe('getByPath', () => {
  it('returns root object for "$"', () => {
    const obj = { name: 'Alice' }
    expect(getByPath(obj, '$')).toBe(obj)
  })
  it('returns a primitive itself for "$"', () => {
    expect(getByPath('hello', '$')).toBe('hello')
  })
  it('returns a top-level field', () => {
    expect(getByPath({ name: 'Alice' }, 'name')).toBe('Alice')
  })
  it('returns a nested field', () => {
    expect(getByPath({ meta: { title: 'T' } }, 'meta.title')).toBe('T')
  })
  it('returns undefined for a missing top-level field', () => {
    expect(getByPath({ name: 'Alice' }, 'missing')).toBeUndefined()
  })
  it('returns undefined when an intermediate node is missing', () => {
    expect(getByPath({ name: 'Alice' }, 'meta.title')).toBeUndefined()
  })
  it('returns undefined when an intermediate node is null', () => {
    expect(getByPath({ meta: null }, 'meta.title')).toBeUndefined()
  })
  it('returns undefined when an intermediate node is a primitive', () => {
    expect(getByPath({ meta: 'string' }, 'meta.title')).toBeUndefined()
  })
  it('returns an array value without flattening', () => {
    expect(getByPath({ tags: ['a', 'b'] }, 'tags')).toEqual(['a', 'b'])
  })
  it('accesses an array element by numeric string index', () => {
    expect(getByPath({ items: ['a', 'b', 'c'] }, 'items.1')).toBe('b')
  })
  it('returns undefined for null input with any path', () => {
    expect(getByPath(null, 'name')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test — expect failure (file not found)**

```bash
cd packages/core && pnpm exec vitest run src/utils/getByPath.test.ts
```

Expected: test run fails with "Cannot find module './getByPath'"

- [ ] **Step 3: Implement `getByPath`**

Create `packages/core/src/utils/getByPath.ts`:

```typescript
export function getByPath(obj: unknown, path: string): unknown {
  if (path === '$') return obj
  const segments = path.split('.')
  let current: unknown = obj
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}
```

- [ ] **Step 4: Run test — expect all pass**

```bash
cd packages/core && pnpm exec vitest run src/utils/getByPath.test.ts
```

Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/utils/getByPath.ts packages/core/src/utils/getByPath.test.ts
git commit -m "feat(core): add getByPath utility"
```

---

## Task 3: Core API change — SearchContext, WithSearch, useFilterFunction

These three files form a single breaking API change and are committed together. TypeScript will fail between substeps — that is expected.

**Files:**
- Modify: `packages/core/src/context/SearchContext.ts`
- Modify: `packages/core/src/context/WithSearch.tsx`
- Modify: `packages/core/src/context/WithSearch.test.tsx`
- Modify: `packages/core/src/hooks/useFilterFunction.ts`
- Modify: `packages/core/src/hooks/useFilterFunction.test.tsx`

- [ ] **Step 1: Rewrite `WithSearch.test.tsx` — replace the two mapping tests with four fields tests**

The last two tests in `packages/core/src/context/WithSearch.test.tsx` (lines 179–207) currently test `mapping`. Remove them and replace with:

```typescript
  it('stores fields in the context entry', () => {
    const FieldsCheck = () => {
      const map = React.useContext(SearchContext)
      const entry = map['default search']
      return <div data-testid="fields">{entry?.fields.join(',')}</div>
    }
    render(
      <WithSearch fields={['author', 'title']}>
        <FieldsCheck />
      </WithSearch>
    )
    expect(screen.getByTestId('fields')).toHaveTextContent('author,title')
  })

  it('field prop is stored as a single-element array', () => {
    const FieldsCheck = () => {
      const map = React.useContext(SearchContext)
      const entry = map['default search']
      return <div data-testid="fields">{entry?.fields.join(',')}</div>
    }
    render(
      <WithSearch field="name">
        <FieldsCheck />
      </WithSearch>
    )
    expect(screen.getByTestId('fields')).toHaveTextContent('name')
  })

  it('defaults fields to ["$"] when neither field nor fields is provided', () => {
    const FieldsCheck = () => {
      const map = React.useContext(SearchContext)
      const entry = map['default search']
      return <div data-testid="fields">{entry?.fields.join(',')}</div>
    }
    render(
      <WithSearch>
        <FieldsCheck />
      </WithSearch>
    )
    expect(screen.getByTestId('fields')).toHaveTextContent('$')
  })

  it('throws when both field and fields are provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <WithSearch field="name" fields={['name', 'title']}>
          <div />
        </WithSearch>
      )
    ).toThrow('WithSearch: cannot specify both `field` and `fields`.')
    spy.mockRestore()
  })
```

- [ ] **Step 2: Rewrite `useFilterFunction.test.tsx` — update wrapper and all hook call sites**

Replace the full contents of `packages/core/src/hooks/useFilterFunction.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { WithSearch } from '../context/WithSearch'
import { useFilterFunction } from './useFilterFunction'

interface Book {
  author: string
  title: string
}

const books: Book[] = [
  { author: 'Jane Austen', title: 'Pride and Prejudice' },
  { author: 'Leo Tolstoy', title: 'Anna Karenina' },
  { author: 'Charles Dickens', title: 'Oliver Twist' },
]

const makeWrapper = (authorQuery = '', titleQuery = '') =>
  ({ children }: { children: React.ReactNode }) => (
    <WithSearch name="author" field="author" query={authorQuery} onSetQuery={() => {}}>
      <WithSearch name="title" field="title" query={titleQuery} onSetQuery={() => {}}>
        {children}
      </WithSearch>
    </WithSearch>
  )

describe('useFilterFunction', () => {
  it('returns true for all items when no searches have patterns', () => {
    const { result } = renderHook(() => useFilterFunction(), {
      wrapper: makeWrapper(),
    })
    expect(books.every(result.current)).toBe(true)
  })

  it('AND mode: returns true when all active searches match', () => {
    const { result } = renderHook(() => useFilterFunction('AND'), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('AND mode: returns false when any active search fails', () => {
    // author=austen, title=karenina — no book matches both
    const { result } = renderHook(() => useFilterFunction('AND'), {
      wrapper: makeWrapper('austen', 'karenina'),
    })
    expect(result.current(books[0])).toBe(false) // austen matches author but not title
    expect(result.current(books[1])).toBe(false) // karenina matches title but not author
  })

  it('AND mode is the default', () => {
    const { result } = renderHook(() => useFilterFunction(), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('OR mode: returns true when at least one active search matches', () => {
    const { result } = renderHook(() => useFilterFunction('OR'), {
      wrapper: makeWrapper('austen', 'karenina'),
    })
    expect(result.current(books[0])).toBe(true)  // author matches 'austen'
    expect(result.current(books[1])).toBe(true)  // title matches 'karenina'
    expect(result.current(books[2])).toBe(false) // neither matches
  })

  it('OR mode: returns false when no active search matches', () => {
    const { result } = renderHook(() => useFilterFunction('OR'), {
      wrapper: makeWrapper('xyz', ''),
    })
    expect(books.some(result.current)).toBe(false)
  })

  it('entries with zero patterns are neutral in AND mode', () => {
    // title has no patterns — only author entry is active
    const { result } = renderHook(() => useFilterFunction('AND'), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('entries with zero patterns are neutral in OR mode', () => {
    const { result } = renderHook(() => useFilterFunction('OR'), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('uses fields from the context entry', () => {
    const { result } = renderHook(() => useFilterFunction('AND'), {
      wrapper: makeWrapper('', 'pride'),
    })
    expect(result.current(books[0])).toBe(true)  // "Pride and Prejudice" matches 'pride'
    expect(result.current(books[1])).toBe(false)
  })

  it('returns true for all items when outside any WithSearch (empty map)', () => {
    const { result } = renderHook(() => useFilterFunction())
    expect(books.every(result.current)).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests — expect TypeScript errors and test failures**

```bash
cd packages/core && pnpm test
```

Expected: TypeScript errors about unknown prop `field` on `WithSearch`, and test failures for the `mapping`-related tests. This is correct — we haven't updated the implementation yet.

- [ ] **Step 4: Replace `SearchContext.ts`**

Replace the full contents of `packages/core/src/context/SearchContext.ts`:

```typescript
import { createContext } from 'react'
import type { SearchOptions } from '../logic/types'

export const DEFAULT_SEARCH_NAME = 'default search'

export interface SearchEntry {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
  fields: string[]
  options?: SearchOptions
}

export type SearchContextValue = Record<string, SearchEntry>

export const SearchContext = createContext<SearchContextValue>({})
```

- [ ] **Step 5: Replace `WithSearch.tsx`**

Replace the full contents of `packages/core/src/context/WithSearch.tsx`:

```typescript
import React, { useContext, useMemo } from 'react'
import { SearchContext, DEFAULT_SEARCH_NAME } from './SearchContext'
import type { SearchEntry } from './SearchContext'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from '../hooks/useSearchInternalState'

type WithSearchBaseProps = {
  name?: string
  options?: SearchOptions
  children: React.ReactNode
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
}

export type WithSearchProps = WithSearchBaseProps & (
  | { field?: never; fields?: never }
  | { field: string; fields?: never }
  | { fields: string[]; field?: never }
)

export function WithSearch({
  name = DEFAULT_SEARCH_NAME,
  field,
  fields,
  options,
  children,
  query: controlledQuery,
  onSetQuery,
  onReset,
  onChange,
}: WithSearchProps) {
  if (field !== undefined && fields !== undefined) {
    throw new Error('WithSearch: cannot specify both `field` and `fields`.')
  }

  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
    options,
    query: controlledQuery,
    onSetQuery,
    onReset,
    onChange,
  })

  const upstreamMap = useContext(SearchContext)

  const entry: SearchEntry = useMemo(
    () => ({
      query,
      setQuery,
      patterns,
      hasPatterns,
      reset,
      fields: field !== undefined ? [field] : (fields ?? ['$']),
      options,
    }),
    [query, setQuery, patterns, hasPatterns, reset, field, fields, options]
  )

  const value = useMemo(() => {
    if (name in upstreamMap) {
      throw new Error(
        `WithSearch: duplicate name "${name}". Each WithSearch in the same tree must have a unique name.`
      )
    }
    return { ...upstreamMap, [name]: entry }
  }, [upstreamMap, name, entry])

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
```

- [ ] **Step 6: Replace `useFilterFunction.ts`**

Replace the full contents of `packages/core/src/hooks/useFilterFunction.ts`:

```typescript
import { useContext, useCallback } from 'react'
import { SearchContext } from '../context/SearchContext'
import type { SearchEntry } from '../context/SearchContext'
import { matchItem } from '../logic/matchItem'
import { getByPath } from '../utils/getByPath'
import { harvestStrings } from '../utils/harvestStrings'

export function useFilterFunction(mode: 'AND' | 'OR' = 'AND') {
  const map = useContext(SearchContext)

  return useCallback(
    (item: unknown): boolean => {
      const activeEntries = Object.values(map).filter(entry => entry.hasPatterns)
      if (activeEntries.length === 0) return true

      const check = (entry: SearchEntry) =>
        matchItem(
          entry.fields
            .map(f => harvestStrings(getByPath(item, f)).join(' '))
            .filter(Boolean)
            .join(' '),
          entry.patterns,
          entry.options
        )

      return mode === 'AND'
        ? activeEntries.every(check)
        : activeEntries.some(check)
    },
    [map, mode]
  )
}
```

- [ ] **Step 7: Run all core tests — expect all pass**

```bash
cd packages/core && pnpm test
```

Expected: all tests pass with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add \
  packages/core/src/context/SearchContext.ts \
  packages/core/src/context/WithSearch.tsx \
  packages/core/src/context/WithSearch.test.tsx \
  packages/core/src/hooks/useFilterFunction.ts \
  packages/core/src/hooks/useFilterFunction.test.tsx
git commit -m "feat(core)!: replace mapping prop with field/fields path props"
```

---

## Task 4: Export utilities from the package index

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add exports to `packages/core/src/index.ts`**

Add these two lines in the `// Logic (zero-dependency)` section, after the existing logic exports:

```typescript
export { getByPath } from './utils/getByPath'
export { harvestStrings } from './utils/harvestStrings'
```

The full logic section becomes:

```typescript
// Logic (zero-dependency)
export type { SearchOptions, HighlightSpan } from './logic/types'
export { parseInput } from './logic/parseInput'
export { normalizeText } from './logic/normalizeText'
export { matchItem } from './logic/matchItem'
export { getHighlightPositions } from './logic/getHighlightPositions'
export { trimAroundMatch } from './logic/trimAroundMatch'
export type { TrimOptions } from './logic/trimAroundMatch'
export { getByPath } from './utils/getByPath'
export { harvestStrings } from './utils/harvestStrings'
```

- [ ] **Step 2: Run all core tests to confirm nothing broke**

```bash
cd packages/core && pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export getByPath and harvestStrings utilities"
```

---

## Task 5: Update Storybook stories

**Files:**
- Modify: `packages/core/stories/BookSearchDemo.stories.tsx`
- Modify: `packages/antd/stories/BookSearchDemo.stories.tsx`

- [ ] **Step 1: Update core `BookSearchDemo.stories.tsx`**

In `packages/core/stories/BookSearchDemo.stories.tsx`, replace lines 57–58:

```typescript
    <WithSearch name="author" mapping={(b: Book) => b.author}>
      <WithSearch name="title" mapping={(b: Book) => b.title}>
```

With:

```typescript
    <WithSearch name="author" field="author">
      <WithSearch name="title" field="title">
```

Also update the `BookList` component — remove the `<Book>` type parameter from `useFilterFunction`:

```typescript
  const filterFunction = useFilterFunction(mode)
```

Also remove the now-unused `import type { Book }` line. The `books` value import stays; only the type import goes. (`Book` was only referenced as the type parameter — the antd story keeps it because it uses `type BookRow = Book & { key: string }`, but the core story has no other `Book` reference.)

- [ ] **Step 2: Update antd `BookSearchDemo.stories.tsx`**

In `packages/antd/stories/BookSearchDemo.stories.tsx`, replace lines 87–88:

```typescript
    <WithSearch name="author" mapping={(b: Book) => b.author} onChange={resetPage}>
      <WithSearch name="title" mapping={(b: Book) => b.title} onChange={resetPage}>
```

With:

```typescript
    <WithSearch name="author" field="author" onChange={resetPage}>
      <WithSearch name="title" field="title" onChange={resetPage}>
```

Also update the `BookTable` component — remove the `<Book>` type parameter from `useFilterFunction`:

```typescript
  const filterFunction = useFilterFunction(mode)
```

- [ ] **Step 3: Verify TypeScript compiles cleanly for both packages**

```bash
cd packages/core && pnpm exec tsc --noEmit
cd packages/antd && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/stories/BookSearchDemo.stories.tsx packages/antd/stories/BookSearchDemo.stories.tsx
git commit -m "chore: update stories to use field prop instead of mapping"
```

---

## Task 6: Update READMEs

**Files:**
- Modify: `packages/core/README.md`
- Modify: `packages/antd/README.md`

- [ ] **Step 1: Update `packages/core/README.md`**

Replace the "Multi-field search" section heading and its description paragraph (currently "Each `WithSearch` takes a `name` and a `mapping` — a function that extracts the searchable text from an item. Nest them to search across multiple fields independently.") with:

```markdown
## Multi-field search

Each `WithSearch` takes a `name` and a `field` — the dot-notation path to the property to search on each item. Use `fields` to search multiple properties of the same item within one context. Nest `WithSearch` providers to search across independent fields with separate inputs.
```

Replace the multi-field code example (`WithSearch` with `mapping` props and `useFilterFunction<Book>`):

```tsx
const BookList = () => {
  const filterFunction = useFilterFunction()
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
  <WithSearch name="author" field="author">
    <WithSearch name="title" field="title">
      <SearchInput name="author" placeholder="Search author…" />
      <SearchInput name="title" placeholder="Search title…" />
      <BookList />
    </WithSearch>
  </WithSearch>
)
```

Replace the OR mode example:

```tsx
const filterFunction = useFilterFunction('OR')
```

After the OR mode snippet, add a new section:

```markdown
## Field path syntax

`field` (or each entry in `fields`) is a dot-notation path evaluated against each item:

| Path | Resolves to |
|------|-------------|
| `"$"` | The item itself (default when no `field`/`fields` given) |
| `"name"` | `item.name` |
| `"metadata.title"` | `item.metadata.title` |

Arrays at any point in the path are flattened: all leaf string values are collected and joined. Non-string primitives (numbers, booleans) are coerced via `String()`. Nullish values are skipped.

## Utility exports

`getByPath` and `harvestStrings` are exported for advanced use:

```tsx
import { getByPath, harvestStrings } from '@quaesitor-textus/core'

// Traverse a dot-notation path
getByPath({ meta: { title: 'T' } }, 'meta.title') // → 'T'
getByPath(obj, '$')                                // → obj itself

// Collect all leaf primitive values as strings
harvestStrings({ name: 'Alice', age: 30 })         // → ['Alice', '30']
harvestStrings(['foo', ['bar']])                    // → ['foo', 'bar']
```
```

- [ ] **Step 2: Update `packages/antd/README.md`**

In the multi-field search example, replace:

```tsx
<WithSearch name="author" mapping={(b: Book) => b.author}>
  <WithSearch name="title" mapping={(b: Book) => b.title}>
```

With:

```tsx
<WithSearch name="author" field="author">
  <WithSearch name="title" field="title">
```

Replace `useFilterFunction<Book>()` with `useFilterFunction()`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/README.md packages/antd/README.md
git commit -m "docs: update READMEs for field/fields API"
```
