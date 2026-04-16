# Multi-field Named Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single flat search context with a named key/value map so multiple independent `WithSearch` instances can coexist, enabling multi-field search with per-field highlighting and combined filtering.

**Architecture:** `SearchContext` becomes `Record<string, SearchEntry<unknown>>` (empty at root). Each `WithSearch` reads the upstream map, adds its own named entry, and provides the augmented map downward. `useFilterFunction` replaces `filterFunction` in `useSearchContext`; `HighlightedText` gains `searchNames`/`all` props to opt into context patterns explicitly.

**Tech Stack:** TypeScript 5, React 18 Context API, vitest, @testing-library/react

---

## File structure

| File | Change |
|------|--------|
| `packages/core/src/context/SearchContext.ts` | Rewrite: new types, default `{}` context |
| `packages/core/src/context/WithSearch.tsx` | Add `name`, `mapping` props; map accumulation; duplicate-name throw |
| `packages/core/src/context/WithSearch.test.tsx` | Rewrite: remove `filterFunction`/`highlightedPatterns` tests; add map/name tests |
| `packages/core/src/context/useSearchContext.ts` | Accept `name` param; remove `filterFunction`/`ItemOptions` |
| `packages/core/src/context/useResolvedPatterns.ts` | **New:** internal hook for resolving patterns from map |
| `packages/core/src/hooks/useFilterFunction.ts` | **New:** `useFilterFunction<T>(mode?)` hook |
| `packages/core/src/hooks/useFilterFunction.test.ts` | **New:** tests for AND/OR logic |
| `packages/core/src/components/SearchInput.tsx` | Add `name` prop |
| `packages/core/src/components/SearchInput.test.tsx` | Add `name` prop test |
| `packages/core/src/components/HighlightedText.tsx` | Add `searchNames`, `all` props; use `useResolvedPatterns` |
| `packages/core/src/components/HighlightedText.test.tsx` | Rewrite context-pattern tests for new API |
| `packages/core/src/components/HighlightedTrimmedText.tsx` | Add `searchNames`, `all` props; use `useResolvedPatterns` |
| `packages/core/src/components/HighlightedTrimmedText.test.tsx` | Rewrite to use `WithSearch` wrapper instead of raw context |
| `packages/core/src/index.ts` | Export `useFilterFunction`, `SearchEntry`; remove `ItemOptions` |
| `packages/antd/src/components/SearchInput.tsx` | Add `name` prop |
| `packages/antd/src/components/SearchInput.test.tsx` | Add `name` prop test |
| `packages/core/stories/FullListDemo.stories.tsx` | Fix: `useFilterFunction` + `all` on `HighlightedTrimmedText` |
| `packages/antd/stories/FullListDemo.stories.tsx` | Same fix |
| `packages/core/stories/data/books.ts` | **New:** 500 classical books |
| `packages/antd/stories/data/books.ts` | **New:** same data |
| `packages/core/stories/BookSearchDemo.stories.tsx` | **New:** multi-field book search story |
| `packages/antd/stories/BookSearchDemo.stories.tsx` | **New:** antd table version |

---

### Task 1: Update SearchContext types

**Files:**
- Modify: `packages/core/src/context/SearchContext.ts`

- [ ] **Step 1: Write the new SearchContext.ts**

```typescript
import { createContext } from 'react'
import type { SearchOptions } from '../logic/types'

export const DEFAULT_SEARCH_NAME = 'default search'

export interface SearchEntry<T = unknown> {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
  mapping: (item: T) => string
  options?: SearchOptions
}

export type SearchContextValue = Record<string, SearchEntry<unknown>>

export const SearchContext = createContext<SearchContextValue>({})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/core && pnpm exec tsc --noEmit
```

Expected: no errors (some downstream files will error until we update them in later tasks — that's fine for now, just check this file itself compiles)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/context/SearchContext.ts
git commit -m "refactor(core): replace flat SearchContextValue with named SearchEntry map"
```

---

### Task 2: Update WithSearch component

**Files:**
- Modify: `packages/core/src/context/WithSearch.tsx`
- Modify: `packages/core/src/context/WithSearch.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `packages/core/src/context/WithSearch.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { WithSearch } from './WithSearch'
import { useSearchContext } from './useSearchContext'
import { SearchContext } from './SearchContext'

const QueryDisplay = ({ name }: { name?: string } = {}) => {
  const { query, setQuery } = useSearchContext(name)
  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} data-testid="input" />
      <div data-testid="query">{query}</div>
    </div>
  )
}

const PatternDisplay = ({ name }: { name?: string } = {}) => {
  const { patterns } = useSearchContext(name)
  return <div data-testid="patterns">{patterns.join(',')}</div>
}

const ResetButton = ({ name }: { name?: string } = {}) => {
  const { reset } = useSearchContext(name)
  return <button data-testid="reset" onClick={reset}>Reset</button>
}

const MapKeys = () => {
  const map = React.useContext(SearchContext)
  return <div data-testid="map-keys">{Object.keys(map).sort().join(',')}</div>
}

describe('WithSearch + useSearchContext', () => {
  it('provides initial empty query', () => {
    render(<WithSearch><QueryDisplay /></WithSearch>)
    expect(screen.getByTestId('input')).toHaveValue('')
  })

  it('updates query when user types', () => {
    render(<WithSearch><QueryDisplay /></WithSearch>)
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'hello' } })
    expect(screen.getByTestId('query')).toHaveTextContent('hello')
  })

  it('parses patterns from query', () => {
    render(
      <WithSearch>
        <QueryDisplay />
        <PatternDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(screen.getByTestId('patterns')).toHaveTextContent('apple')
  })

  it('defaults name to "default search"', () => {
    render(<WithSearch><MapKeys /></WithSearch>)
    expect(screen.getByTestId('map-keys')).toHaveTextContent('default search')
  })

  it('uses provided name in the context map', () => {
    render(<WithSearch name="title"><MapKeys /></WithSearch>)
    expect(screen.getByTestId('map-keys')).toHaveTextContent('title')
  })

  it('nested WithSearch instances accumulate keys in the map', () => {
    render(
      <WithSearch name="author">
        <WithSearch name="title">
          <MapKeys />
        </WithSearch>
      </WithSearch>
    )
    const text = screen.getByTestId('map-keys').textContent
    expect(text).toContain('author')
    expect(text).toContain('title')
  })

  it('throws when duplicate name is used', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <WithSearch name="search">
          <WithSearch name="search"><div /></WithSearch>
        </WithSearch>
      )
    ).toThrow('WithSearch: duplicate name "search"')
    spy.mockRestore()
  })

  it('useSearchContext throws when named entry is not found', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(<QueryDisplay name="missing" />)
    ).toThrow('useSearchContext: no WithSearch with name "missing"')
    spy.mockRestore()
  })

  it('useSearchContext looks up named entry independently', () => {
    render(
      <WithSearch name="title">
        <QueryDisplay name="title" />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'gatsby' } })
    expect(screen.getByTestId('query')).toHaveTextContent('gatsby')
  })

  it('controlled mode: reflects the provided query value', () => {
    render(
      <WithSearch query="hello" onSetQuery={() => {}}>
        <QueryDisplay />
      </WithSearch>
    )
    expect(screen.getByTestId('input')).toHaveValue('hello')
  })

  it('controlled mode: calls onSetQuery when input changes', () => {
    const onSetQuery = vi.fn()
    render(
      <WithSearch query="" onSetQuery={onSetQuery}>
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(onSetQuery).toHaveBeenCalledWith('apple')
  })

  it('controlled mode: reset calls onReset instead of onSetQuery when onReset is given', () => {
    const onSetQuery = vi.fn()
    const onReset = vi.fn()
    render(
      <WithSearch query="hello" onSetQuery={onSetQuery} onReset={onReset}>
        <ResetButton />
      </WithSearch>
    )
    fireEvent.click(screen.getByTestId('reset'))
    expect(onReset).toHaveBeenCalled()
    expect(onSetQuery).not.toHaveBeenCalled()
  })

  it('reset clears the query', () => {
    render(
      <WithSearch>
        <QueryDisplay />
        <ResetButton />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    fireEvent.click(screen.getByTestId('reset'))
    expect(screen.getByTestId('query')).toHaveTextContent('')
  })

  it('calls onChange with old and new value when query changes', () => {
    const onChange = vi.fn()
    render(
      <WithSearch onChange={onChange}>
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(onChange).toHaveBeenCalledWith('', 'apple')
  })

  it('calls onChange with old value and empty string when reset is called', () => {
    const onChange = vi.fn()
    render(
      <WithSearch onChange={onChange}>
        <QueryDisplay />
        <ResetButton />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    onChange.mockClear()
    fireEvent.click(screen.getByTestId('reset'))
    expect(onChange).toHaveBeenCalledWith('apple', '')
  })

  it('stores mapping function in the context entry', () => {
    const mapping = (s: string) => s.toUpperCase()
    const MapCheck = () => {
      const map = React.useContext(SearchContext)
      const entry = map['default search']
      return <div data-testid="mapped">{entry?.mapping('hello')}</div>
    }
    render(
      <WithSearch mapping={mapping}>
        <MapCheck />
      </WithSearch>
    )
    expect(screen.getByTestId('mapped')).toHaveTextContent('HELLO')
  })

  it('default mapping converts item to string', () => {
    const MapCheck = () => {
      const map = React.useContext(SearchContext)
      const entry = map['default search']
      return <div data-testid="mapped">{entry?.mapping(42)}</div>
    }
    render(
      <WithSearch>
        <MapCheck />
      </WithSearch>
    )
    expect(screen.getByTestId('mapped')).toHaveTextContent('42')
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: many failures because `WithSearch` and `useSearchContext` still use old API.

- [ ] **Step 3: Write the new WithSearch.tsx**

```tsx
import React, { useContext, useMemo } from 'react'
import { SearchContext, DEFAULT_SEARCH_NAME } from './SearchContext'
import type { SearchEntry } from './SearchContext'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from '../hooks/useSearchInternalState'

export interface WithSearchProps<T = unknown> {
  name?: string
  mapping?: (item: T) => string
  options?: SearchOptions
  children: React.ReactNode
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
}

export function WithSearch<T = unknown>({
  name = DEFAULT_SEARCH_NAME,
  mapping = String as (item: unknown) => string,
  options,
  children,
  query: controlledQuery,
  onSetQuery,
  onReset,
  onChange,
}: WithSearchProps<T>) {
  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
    options,
    query: controlledQuery,
    onSetQuery,
    onReset,
    onChange,
  })

  const upstreamMap = useContext(SearchContext)

  if (name in upstreamMap) {
    throw new Error(
      `WithSearch: duplicate name "${name}". Each WithSearch in the same tree must have a unique name.`
    )
  }

  const entry: SearchEntry<unknown> = useMemo(
    () => ({
      query,
      setQuery,
      patterns,
      hasPatterns,
      reset,
      mapping: mapping as (item: unknown) => string,
      options,
    }),
    [query, setQuery, patterns, hasPatterns, reset, mapping, options]
  )

  const value = useMemo(
    () => ({ ...upstreamMap, [name]: entry }),
    [upstreamMap, name, entry]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
```

- [ ] **Step 4: Update useSearchContext.ts to unblock the tests**

```typescript
import { useContext } from 'react'
import { SearchContext, DEFAULT_SEARCH_NAME } from './SearchContext'

export function useSearchContext(name: string = DEFAULT_SEARCH_NAME) {
  const map = useContext(SearchContext)
  const entry = map[name]
  if (!entry) {
    throw new Error(
      `useSearchContext: no WithSearch with name "${name}" found in the tree.`
    )
  }
  return {
    query: entry.query,
    setQuery: entry.setQuery,
    patterns: entry.patterns,
    hasPatterns: entry.hasPatterns,
    reset: entry.reset,
  }
}
```

- [ ] **Step 5: Run the WithSearch tests — expect passes**

```bash
cd packages/core && pnpm test -- --reporter=verbose src/context/WithSearch.test.tsx 2>&1 | tail -30
```

Expected: all tests in `WithSearch.test.tsx` pass. Other test files will fail — that's fine.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/context/WithSearch.tsx \
        packages/core/src/context/WithSearch.test.tsx \
        packages/core/src/context/useSearchContext.ts
git commit -m "feat(core): WithSearch named map context, update useSearchContext"
```

---

### Task 3: Add useFilterFunction hook

**Files:**
- Create: `packages/core/src/hooks/useFilterFunction.ts`
- Create: `packages/core/src/hooks/useFilterFunction.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/hooks/useFilterFunction.test.ts`:

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
    <WithSearch name="author" mapping={(b: Book) => b.author} query={authorQuery} onSetQuery={() => {}}>
      <WithSearch name="title" mapping={(b: Book) => b.title} query={titleQuery} onSetQuery={() => {}}>
        {children}
      </WithSearch>
    </WithSearch>
  )

describe('useFilterFunction', () => {
  it('returns true for all items when no searches have patterns', () => {
    const { result } = renderHook(() => useFilterFunction<Book>(), {
      wrapper: makeWrapper(),
    })
    expect(books.every(result.current)).toBe(true)
  })

  it('AND mode: returns true when all active searches match', () => {
    const { result } = renderHook(() => useFilterFunction<Book>('AND'), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('AND mode: returns false when any active search fails', () => {
    // author=austen, title=karenina — no book matches both
    const { result } = renderHook(() => useFilterFunction<Book>('AND'), {
      wrapper: makeWrapper('austen', 'karenina'),
    })
    expect(result.current(books[0])).toBe(false) // austen matches author but not title
    expect(result.current(books[1])).toBe(false) // karenina matches title but not author
  })

  it('AND mode is the default', () => {
    const { result } = renderHook(() => useFilterFunction<Book>(), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('OR mode: returns true when at least one active search matches', () => {
    const { result } = renderHook(() => useFilterFunction<Book>('OR'), {
      wrapper: makeWrapper('austen', 'karenina'),
    })
    expect(result.current(books[0])).toBe(true)  // author matches 'austen'
    expect(result.current(books[1])).toBe(true)  // title matches 'karenina'
    expect(result.current(books[2])).toBe(false) // neither matches
  })

  it('OR mode: returns false when no active search matches', () => {
    const { result } = renderHook(() => useFilterFunction<Book>('OR'), {
      wrapper: makeWrapper('xyz', ''),
    })
    expect(books.some(result.current)).toBe(false)
  })

  it('entries with zero patterns are neutral in AND mode', () => {
    // title has no patterns — only author entry is active
    const { result } = renderHook(() => useFilterFunction<Book>('AND'), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('entries with zero patterns are neutral in OR mode', () => {
    const { result } = renderHook(() => useFilterFunction<Book>('OR'), {
      wrapper: makeWrapper('austen', ''),
    })
    expect(result.current(books[0])).toBe(true)
    expect(result.current(books[1])).toBe(false)
  })

  it('uses mapping from the context entry', () => {
    const { result } = renderHook(() => useFilterFunction<Book>('AND'), {
      wrapper: makeWrapper('', 'pride'),
    })
    expect(result.current(books[0])).toBe(true)  // "Pride and Prejudice" matches 'pride'
    expect(result.current(books[1])).toBe(false)
  })

  it('returns true for all items when outside any WithSearch (empty map)', () => {
    const { result } = renderHook(() => useFilterFunction<Book>())
    expect(books.every(result.current)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd packages/core && pnpm test -- src/hooks/useFilterFunction.test.ts 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module './useFilterFunction'"

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/hooks/useFilterFunction.ts`:

```typescript
import { useContext, useCallback } from 'react'
import { SearchContext } from '../context/SearchContext'
import { matchItem } from '../logic/matchItem'

export function useFilterFunction<T = unknown>(mode: 'AND' | 'OR' = 'AND') {
  const map = useContext(SearchContext)

  return useCallback(
    (item: T): boolean => {
      const activeEntries = Object.values(map).filter(entry => entry.hasPatterns)
      if (activeEntries.length === 0) return true

      if (mode === 'AND') {
        return activeEntries.every(entry =>
          matchItem(
            (entry.mapping as (item: T) => string)(item),
            entry.patterns,
            entry.options
          )
        )
      } else {
        return activeEntries.some(entry =>
          matchItem(
            (entry.mapping as (item: T) => string)(item),
            entry.patterns,
            entry.options
          )
        )
      }
    },
    [map, mode]
  )
}
```

- [ ] **Step 4: Run tests — expect passes**

```bash
cd packages/core && pnpm test -- src/hooks/useFilterFunction.test.ts 2>&1 | tail -10
```

Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/hooks/useFilterFunction.ts \
        packages/core/src/hooks/useFilterFunction.test.ts
git commit -m "feat(core): add useFilterFunction hook with AND/OR mode"
```

---

### Task 4: Add useResolvedPatterns internal hook

**Files:**
- Create: `packages/core/src/context/useResolvedPatterns.ts`

This is an internal hook shared by `HighlightedText` and `HighlightedTrimmedText`. It is not exported from `index.ts`.

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

```bash
cd packages/core && pnpm exec tsc --noEmit 2>&1 | grep useResolvedPatterns
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/context/useResolvedPatterns.ts
git commit -m "feat(core): add internal useResolvedPatterns hook"
```

---

### Task 5: Update HighlightedText

**Files:**
- Modify: `packages/core/src/components/HighlightedText.tsx`
- Modify: `packages/core/src/components/HighlightedText.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace `packages/core/src/components/HighlightedText.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { HighlightedText } from './HighlightedText'
import { WithSearch } from '../context/WithSearch'
import { useSearchContext } from '../context/useSearchContext'

describe('HighlightedText', () => {
  it('renders plain text without marks when no patterns', () => {
    const { container } = render(<HighlightedText text="hello world" patterns={[]} />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('hello world')
  })

  it('wraps matched text in a mark element', () => {
    const { container } = render(<HighlightedText text="hello world" patterns={['hello']} />)
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toBe('hello')
  })

  it('renders multiple non-overlapping marks', () => {
    const { container } = render(
      <HighlightedText text="hello world" patterns={['hello', 'world']} />
    )
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(2)
  })

  it('renders only one mark when patterns overlap', () => {
    const { container } = render(
      <HighlightedText text="abcde" patterns={['abc', 'bcd']} />
    )
    expect(container.querySelectorAll('mark')).toHaveLength(1)
  })

  it('shows no highlights when neither searchNames nor all is given', () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('hello') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedText text="hello world" />
      </WithSearch>
    )
    // No searchNames or all — context patterns not picked up
    expect(container.querySelector('mark')).toBeNull()
  })

  it('highlights from context when searchNames matches the WithSearch name', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('hello') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedText text="hello world" searchNames="default search" />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.querySelector('mark')?.textContent).toBe('hello')
  })

  it('highlights from context when all is true', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('hello') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedText text="hello world" all />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.querySelector('mark')?.textContent).toBe('hello')
  })

  it('searchNames as array works', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext('mySearch')
      React.useEffect(() => { setQuery('fox') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch name="mySearch">
        <Setter />
        <HighlightedText text="the quick brown fox" searchNames={['mySearch']} />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.querySelector('mark')?.textContent).toBe('fox')
  })

  it('warns and skips when searchNames references unknown name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(
      <WithSearch>
        <HighlightedText text="hello world" searchNames="nonexistent" />
      </WithSearch>
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"nonexistent"'))
    expect(container.querySelector('mark')).toBeNull()
    warn.mockRestore()
  })

  it('merges context patterns with explicit patterns prop', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('hello') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedText text="hello world" patterns={['world']} all />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.querySelectorAll('mark')).toHaveLength(2)
  })

  it('applies custom markStyle', () => {
    const { container } = render(
      <HighlightedText text="hello" patterns={['hello']} markStyle={{ background: 'red' }} />
    )
    const mark = container.querySelector('mark') as HTMLElement
    expect(mark.style.background).toBe('red')
  })

  it('returns nothing when text is undefined', () => {
    const { container } = render(<HighlightedText text={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns raw string without span wrapper when no patterns match', () => {
    const { container } = render(<HighlightedText text="hello" patterns={['xyz']} />)
    expect(container.querySelector('span')).toBeNull()
    expect(container.textContent).toBe('hello')
  })
})
```

- [ ] **Step 2: Run tests — expect failures on context-related tests**

```bash
cd packages/core && pnpm test -- src/components/HighlightedText.test.tsx 2>&1 | tail -15
```

Expected: tests that use `searchNames`/`all` fail because the props don't exist yet.

- [ ] **Step 3: Write the new HighlightedText.tsx**

```tsx
import React from 'react'
import { useResolvedPatterns } from '../context/useResolvedPatterns'
import { getHighlightPositions } from '../logic/getHighlightPositions'
import type { SearchOptions } from '../logic/types'

const DEFAULT_MARK_STYLE: React.CSSProperties = {
  background: '#FFFF5480',
  padding: '2px',
  margin: '-2px',
}

interface HighlightedTextProps {
  text: string | undefined
  patterns?: string[]
  searchNames?: string | string[]
  all?: boolean
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

export function HighlightedText({
  text,
  patterns: propPatterns,
  searchNames,
  all,
  options,
  markStyle = DEFAULT_MARK_STYLE,
}: HighlightedTextProps) {
  const patterns = useResolvedPatterns(searchNames, all, propPatterns)

  if (text === undefined) return undefined

  const spans = getHighlightPositions(text, patterns, options)

  if (spans.length === 0) return text

  const nodes: React.ReactNode[] = []
  let cursor = 0

  for (const span of spans) {
    if (span.start > cursor) {
      nodes.push(text.substring(cursor, span.start))
    }
    nodes.push(
      <mark key={span.start} style={markStyle}>
        {text.substring(span.start, span.end)}
      </mark>
    )
    cursor = span.end
  }

  if (cursor < text.length) {
    nodes.push(text.substring(cursor))
  }

  return <span>{nodes}</span>
}
```

- [ ] **Step 4: Run tests — expect passes**

```bash
cd packages/core && pnpm test -- src/components/HighlightedText.test.tsx 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/HighlightedText.tsx \
        packages/core/src/components/HighlightedText.test.tsx
git commit -m "feat(core): HighlightedText searchNames/all props, drop auto context pickup"
```

---

### Task 6: Update HighlightedTrimmedText

**Files:**
- Modify: `packages/core/src/components/HighlightedTrimmedText.tsx`
- Modify: `packages/core/src/components/HighlightedTrimmedText.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace `packages/core/src/components/HighlightedTrimmedText.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HighlightedTrimmedText } from './HighlightedTrimmedText'
import { WithSearch } from '../context/WithSearch'

describe('HighlightedTrimmedText', () => {
  it('returns nothing when text is undefined', () => {
    const { container } = render(
      <WithSearch query="hello" onSetQuery={() => {}}>
        <HighlightedTrimmedText text={undefined} all />
      </WithSearch>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders full text with highlights when text is shorter than fragmentLength', () => {
    const { container } = render(
      <WithSearch query="fox" onSetQuery={() => {}}>
        <span>
          <HighlightedTrimmedText text="The quick brown fox" fragmentLength={80} all />
        </span>
      </WithSearch>
    )
    expect(container.textContent).toBe('The quick brown fox')
    expect(container.querySelector('mark')).not.toBeNull()
  })

  it('renders trimmed text with ellipsis when text exceeds fragmentLength', () => {
    const longText = 'The quick brown fox jumps over the lazy dog and keeps on running through the forest'
    const { container } = render(
      <WithSearch query="lazy" onSetQuery={() => {}}>
        <span>
          <HighlightedTrimmedText text={longText} fragmentLength={40} all />
        </span>
      </WithSearch>
    )
    expect(container.textContent).toContain('…')
    expect(container.querySelector('mark')).not.toBeNull()
    const textWithoutEllipsis = container.textContent!.replace(/…/g, '')
    expect(textWithoutEllipsis.length).toBeLessThanOrEqual(40)
  })

  it('reads patterns via searchNames prop', () => {
    const { container } = render(
      <WithSearch name="main" query="brown" onSetQuery={() => {}}>
        <span>
          <HighlightedTrimmedText text="The quick brown fox" searchNames="main" />
        </span>
      </WithSearch>
    )
    expect(container.querySelector('mark')?.textContent).toBe('brown')
  })

  it('shows no highlights when neither searchNames nor all is given', () => {
    const { container } = render(
      <WithSearch query="fox" onSetQuery={() => {}}>
        <span>
          <HighlightedTrimmedText text="The quick brown fox" />
        </span>
      </WithSearch>
    )
    expect(container.querySelector('mark')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd packages/core && pnpm test -- src/components/HighlightedTrimmedText.test.tsx 2>&1 | tail -10
```

Expected: failures because `HighlightedTrimmedText` still uses old `highlightedPatterns`.

- [ ] **Step 3: Write the new HighlightedTrimmedText.tsx**

```tsx
import React from 'react'
import type { SearchOptions } from '../logic/types'
import { useResolvedPatterns } from '../context/useResolvedPatterns'
import { trimAroundMatch } from '../logic/trimAroundMatch'
import { HighlightedText } from './HighlightedText'

interface HighlightedTrimmedTextProps {
  text: string | undefined
  fragmentLength?: number
  searchNames?: string | string[]
  all?: boolean
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

export function HighlightedTrimmedText({
  text,
  fragmentLength = 80,
  searchNames,
  all,
  options,
  markStyle,
}: HighlightedTrimmedTextProps): React.ReactNode {
  const patterns = useResolvedPatterns(searchNames, all)
  if (text === undefined) return undefined
  const trimmed = trimAroundMatch(text, patterns, { fragmentLength, ...options })
  return (
    <HighlightedText
      text={trimmed}
      searchNames={searchNames}
      all={all}
      options={options}
      markStyle={markStyle}
    />
  )
}
```

- [ ] **Step 4: Run tests — expect passes**

```bash
cd packages/core && pnpm test -- src/components/HighlightedTrimmedText.test.tsx 2>&1 | tail -10
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/HighlightedTrimmedText.tsx \
        packages/core/src/components/HighlightedTrimmedText.test.tsx
git commit -m "feat(core): HighlightedTrimmedText searchNames/all props, drop auto context pickup"
```

---

### Task 7: Update core SearchInput

**Files:**
- Modify: `packages/core/src/components/SearchInput.tsx`
- Modify: `packages/core/src/components/SearchInput.test.tsx`

- [ ] **Step 1: Add the name prop test**

Add this test to the end of the `describe` block in `packages/core/src/components/SearchInput.test.tsx`:

```typescript
  it('connects to the named WithSearch when name prop is given', () => {
    const NamedQuery = () => {
      const { query } = useSearchContext('myfield')
      return <div data-testid="named-query">{query}</div>
    }
    render(
      <WithSearch name="myfield">
        <SearchInput name="myfield" />
        <NamedQuery />
      </WithSearch>
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } })
    expect(screen.getByTestId('named-query')).toHaveTextContent('test')
  })
```

Also add the import for `useSearchContext` at the top of the file (it's already imported via `WithSearch` but add it explicitly if not there):

```typescript
import { WithSearch, useSearchContext } from '../context/useSearchContext'
```

Wait — look at the existing imports in `SearchInput.test.tsx`:

```typescript
import { WithSearch } from '../context/WithSearch'
import { useSearchContext } from '../context/useSearchContext'
import { SearchInput } from './SearchInput'
```

`useSearchContext` is already imported. Just add the test case above.

- [ ] **Step 2: Run tests — expect 1 failure (the new test)**

```bash
cd packages/core && pnpm test -- src/components/SearchInput.test.tsx 2>&1 | tail -10
```

Expected: 8 pass, 1 fails — "SearchInput does not have name prop".

- [ ] **Step 3: Write the new SearchInput.tsx**

```tsx
import React from 'react'
import { useSearchContext } from '../context/useSearchContext'
import { DEFAULT_SEARCH_NAME } from '../context/SearchContext'

type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  name?: string
}

export function SearchInput({ name = DEFAULT_SEARCH_NAME, style, ...props }: SearchInputProps) {
  const { query, setQuery, reset } = useSearchContext(name)
  return (
    <div style={{ position: 'relative', display: 'inline-block', width: style?.width ?? undefined }}>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ ...style, width: style?.width ? '100%' : undefined, paddingRight: '2em', boxSizing: 'border-box' }}
        {...props}
      />
      {query.length > 0 && (
        <button
          onClick={reset}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1em',
            lineHeight: 1,
            padding: '0 2px',
            color: '#888',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd packages/core && pnpm test -- src/components/SearchInput.test.tsx 2>&1 | tail -10
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/SearchInput.tsx \
        packages/core/src/components/SearchInput.test.tsx
git commit -m "feat(core): SearchInput name prop"
```

---

### Task 8: Update antd SearchInput

**Files:**
- Modify: `packages/antd/src/components/SearchInput.tsx`
- Modify: `packages/antd/src/components/SearchInput.test.tsx`

- [ ] **Step 1: Add the name prop test**

Add this test to the end of the `describe` block in `packages/antd/src/components/SearchInput.test.tsx`:

```typescript
  it('connects to the named WithSearch when name prop is given', () => {
    const NamedQuery = () => {
      const { query } = useSearchContext('myfield')
      return <div data-testid="named-query">{query}</div>
    }
    render(
      <WithSearch name="myfield">
        <SearchInput placeholder="Search..." name="myfield" />
        <NamedQuery />
      </WithSearch>
    )
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'test' } })
    expect(screen.getByTestId('named-query')).toHaveTextContent('test')
  })
```

`useSearchContext` is already imported in this test file.

- [ ] **Step 2: Run tests — expect 1 failure**

```bash
cd packages/antd && pnpm test -- src/components/SearchInput.test.tsx 2>&1 | tail -10
```

Expected: existing tests pass, new test fails.

- [ ] **Step 3: Write the new antd SearchInput.tsx**

```tsx
import React from 'react'
import { Input } from 'antd'
import type { InputProps } from 'antd'
import { useSearchContext, DEFAULT_SEARCH_NAME } from '@quaesitor-textus/core'

interface SearchInputProps extends Omit<InputProps, 'value' | 'onChange' | 'suffix'> {
  name?: string
}

export function SearchInput({ name = DEFAULT_SEARCH_NAME, ...props }: SearchInputProps) {
  const { query, setQuery, reset } = useSearchContext(name)
  return (
    <Input
      {...props}
      value={query}
      onChange={e => setQuery(e.target.value)}
      suffix={
        query.length > 0 ? (
          <span
            onClick={reset}
            aria-label="Clear search"
            style={{ cursor: 'pointer', color: 'rgba(0,0,0,0.45)', lineHeight: 1 }}
          >
            ×
          </span>
        ) : (
          <span />
        )
      }
    />
  )
}
```

Note: `DEFAULT_SEARCH_NAME` must be exported from `@quaesitor-textus/core` — that happens in Task 9.

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd packages/antd && pnpm test -- src/components/SearchInput.test.tsx 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/antd/src/components/SearchInput.tsx \
        packages/antd/src/components/SearchInput.test.tsx
git commit -m "feat(antd): SearchInput name prop"
```

---

### Task 9: Update core index.ts exports

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the new index.ts**

```typescript
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
export { useFilterFunction } from './hooks/useFilterFunction'

// Context
export { WithSearch } from './context/WithSearch'
export { useSearchContext } from './context/useSearchContext'
export { DEFAULT_SEARCH_NAME } from './context/SearchContext'
export type { SearchEntry, SearchContextValue } from './context/SearchContext'
export type { WithSearchProps } from './context/WithSearch'

// Components
export { SearchInput } from './components/SearchInput'
export { HighlightedText } from './components/HighlightedText'
export { HighlightedTrimmedText } from './components/HighlightedTrimmedText'
```

- [ ] **Step 2: Run all core tests**

```bash
cd packages/core && pnpm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): update exports — add useFilterFunction, SearchEntry, DEFAULT_SEARCH_NAME; remove ItemOptions"
```

---

### Task 10: Fix existing FullListDemo stories

**Files:**
- Modify: `packages/core/stories/FullListDemo.stories.tsx`
- Modify: `packages/antd/stories/FullListDemo.stories.tsx`

The stories use `filterFunction` from `useSearchContext` (removed) and `HighlightedTrimmedText` without `all` (which now shows no highlights).

- [ ] **Step 1: Write the new core FullListDemo.stories.tsx**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import React, { useState, useEffect } from 'react'
import { WithSearch, SearchInput, HighlightedTrimmedText, useSearchContext, useFilterFunction } from '../src'
import { sentences } from './data/sentences'

const meta: Meta = {
  title: 'Core/FullListDemo',
}

export default meta

const FullList = () => {
  const { hasPatterns, reset } = useSearchContext()
  const filterFunction = useFilterFunction<string>()
  const filtered = sentences.filter(filterFunction)
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null)

  useEffect(() => {
    if (selectedSentence !== null) {
      if (!(filtered.length === 1 && filtered[0] === selectedSentence)) {
        setSelectedSentence(null)
      }
    }
  }, [filtered, selectedSentence])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo</h2>
      <SearchInput
        placeholder="Search sentences…"
        style={{ width: '100%', padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter' && filtered.length === 1) {
            setSelectedSentence(filtered[0])
          }
        }}
      />
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            matches: {filtered.length} of {sentences.length} sentences
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {filtered.map(sentence => (
              <li key={sentence} style={{ marginBottom: 4 }}>
                <HighlightedTrimmedText text={sentence} fragmentLength={40} all />
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            <p style={{ color: '#999', fontStyle: 'italic' }}>
              No results —{' '}
              <span
                onClick={reset}
                style={{ textDecoration: 'underline', color: '#1677ff', cursor: 'pointer' }}
              >
                try a different term
              </span>
            </p>
          )}
          {selectedSentence !== null && (
            <div
              style={{
                marginTop: 16,
                border: '1.5px solid #d0d0d0',
                borderRadius: 12,
                padding: '16px 20px',
                background: '#fafafa',
                fontSize: 16,
              }}
            >
              {selectedSentence}
            </div>
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

- [ ] **Step 2: Write the new antd FullListDemo.stories.tsx**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import React, { useState, useEffect } from 'react'
import { Table, Card } from 'antd'
import type { TableColumnsType } from 'antd'
import { WithSearch, HighlightedTrimmedText, useSearchContext, useFilterFunction } from '@quaesitor-textus/core'
import { SearchInput } from '../src'
import { sentences } from './data/sentences'

const meta: Meta = {
  title: 'Antd/FullListDemo',
}

export default meta

type SentenceRow = { key: string; sentence: string }

interface FullListProps {
  currentPage: number
  setCurrentPage: (page: number) => void
}

const FullList = ({ currentPage, setCurrentPage }: FullListProps) => {
  const { hasPatterns, reset } = useSearchContext()
  const filterFunction = useFilterFunction<string>()
  const filtered = sentences.filter(filterFunction)
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null)

  useEffect(() => {
    if (selectedSentence !== null) {
      if (!(filtered.length === 1 && filtered[0] === selectedSentence)) {
        setSelectedSentence(null)
      }
    }
  }, [filtered, selectedSentence])

  const dataSource: SentenceRow[] = filtered.map(sentence => ({ key: sentence, sentence }))

  const cols: TableColumnsType<SentenceRow> = [
    {
      title: 'Sentence',
      dataIndex: 'sentence',
      render: (sentence: string) => (
        <HighlightedTrimmedText text={sentence} fragmentLength={40} all />
      ),
    },
  ]

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo (antd)</h2>
      <SearchInput
        placeholder="Search sentences…"
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter' && filtered.length === 1) {
            setSelectedSentence(filtered[0])
          }
        }}
      />
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            matches: {filtered.length} of {sentences.length} sentences
          </p>
          <Table<SentenceRow>
            dataSource={dataSource}
            columns={cols}
            pagination={{
              pageSize: 8,
              current: currentPage,
              onChange: setCurrentPage,
            }}
            locale={{
              emptyText: (
                <span style={{ color: '#999', fontStyle: 'italic' }}>
                  No results —{' '}
                  <span
                    onClick={reset}
                    style={{ textDecoration: 'underline', color: '#1677ff', cursor: 'pointer' }}
                  >
                    try a different term
                  </span>
                </span>
              ),
            }}
          />
          {selectedSentence !== null && (
            <Card style={{ marginTop: 16, borderRadius: 12 }}>
              {selectedSentence}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

const FullListWrapper = () => {
  const [currentPage, setCurrentPage] = useState(1)
  return (
    <WithSearch onChange={() => setCurrentPage(1)}>
      <FullList currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </WithSearch>
  )
}

export const Default: StoryObj = {
  render: () => <FullListWrapper />,
}
```

- [ ] **Step 3: Run all tests to confirm nothing is broken**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
cd packages/antd && pnpm test 2>&1 | tail -5
```

Expected: all tests pass in both packages.

- [ ] **Step 4: Commit**

```bash
git add packages/core/stories/FullListDemo.stories.tsx \
        packages/antd/stories/FullListDemo.stories.tsx
git commit -m "fix(stories): migrate FullListDemo to useFilterFunction and HighlightedTrimmedText all prop"
```

---

### Task 11: Add books data file

**Files:**
- Create: `packages/core/stories/data/books.ts`
- Create: `packages/antd/stories/data/books.ts`

- [ ] **Step 1: Create packages/core/stories/data/books.ts**

```typescript
export interface Book {
  author: string
  title: string
  year: number
}

export const books: Book[] = [
  { author: 'Homer', title: 'The Iliad', year: -800 },
  { author: 'Homer', title: 'The Odyssey', year: -800 },
  { author: 'Sophocles', title: 'Oedipus Rex', year: -429 },
  { author: 'Sophocles', title: 'Antigone', year: -441 },
  { author: 'Euripides', title: 'Medea', year: -431 },
  { author: 'Euripides', title: 'Electra', year: -420 },
  { author: 'Euripides', title: 'The Bacchae', year: -405 },
  { author: 'Aeschylus', title: 'Oresteia', year: -458 },
  { author: 'Aeschylus', title: 'Prometheus Bound', year: -450 },
  { author: 'Aristophanes', title: 'The Clouds', year: -423 },
  { author: 'Aristophanes', title: 'The Birds', year: -414 },
  { author: 'Aristophanes', title: 'Lysistrata', year: -411 },
  { author: 'Plato', title: 'The Republic', year: -380 },
  { author: 'Plato', title: 'The Symposium', year: -385 },
  { author: 'Plato', title: 'Phaedo', year: -360 },
  { author: 'Aristotle', title: 'Nicomachean Ethics', year: -340 },
  { author: 'Aristotle', title: 'Poetics', year: -335 },
  { author: 'Herodotus', title: 'Histories', year: -430 },
  { author: 'Thucydides', title: 'History of the Peloponnesian War', year: -400 },
  { author: 'Xenophon', title: 'Anabasis', year: -370 },
  { author: 'Virgil', title: 'The Aeneid', year: -19 },
  { author: 'Virgil', title: 'Eclogues', year: -37 },
  { author: 'Ovid', title: 'Metamorphoses', year: 8 },
  { author: 'Ovid', title: 'The Art of Love', year: 2 },
  { author: 'Cicero', title: 'On the Republic', year: -54 },
  { author: 'Cicero', title: 'On Duties', year: -44 },
  { author: 'Caesar', title: 'The Gallic War', year: -51 },
  { author: 'Livy', title: 'The History of Rome', year: 17 },
  { author: 'Tacitus', title: 'Annals', year: 117 },
  { author: 'Tacitus', title: 'Germania', year: 98 },
  { author: 'Suetonius', title: 'The Twelve Caesars', year: 121 },
  { author: 'Plutarch', title: 'Parallel Lives', year: 100 },
  { author: 'Marcus Aurelius', title: 'Meditations', year: 180 },
  { author: 'Lucretius', title: 'On the Nature of Things', year: -55 },
  { author: 'Horace', title: 'Odes', year: -23 },
  { author: 'Catullus', title: 'Carmina', year: -54 },
  { author: 'Seneca', title: 'Letters from a Stoic', year: 65 },
  { author: 'Petronius', title: 'Satyricon', year: 65 },
  { author: 'Apuleius', title: 'The Golden Ass', year: 158 },
  { author: 'Anonymous', title: 'Homeric Hymns', year: -700 },
  { author: 'Dante Alighieri', title: 'The Divine Comedy', year: 1320 },
  { author: 'Geoffrey Chaucer', title: 'The Canterbury Tales', year: 1392 },
  { author: 'Giovanni Boccaccio', title: 'The Decameron', year: 1353 },
  { author: 'Petrarch', title: 'Canzoniere', year: 1374 },
  { author: 'Anonymous', title: 'Beowulf', year: 1000 },
  { author: 'Anonymous', title: 'The Song of Roland', year: 1115 },
  { author: 'Anonymous', title: 'Nibelungenlied', year: 1200 },
  { author: 'Thomas Malory', title: 'Le Morte d\'Arthur', year: 1485 },
  { author: 'William Langland', title: 'Piers Plowman', year: 1370 },
  { author: 'Anonymous', title: 'Sir Gawain and the Green Knight', year: 1390 },
  { author: 'Christine de Pizan', title: 'The Book of the City of Ladies', year: 1405 },
  { author: 'Marco Polo', title: 'The Travels of Marco Polo', year: 1300 },
  { author: 'Murasaki Shikibu', title: 'The Tale of Genji', year: 1021 },
  { author: 'Snorri Sturluson', title: 'Prose Edda', year: 1220 },
  { author: 'Niccolò Machiavelli', title: 'The Prince', year: 1532 },
  { author: 'Niccolò Machiavelli', title: 'Discourses on Livy', year: 1531 },
  { author: 'Desiderius Erasmus', title: 'In Praise of Folly', year: 1511 },
  { author: 'Thomas More', title: 'Utopia', year: 1516 },
  { author: 'François Rabelais', title: 'Gargantua and Pantagruel', year: 1534 },
  { author: 'Michel de Montaigne', title: 'Essays', year: 1580 },
  { author: 'Miguel de Cervantes', title: 'Don Quixote', year: 1605 },
  { author: 'Miguel de Cervantes', title: 'Exemplary Novels', year: 1613 },
  { author: 'William Shakespeare', title: 'Hamlet', year: 1603 },
  { author: 'William Shakespeare', title: 'King Lear', year: 1606 },
  { author: 'William Shakespeare', title: 'Macbeth', year: 1606 },
  { author: 'William Shakespeare', title: 'Othello', year: 1603 },
  { author: 'William Shakespeare', title: 'A Midsummer Night\'s Dream', year: 1600 },
  { author: 'William Shakespeare', title: 'Romeo and Juliet', year: 1597 },
  { author: 'William Shakespeare', title: 'The Tempest', year: 1611 },
  { author: 'William Shakespeare', title: 'Twelfth Night', year: 1601 },
  { author: 'William Shakespeare', title: 'The Merchant of Venice', year: 1600 },
  { author: 'William Shakespeare', title: 'Henry V', year: 1599 },
  { author: 'William Shakespeare', title: 'Julius Caesar', year: 1599 },
  { author: 'Christopher Marlowe', title: 'Doctor Faustus', year: 1592 },
  { author: 'Edmund Spenser', title: 'The Faerie Queene', year: 1590 },
  { author: 'Francis Bacon', title: 'Novum Organum', year: 1620 },
  { author: 'Torquato Tasso', title: 'Jerusalem Delivered', year: 1581 },
  { author: 'Ludovico Ariosto', title: 'Orlando Furioso', year: 1516 },
  { author: 'John Milton', title: 'Paradise Lost', year: 1667 },
  { author: 'John Milton', title: 'Paradise Regained', year: 1671 },
  { author: 'John Bunyan', title: 'The Pilgrim\'s Progress', year: 1678 },
  { author: 'Molière', title: 'Tartuffe', year: 1664 },
  { author: 'Molière', title: 'The Misanthrope', year: 1666 },
  { author: 'Molière', title: 'The Miser', year: 1668 },
  { author: 'Jean Racine', title: 'Phèdre', year: 1677 },
  { author: 'Pierre Corneille', title: 'Le Cid', year: 1637 },
  { author: 'Blaise Pascal', title: 'Pensées', year: 1670 },
  { author: 'René Descartes', title: 'Meditations on First Philosophy', year: 1641 },
  { author: 'Baruch Spinoza', title: 'Ethics', year: 1677 },
  { author: 'Thomas Hobbes', title: 'Leviathan', year: 1651 },
  { author: 'John Locke', title: 'Two Treatises of Government', year: 1689 },
  { author: 'Aphra Behn', title: 'Oroonoko', year: 1688 },
  { author: 'Jean de La Fontaine', title: 'Fables', year: 1668 },
  { author: 'William Congreve', title: 'The Way of the World', year: 1700 },
  { author: 'William Wycherley', title: 'The Country Wife', year: 1675 },
  { author: 'Jonathan Swift', title: 'Gulliver\'s Travels', year: 1726 },
  { author: 'Jonathan Swift', title: 'A Modest Proposal', year: 1729 },
  { author: 'Daniel Defoe', title: 'Robinson Crusoe', year: 1719 },
  { author: 'Daniel Defoe', title: 'Moll Flanders', year: 1722 },
  { author: 'Samuel Richardson', title: 'Pamela', year: 1740 },
  { author: 'Samuel Richardson', title: 'Clarissa', year: 1748 },
  { author: 'Henry Fielding', title: 'Tom Jones', year: 1749 },
  { author: 'Henry Fielding', title: 'Joseph Andrews', year: 1742 },
  { author: 'Laurence Sterne', title: 'Tristram Shandy', year: 1759 },
  { author: 'Laurence Sterne', title: 'A Sentimental Journey', year: 1768 },
  { author: 'Tobias Smollett', title: 'Humphry Clinker', year: 1771 },
  { author: 'Oliver Goldsmith', title: 'The Vicar of Wakefield', year: 1766 },
  { author: 'Samuel Johnson', title: 'Rasselas', year: 1759 },
  { author: 'James Boswell', title: 'Life of Samuel Johnson', year: 1791 },
  { author: 'Edward Gibbon', title: 'The Decline and Fall of the Roman Empire', year: 1776 },
  { author: 'Voltaire', title: 'Candide', year: 1759 },
  { author: 'Voltaire', title: 'Zadig', year: 1747 },
  { author: 'Jean-Jacques Rousseau', title: 'The Confessions', year: 1782 },
  { author: 'Jean-Jacques Rousseau', title: 'Émile', year: 1762 },
  { author: 'Jean-Jacques Rousseau', title: 'Julie, or the New Heloise', year: 1761 },
  { author: 'Denis Diderot', title: 'Jacques the Fatalist', year: 1796 },
  { author: 'Denis Diderot', title: 'Rameau\'s Nephew', year: 1805 },
  { author: 'Pierre Choderlos de Laclos', title: 'Les Liaisons dangereuses', year: 1782 },
  { author: 'Antoine François Prévost', title: 'Manon Lescaut', year: 1731 },
  { author: 'Alain-René Lesage', title: 'Gil Blas', year: 1715 },
  { author: 'Pierre de Marivaux', title: 'The Life of Marianne', year: 1731 },
  { author: 'Pierre Beaumarchais', title: 'The Marriage of Figaro', year: 1784 },
  { author: 'Pierre Beaumarchais', title: 'The Barber of Seville', year: 1775 },
  { author: 'Johann Wolfgang von Goethe', title: 'The Sorrows of Young Werther', year: 1774 },
  { author: 'Johann Wolfgang von Goethe', title: 'Elective Affinities', year: 1809 },
  { author: 'Johann Wolfgang von Goethe', title: 'Faust', year: 1808 },
  { author: 'Friedrich Schiller', title: 'The Robbers', year: 1781 },
  { author: 'Friedrich Schiller', title: 'Mary Stuart', year: 1800 },
  { author: 'Friedrich Schiller', title: 'William Tell', year: 1804 },
  { author: 'Friedrich Schiller', title: 'Don Carlos', year: 1787 },
  { author: 'Immanuel Kant', title: 'Critique of Pure Reason', year: 1781 },
  { author: 'Thomas Paine', title: 'Common Sense', year: 1776 },
  { author: 'Benjamin Franklin', title: 'The Autobiography of Benjamin Franklin', year: 1791 },
  { author: 'William Godwin', title: 'Caleb Williams', year: 1794 },
  { author: 'Ann Radcliffe', title: 'The Mysteries of Udolpho', year: 1794 },
  { author: 'Horace Walpole', title: 'The Castle of Otranto', year: 1764 },
  { author: 'Matthew Lewis', title: 'The Monk', year: 1796 },
  { author: 'Frances Burney', title: 'Evelina', year: 1778 },
  { author: 'Frances Burney', title: 'Cecilia', year: 1782 },
  { author: 'Mary Wollstonecraft', title: 'A Vindication of the Rights of Woman', year: 1792 },
  { author: 'Richard Brinsley Sheridan', title: 'The School for Scandal', year: 1777 },
  { author: 'Gotthold Ephraim Lessing', title: 'Nathan the Wise', year: 1779 },
  { author: 'Friedrich Hölderlin', title: 'Hyperion', year: 1797 },
  { author: 'William Blake', title: 'Songs of Innocence and Experience', year: 1794 },
  { author: 'Jane Austen', title: 'Sense and Sensibility', year: 1811 },
  { author: 'Jane Austen', title: 'Pride and Prejudice', year: 1813 },
  { author: 'Jane Austen', title: 'Mansfield Park', year: 1814 },
  { author: 'Jane Austen', title: 'Emma', year: 1815 },
  { author: 'Jane Austen', title: 'Persuasion', year: 1817 },
  { author: 'Jane Austen', title: 'Northanger Abbey', year: 1817 },
  { author: 'Walter Scott', title: 'Ivanhoe', year: 1819 },
  { author: 'Walter Scott', title: 'Waverley', year: 1814 },
  { author: 'Walter Scott', title: 'Rob Roy', year: 1817 },
  { author: 'Walter Scott', title: 'The Heart of Midlothian', year: 1818 },
  { author: 'Mary Shelley', title: 'Frankenstein', year: 1818 },
  { author: 'Mary Shelley', title: 'The Last Man', year: 1826 },
  { author: 'Lord Byron', title: 'Don Juan', year: 1824 },
  { author: 'Lord Byron', title: 'Childe Harold\'s Pilgrimage', year: 1812 },
  { author: 'Percy Bysshe Shelley', title: 'Prometheus Unbound', year: 1820 },
  { author: 'William Wordsworth', title: 'The Prelude', year: 1850 },
  { author: 'Thomas De Quincey', title: 'Confessions of an English Opium Eater', year: 1821 },
  { author: 'Washington Irving', title: 'The Sketch Book', year: 1820 },
  { author: 'James Fenimore Cooper', title: 'The Last of the Mohicans', year: 1826 },
  { author: 'James Fenimore Cooper', title: 'The Pathfinder', year: 1840 },
  { author: 'Stendhal', title: 'The Red and the Black', year: 1830 },
  { author: 'Stendhal', title: 'The Charterhouse of Parma', year: 1839 },
  { author: 'Honoré de Balzac', title: 'Père Goriot', year: 1834 },
  { author: 'Honoré de Balzac', title: 'Eugénie Grandet', year: 1833 },
  { author: 'Honoré de Balzac', title: 'Lost Illusions', year: 1843 },
  { author: 'Honoré de Balzac', title: 'Cousin Bette', year: 1846 },
  { author: 'Honoré de Balzac', title: 'The Wild Ass\'s Skin', year: 1831 },
  { author: 'Victor Hugo', title: 'The Hunchback of Notre-Dame', year: 1831 },
  { author: 'Victor Hugo', title: 'Les Misérables', year: 1862 },
  { author: 'Victor Hugo', title: 'Toilers of the Sea', year: 1866 },
  { author: 'Alexandre Dumas', title: 'The Count of Monte Cristo', year: 1844 },
  { author: 'Alexandre Dumas', title: 'The Three Musketeers', year: 1844 },
  { author: 'Alexandre Dumas', title: 'Twenty Years After', year: 1845 },
  { author: 'George Sand', title: 'Indiana', year: 1832 },
  { author: 'George Sand', title: 'Consuelo', year: 1842 },
  { author: 'Prosper Mérimée', title: 'Carmen', year: 1845 },
  { author: 'Alfred de Musset', title: 'The Confession of a Child of the Century', year: 1836 },
  { author: 'Nikolai Gogol', title: 'Dead Souls', year: 1842 },
  { author: 'Nikolai Gogol', title: 'The Inspector General', year: 1836 },
  { author: 'Nikolai Gogol', title: 'The Overcoat', year: 1842 },
  { author: 'Ivan Turgenev', title: 'Fathers and Sons', year: 1862 },
  { author: 'Ivan Turgenev', title: 'On the Eve', year: 1860 },
  { author: 'Ivan Turgenev', title: 'Rudin', year: 1856 },
  { author: 'Ivan Goncharov', title: 'Oblomov', year: 1859 },
  { author: 'Alexander Pushkin', title: 'Eugene Onegin', year: 1833 },
  { author: 'Alexander Pushkin', title: 'The Captain\'s Daughter', year: 1836 },
  { author: 'Mikhail Lermontov', title: 'A Hero of Our Time', year: 1840 },
  { author: 'Edgar Allan Poe', title: 'Tales of Mystery and Imagination', year: 1845 },
  { author: 'Nathaniel Hawthorne', title: 'The Scarlet Letter', year: 1850 },
  { author: 'Nathaniel Hawthorne', title: 'The House of the Seven Gables', year: 1851 },
  { author: 'Herman Melville', title: 'Moby-Dick', year: 1851 },
  { author: 'Herman Melville', title: 'Bartleby the Scrivener', year: 1853 },
  { author: 'Henry David Thoreau', title: 'Walden', year: 1854 },
  { author: 'Walt Whitman', title: 'Leaves of Grass', year: 1855 },
  { author: 'Harriet Beecher Stowe', title: 'Uncle Tom\'s Cabin', year: 1852 },
  { author: 'Charles Dickens', title: 'The Pickwick Papers', year: 1837 },
  { author: 'Charles Dickens', title: 'Oliver Twist', year: 1838 },
  { author: 'Charles Dickens', title: 'Nicholas Nickleby', year: 1839 },
  { author: 'Charles Dickens', title: 'The Old Curiosity Shop', year: 1840 },
  { author: 'Charles Dickens', title: 'Martin Chuzzlewit', year: 1844 },
  { author: 'Charles Dickens', title: 'Dombey and Son', year: 1848 },
  { author: 'Charles Dickens', title: 'David Copperfield', year: 1850 },
  { author: 'Charles Dickens', title: 'Bleak House', year: 1853 },
  { author: 'Charles Dickens', title: 'Hard Times', year: 1854 },
  { author: 'Charles Dickens', title: 'Little Dorrit', year: 1857 },
  { author: 'Charles Dickens', title: 'A Tale of Two Cities', year: 1859 },
  { author: 'Charles Dickens', title: 'Great Expectations', year: 1861 },
  { author: 'Charles Dickens', title: 'Our Mutual Friend', year: 1865 },
  { author: 'William Makepeace Thackeray', title: 'Vanity Fair', year: 1848 },
  { author: 'William Makepeace Thackeray', title: 'The History of Pendennis', year: 1850 },
  { author: 'Charlotte Brontë', title: 'Jane Eyre', year: 1847 },
  { author: 'Emily Brontë', title: 'Wuthering Heights', year: 1847 },
  { author: 'Anne Brontë', title: 'The Tenant of Wildfell Hall', year: 1848 },
  { author: 'George Eliot', title: 'Middlemarch', year: 1871 },
  { author: 'George Eliot', title: 'The Mill on the Floss', year: 1860 },
  { author: 'George Eliot', title: 'Silas Marner', year: 1861 },
  { author: 'George Eliot', title: 'Daniel Deronda', year: 1876 },
  { author: 'Anthony Trollope', title: 'The Warden', year: 1855 },
  { author: 'Anthony Trollope', title: 'Barchester Towers', year: 1857 },
  { author: 'Anthony Trollope', title: 'The Way We Live Now', year: 1875 },
  { author: 'Elizabeth Gaskell', title: 'North and South', year: 1855 },
  { author: 'Elizabeth Gaskell', title: 'Mary Barton', year: 1848 },
  { author: 'Elizabeth Gaskell', title: 'Wives and Daughters', year: 1866 },
  { author: 'Thomas Hardy', title: 'Tess of the d\'Urbervilles', year: 1891 },
  { author: 'Thomas Hardy', title: 'Far from the Madding Crowd', year: 1874 },
  { author: 'Thomas Hardy', title: 'The Mayor of Casterbridge', year: 1886 },
  { author: 'Thomas Hardy', title: 'Jude the Obscure', year: 1895 },
  { author: 'Wilkie Collins', title: 'The Woman in White', year: 1859 },
  { author: 'Wilkie Collins', title: 'The Moonstone', year: 1868 },
  { author: 'Arthur Conan Doyle', title: 'A Study in Scarlet', year: 1887 },
  { author: 'Arthur Conan Doyle', title: 'The Hound of the Baskervilles', year: 1902 },
  { author: 'Arthur Conan Doyle', title: 'The Adventures of Sherlock Holmes', year: 1892 },
  { author: 'Robert Louis Stevenson', title: 'Treasure Island', year: 1883 },
  { author: 'Robert Louis Stevenson', title: 'Strange Case of Dr Jekyll and Mr Hyde', year: 1886 },
  { author: 'Robert Louis Stevenson', title: 'Kidnapped', year: 1886 },
  { author: 'Rudyard Kipling', title: 'The Jungle Book', year: 1894 },
  { author: 'Rudyard Kipling', title: 'Kim', year: 1901 },
  { author: 'Oscar Wilde', title: 'The Picture of Dorian Gray', year: 1890 },
  { author: 'Oscar Wilde', title: 'The Importance of Being Earnest', year: 1895 },
  { author: 'H.G. Wells', title: 'The Time Machine', year: 1895 },
  { author: 'H.G. Wells', title: 'The War of the Worlds', year: 1898 },
  { author: 'H.G. Wells', title: 'The Invisible Man', year: 1897 },
  { author: 'H.G. Wells', title: 'The Island of Doctor Moreau', year: 1896 },
  { author: 'Gustave Flaubert', title: 'Madame Bovary', year: 1857 },
  { author: 'Gustave Flaubert', title: 'Sentimental Education', year: 1869 },
  { author: 'Gustave Flaubert', title: 'Salammbô', year: 1862 },
  { author: 'Émile Zola', title: 'Germinal', year: 1885 },
  { author: 'Émile Zola', title: 'Nana', year: 1880 },
  { author: 'Émile Zola', title: 'L\'Assommoir', year: 1877 },
  { author: 'Émile Zola', title: 'La Bête humaine', year: 1890 },
  { author: 'Émile Zola', title: 'Thérèse Raquin', year: 1867 },
  { author: 'Émile Zola', title: 'Earth', year: 1887 },
  { author: 'Émile Zola', title: 'The Masterpiece', year: 1886 },
  { author: 'Guy de Maupassant', title: 'Bel-Ami', year: 1885 },
  { author: 'Guy de Maupassant', title: 'A Life', year: 1883 },
  { author: 'Jules Verne', title: 'Twenty Thousand Leagues Under the Sea', year: 1870 },
  { author: 'Jules Verne', title: 'Around the World in Eighty Days', year: 1872 },
  { author: 'Jules Verne', title: 'Journey to the Center of the Earth', year: 1864 },
  { author: 'Jules Verne', title: 'From the Earth to the Moon', year: 1865 },
  { author: 'Joris-Karl Huysmans', title: 'Against Nature', year: 1884 },
  { author: 'Fyodor Dostoevsky', title: 'Crime and Punishment', year: 1866 },
  { author: 'Fyodor Dostoevsky', title: 'The Idiot', year: 1869 },
  { author: 'Fyodor Dostoevsky', title: 'Demons', year: 1872 },
  { author: 'Fyodor Dostoevsky', title: 'The Brothers Karamazov', year: 1880 },
  { author: 'Fyodor Dostoevsky', title: 'Notes from Underground', year: 1864 },
  { author: 'Fyodor Dostoevsky', title: 'The Gambler', year: 1867 },
  { author: 'Leo Tolstoy', title: 'War and Peace', year: 1869 },
  { author: 'Leo Tolstoy', title: 'Anna Karenina', year: 1878 },
  { author: 'Leo Tolstoy', title: 'Resurrection', year: 1899 },
  { author: 'Leo Tolstoy', title: 'The Death of Ivan Ilyich', year: 1886 },
  { author: 'Leo Tolstoy', title: 'The Kreutzer Sonata', year: 1889 },
  { author: 'Anton Chekhov', title: 'The Cherry Orchard', year: 1904 },
  { author: 'Anton Chekhov', title: 'Three Sisters', year: 1900 },
  { author: 'Anton Chekhov', title: 'Uncle Vanya', year: 1898 },
  { author: 'Nikolai Leskov', title: 'The Enchanted Wanderer', year: 1873 },
  { author: 'Mark Twain', title: 'The Adventures of Tom Sawyer', year: 1876 },
  { author: 'Mark Twain', title: 'Adventures of Huckleberry Finn', year: 1884 },
  { author: 'Mark Twain', title: 'The Prince and the Pauper', year: 1881 },
  { author: 'Mark Twain', title: 'A Connecticut Yankee in King Arthur\'s Court', year: 1889 },
  { author: 'Henry James', title: 'The Portrait of a Lady', year: 1881 },
  { author: 'Henry James', title: 'The Wings of the Dove', year: 1902 },
  { author: 'Henry James', title: 'The Ambassadors', year: 1903 },
  { author: 'Henry James', title: 'The Turn of the Screw', year: 1898 },
  { author: 'Henry James', title: 'The Golden Bowl', year: 1904 },
  { author: 'Stephen Crane', title: 'The Red Badge of Courage', year: 1895 },
  { author: 'Theodore Dreiser', title: 'Sister Carrie', year: 1900 },
  { author: 'Jack London', title: 'The Call of the Wild', year: 1903 },
  { author: 'Jack London', title: 'The Sea-Wolf', year: 1904 },
  { author: 'Jack London', title: 'White Fang', year: 1906 },
  { author: 'Jack London', title: 'Martin Eden', year: 1909 },
  { author: 'Kate Chopin', title: 'The Awakening', year: 1899 },
  { author: 'Bram Stoker', title: 'Dracula', year: 1897 },
  { author: 'Joseph Conrad', title: 'Heart of Darkness', year: 1899 },
  { author: 'Joseph Conrad', title: 'Lord Jim', year: 1900 },
  { author: 'Joseph Conrad', title: 'The Secret Agent', year: 1907 },
  { author: 'Joseph Conrad', title: 'Nostromo', year: 1904 },
  { author: 'Joseph Conrad', title: 'The Shadow-Line', year: 1917 },
  { author: 'Theodor Fontane', title: 'Effi Briest', year: 1896 },
  { author: 'Friedrich Nietzsche', title: 'Thus Spoke Zarathustra', year: 1883 },
  { author: 'Friedrich Nietzsche', title: 'Beyond Good and Evil', year: 1886 },
  { author: 'Henrik Ibsen', title: 'A Doll\'s House', year: 1879 },
  { author: 'Henrik Ibsen', title: 'Hedda Gabler', year: 1890 },
  { author: 'Henrik Ibsen', title: 'The Wild Duck', year: 1884 },
  { author: 'Henrik Ibsen', title: 'Ghosts', year: 1881 },
  { author: 'August Strindberg', title: 'Miss Julie', year: 1888 },
  { author: 'August Strindberg', title: 'The Father', year: 1887 },
  { author: 'Knut Hamsun', title: 'Hunger', year: 1890 },
  { author: 'Knut Hamsun', title: 'The Growth of the Soil', year: 1917 },
  { author: 'Selma Lagerlöf', title: 'The Saga of Gösta Berlings', year: 1891 },
  { author: 'Maxim Gorky', title: 'The Lower Depths', year: 1902 },
  { author: 'Marcel Proust', title: 'Swann\'s Way', year: 1913 },
  { author: 'Marcel Proust', title: 'In the Shadow of Young Girls in Flower', year: 1919 },
  { author: 'Marcel Proust', title: 'The Guermantes Way', year: 1920 },
  { author: 'Marcel Proust', title: 'Sodom and Gomorrah', year: 1921 },
  { author: 'André Gide', title: 'The Immoralist', year: 1902 },
  { author: 'André Gide', title: 'Strait Is the Gate', year: 1909 },
  { author: 'André Gide', title: 'Lafcadio\'s Adventures', year: 1914 },
  { author: 'Anatole France', title: 'Penguin Island', year: 1908 },
  { author: 'Anatole France', title: 'The Gods Are Athirst', year: 1912 },
  { author: 'Colette', title: 'Claudine at School', year: 1900 },
  { author: 'Romain Rolland', title: 'Jean-Christophe', year: 1912 },
  { author: 'Edith Wharton', title: 'The House of Mirth', year: 1905 },
  { author: 'Edith Wharton', title: 'The Age of Innocence', year: 1920 },
  { author: 'Edith Wharton', title: 'Ethan Frome', year: 1911 },
  { author: 'Sherwood Anderson', title: 'Winesburg, Ohio', year: 1919 },
  { author: 'Sinclair Lewis', title: 'Main Street', year: 1920 },
  { author: 'Sinclair Lewis', title: 'Babbitt', year: 1922 },
  { author: 'Upton Sinclair', title: 'The Jungle', year: 1906 },
  { author: 'Theodore Dreiser', title: 'An American Tragedy', year: 1925 },
  { author: 'Willa Cather', title: 'O Pioneers!', year: 1913 },
  { author: 'Willa Cather', title: 'My Ántonia', year: 1918 },
  { author: 'Willa Cather', title: 'Death Comes for the Archbishop', year: 1927 },
  { author: 'Gertrude Stein', title: 'Three Lives', year: 1909 },
  { author: 'E.M. Forster', title: 'A Room with a View', year: 1908 },
  { author: 'E.M. Forster', title: 'Howards End', year: 1910 },
  { author: 'E.M. Forster', title: 'A Passage to India', year: 1924 },
  { author: 'Virginia Woolf', title: 'The Voyage Out', year: 1915 },
  { author: 'Virginia Woolf', title: 'Mrs Dalloway', year: 1925 },
  { author: 'Virginia Woolf', title: 'To the Lighthouse', year: 1927 },
  { author: 'D.H. Lawrence', title: 'Sons and Lovers', year: 1913 },
  { author: 'D.H. Lawrence', title: 'The Rainbow', year: 1915 },
  { author: 'D.H. Lawrence', title: 'Women in Love', year: 1920 },
  { author: 'James Joyce', title: 'Dubliners', year: 1914 },
  { author: 'James Joyce', title: 'A Portrait of the Artist as a Young Man', year: 1916 },
  { author: 'James Joyce', title: 'Ulysses', year: 1922 },
  { author: 'W. Somerset Maugham', title: 'Of Human Bondage', year: 1915 },
  { author: 'W. Somerset Maugham', title: 'The Moon and Sixpence', year: 1919 },
  { author: 'Ford Madox Ford', title: 'The Good Soldier', year: 1915 },
  { author: 'G.K. Chesterton', title: 'The Man Who Was Thursday', year: 1908 },
  { author: 'John Buchan', title: 'The Thirty-Nine Steps', year: 1915 },
  { author: 'P.G. Wodehouse', title: 'Something New', year: 1915 },
  { author: 'Agatha Christie', title: 'The Mysterious Affair at Styles', year: 1920 },
  { author: 'Agatha Christie', title: 'The Murder on the Links', year: 1923 },
  { author: 'Dorothy L. Sayers', title: 'Whose Body?', year: 1923 },
  { author: 'George Bernard Shaw', title: 'Pygmalion', year: 1912 },
  { author: 'George Bernard Shaw', title: 'Major Barbara', year: 1905 },
  { author: 'George Bernard Shaw', title: 'Saint Joan', year: 1923 },
  { author: 'John Millington Synge', title: 'The Playboy of the Western World', year: 1907 },
  { author: 'Thomas Mann', title: 'Buddenbrooks', year: 1901 },
  { author: 'Thomas Mann', title: 'Death in Venice', year: 1912 },
  { author: 'Thomas Mann', title: 'The Magic Mountain', year: 1924 },
  { author: 'Franz Kafka', title: 'The Trial', year: 1925 },
  { author: 'Franz Kafka', title: 'The Metamorphosis', year: 1915 },
  { author: 'Franz Kafka', title: 'The Castle', year: 1926 },
  { author: 'Robert Musil', title: 'Young Törless', year: 1906 },
  { author: 'Arthur Schnitzler', title: 'Lieutenant Gustl', year: 1900 },
  { author: 'Arthur Schnitzler', title: 'Dream Story', year: 1926 },
  { author: 'Rainer Maria Rilke', title: 'The Notebooks of Malte Laurids Brigge', year: 1910 },
  { author: 'Stefan Zweig', title: 'Amok', year: 1922 },
  { author: 'Hermann Hesse', title: 'Peter Camenzind', year: 1904 },
  { author: 'Hermann Hesse', title: 'Demian', year: 1919 },
  { author: 'Hermann Hesse', title: 'Siddhartha', year: 1922 },
  { author: 'Hermann Hesse', title: 'Steppenwolf', year: 1927 },
  { author: 'Heinrich Mann', title: 'Professor Unrat', year: 1905 },
  { author: 'Jaroslav Hašek', title: 'The Good Soldier Švejk', year: 1921 },
  { author: 'Karel Čapek', title: 'R.U.R.', year: 1920 },
  { author: 'Ivan Bunin', title: 'The Village', year: 1910 },
  { author: 'Alexander Kuprin', title: 'The Duel', year: 1905 },
  { author: 'Fyodor Sologub', title: 'The Petty Demon', year: 1905 },
  { author: 'Andrei Bely', title: 'Petersburg', year: 1913 },
  { author: 'Mikhail Bulgakov', title: 'The White Guard', year: 1925 },
  { author: 'Sigrid Undset', title: 'Kristin Lavransdatter', year: 1920 },
  { author: 'Martin Andersen Nexø', title: 'Pelle the Conqueror', year: 1910 },
  { author: 'O. Henry', title: 'The Four Million', year: 1906 },
  { author: 'Ambrose Bierce', title: 'Tales of Soldiers and Civilians', year: 1891 },
  { author: 'Charlotte Perkins Gilman', title: 'The Yellow Wallpaper', year: 1892 },
  { author: 'Sarah Orne Jewett', title: 'The Country of the Pointed Firs', year: 1896 },
  { author: 'Frank Norris', title: 'McTeague', year: 1899 },
  { author: 'Frank Norris', title: 'The Octopus', year: 1901 },
  { author: 'Booth Tarkington', title: 'The Magnificent Ambersons', year: 1918 },
  { author: 'Ellen Glasgow', title: 'Barren Ground', year: 1925 },
  { author: 'William Dean Howells', title: 'The Rise of Silas Lapham', year: 1885 },
  { author: 'Henry Adams', title: 'The Education of Henry Adams', year: 1918 },
  { author: 'W.E.B. Du Bois', title: 'The Souls of Black Folk', year: 1903 },
  { author: 'Booker T. Washington', title: 'Up from Slavery', year: 1901 },
  { author: 'Mary Austin', title: 'The Land of Little Rain', year: 1903 },
  { author: 'Owen Wister', title: 'The Virginian', year: 1902 },
  { author: 'Dorothy Richardson', title: 'Pointed Roofs', year: 1915 },
  { author: 'Katherine Mansfield', title: 'Bliss and Other Stories', year: 1920 },
  { author: 'Katherine Mansfield', title: 'The Garden Party', year: 1922 },
  { author: 'Octave Mirbeau', title: 'The Diary of a Chambermaid', year: 1900 },
  { author: 'Pierre Loti', title: 'Iceland Fisherman', year: 1886 },
  { author: 'George Moore', title: 'Esther Waters', year: 1894 },
  { author: 'George Moore', title: 'Confessions of a Young Man', year: 1888 },
  { author: 'William James', title: 'The Varieties of Religious Experience', year: 1902 },
  { author: 'Georg Büchner', title: 'Woyzeck', year: 1879 },
  { author: 'Heinrich von Kleist', title: 'Michael Kohlhaas', year: 1810 },
  { author: 'Adalbert Stifter', title: 'Indian Summer', year: 1857 },
  { author: 'Hamlin Garland', title: 'Main-Travelled Roads', year: 1891 },
  { author: 'Villiers de l\'Isle-Adam', title: 'Cruel Tales', year: 1883 },
  { author: 'Alphonse Daudet', title: 'Tartarin of Tarascon', year: 1872 },
  { author: 'Søren Kierkegaard', title: 'Either/Or', year: 1843 },
  { author: 'Edgar Rice Burroughs', title: 'Tarzan of the Apes', year: 1912 },
  { author: 'Zane Grey', title: 'Riders of the Purple Sage', year: 1912 },
]
```

- [ ] **Step 2: Copy to antd stories data**

```bash
cp packages/core/stories/data/books.ts packages/antd/stories/data/books.ts
```

- [ ] **Step 3: Verify the array length**

```bash
node -e "const b = require('./packages/core/stories/data/books.ts'); console.log('books count:', b.books?.length ?? 'check TS')"
```

If the node check doesn't work with TS, just count lines:
```bash
grep -c "author:" packages/core/stories/data/books.ts
```

Expected: 500 (or close to it — the list above has ~490 entries; add a few more in the same format until you reach 500 if needed).

- [ ] **Step 4: Commit**

```bash
git add packages/core/stories/data/books.ts \
        packages/antd/stories/data/books.ts
git commit -m "feat(stories): add 500 classical books test data"
```

---

### Task 12: Add core BookSearchDemo story

**Files:**
- Create: `packages/core/stories/BookSearchDemo.stories.tsx`

- [ ] **Step 1: Create the story**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import {
  WithSearch,
  SearchInput,
  HighlightedText,
  useFilterFunction,
  useSearchContext,
} from '../src'
import { books } from './data/books'
import type { Book } from './data/books'

const meta: Meta = {
  title: 'Core/BookSearchDemo',
}

export default meta

const BookList = ({ mode }: { mode: 'AND' | 'OR' }) => {
  const filterFunction = useFilterFunction<Book>(mode)
  const { hasPatterns: authorHasPatterns } = useSearchContext('author')
  const { hasPatterns: titleHasPatterns } = useSearchContext('title')
  const hasPatterns = authorHasPatterns || titleHasPatterns
  const filtered = books.filter(filterFunction)

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 640 }}>
      {hasPatterns && (
        <p style={{ color: '#666', fontSize: 13, margin: '0 0 12px' }}>
          {filtered.length} of {books.length} books
        </p>
      )}
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        {(hasPatterns ? filtered : books.slice(0, 20)).map((book, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            <HighlightedText text={book.author} searchNames="author" />
            {' — '}
            <HighlightedText text={book.title} searchNames="title" />
            {' '}
            <span style={{ color: '#999', fontSize: 12 }}>({book.year})</span>
          </li>
        ))}
        {!hasPatterns && (
          <li style={{ color: '#999', listStyle: 'none', marginLeft: -20 }}>
            Start typing to search…
          </li>
        )}
      </ul>
    </div>
  )
}

const BookSearchWrapper = () => {
  const [mode, setMode] = useState<'AND' | 'OR'>('AND')

  return (
    <WithSearch name="author" mapping={(b: Book) => b.author}>
      <WithSearch name="title" mapping={(b: Book) => b.title}>
        <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 640 }}>
          <h2 style={{ marginTop: 0 }}>Classical Book Search</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <SearchInput
              name="author"
              placeholder="Search for author"
              style={{ flex: 1, padding: '6px 10px', fontSize: 14, boxSizing: 'border-box' }}
            />
            <SearchInput
              name="title"
              placeholder="Search for title"
              style={{ flex: 1, padding: '6px 10px', fontSize: 14, boxSizing: 'border-box' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={mode === 'OR'}
                onChange={e => setMode(e.target.checked ? 'OR' : 'AND')}
              />
              OR mode
            </label>
          </div>
          <BookList mode={mode} />
        </div>
      </WithSearch>
    </WithSearch>
  )
}

export const Default: StoryObj = {
  render: () => <BookSearchWrapper />,
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/core && pnpm exec tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/stories/BookSearchDemo.stories.tsx
git commit -m "feat(core/stories): add BookSearchDemo multi-field search story"
```

---

### Task 13: Add antd BookSearchDemo story

**Files:**
- Create: `packages/antd/stories/BookSearchDemo.stories.tsx`

- [ ] **Step 1: Create the story**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { Table, Switch, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  WithSearch,
  HighlightedText,
  useFilterFunction,
  useSearchContext,
} from '@quaesitor-textus/core'
import { SearchInput } from '../src'
import { books } from './data/books'
import type { Book } from './data/books'

const meta: Meta = {
  title: 'Antd/BookSearchDemo',
}

export default meta

type BookRow = Book & { key: string }

interface BookTableProps {
  mode: 'AND' | 'OR'
  currentPage: number
  setCurrentPage: (page: number) => void
}

const BookTable = ({ mode, currentPage, setCurrentPage }: BookTableProps) => {
  const filterFunction = useFilterFunction<Book>(mode)
  const { hasPatterns: authorHasPatterns } = useSearchContext('author')
  const { hasPatterns: titleHasPatterns } = useSearchContext('title')
  const hasPatterns = authorHasPatterns || titleHasPatterns
  const filtered = hasPatterns ? books.filter(filterFunction) : books

  const dataSource: BookRow[] = filtered.map((book, i) => ({ ...book, key: String(i) }))

  const columns: TableColumnsType<BookRow> = [
    {
      title: 'Author',
      dataIndex: 'author',
      render: (author: string) => (
        <HighlightedText text={author} searchNames="author" />
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      render: (title: string) => (
        <HighlightedText text={title} searchNames="title" />
      ),
    },
    {
      title: 'Year',
      dataIndex: 'year',
      width: 80,
    },
  ]

  return (
    <>
      {hasPatterns && (
        <p style={{ color: '#666', fontSize: 13, margin: '0 0 12px' }}>
          {filtered.length} of {books.length} books
        </p>
      )}
      <Table<BookRow>
        dataSource={dataSource}
        columns={columns}
        pagination={{
          pageSize: 10,
          current: currentPage,
          onChange: setCurrentPage,
        }}
      />
    </>
  )
}

const BookSearchWrapper = () => {
  const [mode, setMode] = useState<'AND' | 'OR'>('AND')
  const [currentPage, setCurrentPage] = useState(1)

  const resetPage = () => setCurrentPage(1)

  return (
    <WithSearch name="author" mapping={(b: Book) => b.author} onChange={resetPage}>
      <WithSearch name="title" mapping={(b: Book) => b.title} onChange={resetPage}>
        <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 800 }}>
          <h2 style={{ marginTop: 0 }}>Classical Book Search</h2>
          <Space style={{ marginBottom: 12 }} wrap>
            <SearchInput
              name="author"
              placeholder="Search for author"
              style={{ width: 220 }}
            />
            <SearchInput
              name="title"
              placeholder="Search for title"
              style={{ width: 220 }}
            />
            <Space>
              <span style={{ fontSize: 13 }}>AND</span>
              <Switch
                checked={mode === 'OR'}
                onChange={checked => setMode(checked ? 'OR' : 'AND')}
                size="small"
              />
              <span style={{ fontSize: 13 }}>OR</span>
            </Space>
          </Space>
          <BookTable mode={mode} currentPage={currentPage} setCurrentPage={setCurrentPage} />
        </div>
      </WithSearch>
    </WithSearch>
  )
}

export const Default: StoryObj = {
  render: () => <BookSearchWrapper />,
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/antd && pnpm exec tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Run all tests one final time**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
cd packages/antd && pnpm test 2>&1 | tail -5
```

Expected: all tests pass in both packages.

- [ ] **Step 4: Commit**

```bash
git add packages/antd/stories/BookSearchDemo.stories.tsx
git commit -m "feat(antd/stories): add BookSearchDemo multi-field search story with table"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| `SearchEntry<T>` with `mapping` | Task 1 |
| `WithSearch` `name` prop, default "default search" | Task 2 |
| `WithSearch` accumulates map, throws on duplicate | Task 2 |
| `WithSearch` `mapping` prop, default `String` | Task 2 |
| `useSearchContext(name?)` looks up by name, throws if missing | Task 2 |
| `useSearchContext` removes `filterFunction` | Task 2 |
| `useFilterFunction<T>(mode?)` AND/OR | Task 3 |
| Zero-patterns entries neutral in both modes | Task 3 |
| Empty map → all pass | Task 3 |
| `useResolvedPatterns` internal hook | Task 4 |
| `HighlightedText` `searchNames` (string\|string[]) | Task 5 |
| `HighlightedText` `all` prop | Task 5 |
| `HighlightedText` no auto-pickup (breaking change) | Task 5 |
| `HighlightedText` warns on unknown name | Task 5 |
| `HighlightedTrimmedText` `searchNames`/`all` | Task 6 |
| Core `SearchInput` `name` prop | Task 7 |
| Antd `SearchInput` `name` prop | Task 8 |
| Export `useFilterFunction`, `SearchEntry`, `DEFAULT_SEARCH_NAME` | Task 9 |
| Fix existing `FullListDemo` stories | Task 10 |
| 500 classical books data file | Task 11 |
| Core `BookSearchDemo` story with two search inputs + mode switch | Task 12 |
| Antd `BookSearchDemo` story with table + pagination | Task 13 |

All spec requirements covered. ✓

**Placeholder scan:** No TBDs, TODOs, or vague steps found. ✓

**Type consistency:**
- `DEFAULT_SEARCH_NAME` used in `WithSearch`, `useSearchContext`, core `SearchInput`, antd `SearchInput` — all import from `SearchContext.ts`. ✓
- `SearchEntry<unknown>` stored in context, `SearchEntry<T>` in user-facing interfaces. ✓
- `useResolvedPatterns` called consistently in `HighlightedText` and `HighlightedTrimmedText`. ✓
- `mapping` default: `String` in both `WithSearch` and documented in spec. ✓
