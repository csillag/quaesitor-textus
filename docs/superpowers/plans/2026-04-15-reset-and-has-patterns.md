# Add `hasPatterns` and `reset` to Search API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `hasPatterns: boolean` and `reset: () => void` to `UseSearchResult` and `SearchContextValue`, then update `FullListDemo` to conditionally show results and add a clear button.

**Architecture:** `hasPatterns` is derived from `patterns.length > 0`; `reset` calls `setQuery('')`. Both are added to the low-level hook first, then threaded through the context. The story update is last and purely cosmetic.

**Tech Stack:** TypeScript, React 18, vitest + @testing-library/react, pnpm workspaces.

---

## File Map

| File | Change |
|---|---|
| `packages/core/src/hooks/useSearch.ts` | Add `hasPatterns`, `reset` to interface + implementation |
| `packages/core/src/hooks/useSearch.test.ts` | Add tests for the two new fields |
| `packages/core/src/context/SearchContext.ts` | Add `hasPatterns`, `reset` to `SearchContextValue` interface |
| `packages/core/src/context/WithSearch.tsx` | Wire `hasPatterns` and `reset` into the context value |
| `packages/core/stories/FullListDemo.stories.tsx` | Conditional list rendering + clear button |

---

### Task 1: Add `hasPatterns` and `reset` to the `useSearch` hook

**Files:**
- Modify: `packages/core/src/hooks/useSearch.test.ts`
- Modify: `packages/core/src/hooks/useSearch.ts`

- [ ] **Step 1: Add failing tests**

Open `packages/core/src/hooks/useSearch.test.ts` and append these five test cases inside the `describe('useSearch', ...)` block:

```ts
  it('hasPatterns is false when query is empty', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    expect(result.current.hasPatterns).toBe(false)
  })

  it('hasPatterns is false when query is below minLength', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('a'))
    expect(result.current.hasPatterns).toBe(false)
  })

  it('hasPatterns is true when query has valid patterns', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('ap'))
    expect(result.current.hasPatterns).toBe(true)
  })

  it('reset clears the query', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('apple'))
    act(() => result.current.reset())
    expect(result.current.query).toBe('')
  })

  it('reset sets hasPatterns to false', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('apple'))
    act(() => result.current.reset())
    expect(result.current.hasPatterns).toBe(false)
  })
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @quaesitor-textus/core test
```

Expected: 5 new failures like `TypeError: result.current.hasPatterns is undefined` and `TypeError: result.current.reset is not a function`. All existing tests still pass.

- [ ] **Step 3: Implement `hasPatterns` and `reset` in the hook**

Replace the full contents of `packages/core/src/hooks/useSearch.ts` with:

```ts
import { useState, useMemo, useCallback } from 'react'
import { parseInput } from '../logic/parseInput'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'

export interface UseSearchResult<T> {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  filteredItems: T[]
  hasPatterns: boolean
  reset: () => void
}

/**
 * A self-contained hook for text search and filtering.
 *
 * @param items - The items to filter.
 * @param getCorpus - Function that extracts the searchable text from an item.
 *   Pass a stable reference (e.g. wrap with `useCallback`) to avoid
 *   recomputing `filteredItems` on every render.
 * @param options - Optional search configuration.
 */
export function useSearch<T>(
  items: T[],
  getCorpus: (item: T) => string,
  options?: SearchOptions
): UseSearchResult<T> {
  const [query, setQuery] = useState('')
  const { caseSensitive = false, diacriticSensitive = false, minLength = 2 } = options ?? {}

  const patterns = useMemo(
    () => parseInput(query, { caseSensitive, diacriticSensitive, minLength }),
    [query, caseSensitive, diacriticSensitive, minLength]
  )

  const filteredItems = useMemo(
    () => items.filter(item => matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })),
    [items, patterns, getCorpus, caseSensitive, diacriticSensitive]
  )

  const hasPatterns = patterns.length > 0

  const reset = useCallback(() => setQuery(''), [setQuery])

  return { query, setQuery, patterns, filteredItems, hasPatterns, reset }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @quaesitor-textus/core test
```

Expected: all tests pass, including the 5 new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/hooks/useSearch.ts packages/core/src/hooks/useSearch.test.ts
git commit -m "feat(core): add hasPatterns and reset to useSearch hook"
```

---

### Task 2: Thread `hasPatterns` and `reset` through the context

**Files:**
- Modify: `packages/core/src/context/SearchContext.ts`
- Modify: `packages/core/src/context/WithSearch.tsx`

No new tests are needed here — the context wiring is covered by `WithSearch.test.tsx` once types compile, and the hook already has full coverage.

- [ ] **Step 1: Update `SearchContextValue` interface**

Replace the full contents of `packages/core/src/context/SearchContext.ts` with:

```ts
import { createContext } from 'react'

export interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  executeSearch: <T>(items: T[], getCorpus: (item: T) => string) => T[]
  hasPatterns: boolean
  reset: () => void
}

export const SearchContext = createContext<SearchContextValue | null>(null)
```

- [ ] **Step 2: Wire `hasPatterns` and `reset` in `WithSearch`**

Replace the full contents of `packages/core/src/context/WithSearch.tsx` with:

```tsx
import React, { useState, useMemo, useCallback } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'
import { parseInput } from '../logic/parseInput'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'

export interface WithSearchProps {
  options?: SearchOptions
  children: React.ReactNode
}

export function WithSearch({ options, children }: WithSearchProps) {
  const [query, setQuery] = useState('')
  const { caseSensitive = false, diacriticSensitive = false, minLength = 2 } = options ?? {}

  const patterns = useMemo(
    () => parseInput(query, { caseSensitive, diacriticSensitive, minLength }),
    [query, caseSensitive, diacriticSensitive, minLength]
  )

  const executeSearch = useMemo(
    (): SearchContextValue['executeSearch'] =>
      function executeSearch<T>(items: T[], getCorpus: (item: T) => string): T[] {
        return items.filter(item =>
          matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })
        )
      },
    [patterns, caseSensitive, diacriticSensitive]
  )

  const hasPatterns = patterns.length > 0

  const reset = useCallback(() => setQuery(''), [setQuery])

  const value: SearchContextValue = useMemo(
    () => ({ query, setQuery, patterns, executeSearch, hasPatterns, reset }),
    [query, setQuery, patterns, executeSearch, hasPatterns, reset]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
```

- [ ] **Step 3: Run tests — verify all pass**

```bash
pnpm --filter @quaesitor-textus/core test
```

Expected: all tests pass (TypeScript errors from context type mismatch are gone).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/context/SearchContext.ts packages/core/src/context/WithSearch.tsx
git commit -m "feat(core): thread hasPatterns and reset through search context"
```

---

### Task 3: Update `FullListDemo` story

**Files:**
- Modify: `packages/core/stories/FullListDemo.stories.tsx`

No automated tests — verify visually in Storybook (`make storybook`).

- [ ] **Step 1: Update the story**

Replace the full contents of `packages/core/stories/FullListDemo.stories.tsx` with:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { WithSearch, SearchInput, HighlightedText, useSearchContext } from '../src'
import { phrases } from './data/phrases'

const meta: Meta = {
  title: 'Core/FullListDemo',
}

export default meta

const FullList = () => {
  const { executeSearch, patterns, hasPatterns, reset, query } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <SearchInput
          placeholder="Search phrases…"
          style={{ flex: 1, padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
          autoFocus
        />
        {query.length > 0 && (
          <button
            onClick={reset}
            style={{ padding: '6px 10px', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            {filtered.length} of {phrases.length} phrases
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {filtered.map(phrase => (
              <li key={phrase} style={{ marginBottom: 4 }}>
                <HighlightedText text={phrase} patterns={patterns} />
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            <p style={{ color: '#999', fontStyle: 'italic' }}>No results — try a different term</p>
          )}
        </>
      )}
    </div>
  )
}

export const Default: StoryObj = {
  render: () => (
    <WithSearch>
      <FullList />
    </WithSearch>
  ),
}
```

- [ ] **Step 2: Run tests — verify all pass**

```bash
pnpm --filter @quaesitor-textus/core test
```

Expected: all tests pass (no test changes in this task).

- [ ] **Step 3: Commit**

```bash
git add packages/core/stories/FullListDemo.stories.tsx
git commit -m "feat(core): conditional list and clear button in FullListDemo story"
```
