# useSearchInternalState Refactoring and onChange Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared query-state logic from `WithSearch` and `useSearch` into a private `useSearchInternalState` hook, then add an `onChange(oldValue, newValue)` callback to both public APIs.

**Architecture:** `useSearchInternalState` handles uncontrolled/controlled query state, pattern parsing, `hasPatterns`, and `reset`. `WithSearch` and `useSearch` call it and own only their respective concerns (`executeSearch`+context vs `filteredItems`). `onChange` lives in `useSearchInternalState` and is wired through each public component/hook's props.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react

---

## File Map

| Action | Path |
|--------|------|
| Create | `packages/core/src/hooks/useSearchInternalState.ts` |
| Modify | `packages/core/src/context/WithSearch.tsx` |
| Modify | `packages/core/src/hooks/useSearch.ts` |
| Modify | `packages/core/src/context/WithSearch.test.tsx` |
| Modify | `packages/core/src/hooks/useSearch.test.ts` |
| No change | `packages/core/src/index.ts` (do NOT add useSearchInternalState) |

---

### Task 1: Create `useSearchInternalState`

**Files:**
- Create: `packages/core/src/hooks/useSearchInternalState.ts`

This task creates the hook with all controlled/uncontrolled logic but **without** `onChange` yet — that comes in Task 4.

- [ ] **Step 1: Create the file**

Create `packages/core/src/hooks/useSearchInternalState.ts` with the following content:

```ts
import { useState, useMemo, useCallback } from 'react'
import { parseInput } from '../logic/parseInput'
import type { SearchOptions } from '../logic/types'

export interface UseSearchInternalStateParams {
  options?: SearchOptions
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
}

export interface UseSearchInternalStateResult {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
}

export function useSearchInternalState({
  options,
  query: controlledQuery,
  onSetQuery,
  onReset,
}: UseSearchInternalStateParams): UseSearchInternalStateResult {
  const [internalQuery, setInternalQuery] = useState('')
  const { caseSensitive = false, diacriticSensitive = false, minLength = 2 } = options ?? {}

  const isControlled = controlledQuery !== undefined
  const query = isControlled ? controlledQuery : internalQuery

  const setQuery = useCallback(
    (newValue: string) => {
      if (isControlled) {
        onSetQuery?.(newValue)
      } else {
        setInternalQuery(newValue)
      }
    },
    [isControlled, onSetQuery]
  )

  const patterns = useMemo(
    () => parseInput(query, { caseSensitive, diacriticSensitive, minLength }),
    [query, caseSensitive, diacriticSensitive, minLength]
  )

  const hasPatterns = patterns.length > 0

  const reset = useCallback(() => {
    if (onReset) {
      onReset()
    } else {
      setQuery('')
    }
  }, [onReset, setQuery])

  return { query, setQuery, patterns, hasPatterns, reset }
}
```

- [ ] **Step 2: Verify the new file does not appear in the public exports**

Open `packages/core/src/index.ts`. Confirm `useSearchInternalState` is NOT listed. Do not add it.

- [ ] **Step 3: Run the full test suite to confirm nothing is broken**

```bash
pnpm --filter @quaesitor-textus/core test 2>&1 | tail -10
```

Expected:
```
Test Files  8 passed (8)
     Tests  75 passed (75)
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/hooks/useSearchInternalState.ts
git commit -m "feat(core): add useSearchInternalState hook (internal)"
```

---

### Task 2: Refactor `WithSearch` to use `useSearchInternalState`

**Files:**
- Modify: `packages/core/src/context/WithSearch.tsx`

- [ ] **Step 1: Replace `WithSearch.tsx` with the refactored version**

Replace the entire contents of `packages/core/src/context/WithSearch.tsx` with:

```tsx
import React, { useMemo } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from '../hooks/useSearchInternalState'

export interface WithSearchProps {
  options?: SearchOptions
  children: React.ReactNode
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
}

export function WithSearch({
  options,
  children,
  query: controlledQuery,
  onSetQuery,
  onReset,
}: WithSearchProps) {
  const { caseSensitive = false, diacriticSensitive = false } = options ?? {}

  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
    options,
    query: controlledQuery,
    onSetQuery,
    onReset,
  })

  const executeSearch = useMemo(
    (): SearchContextValue['executeSearch'] =>
      function executeSearch<T>(items: T[], getCorpus: (item: T) => string): T[] {
        return items.filter(item =>
          matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })
        )
      },
    [patterns, caseSensitive, diacriticSensitive]
  )

  const value: SearchContextValue = useMemo(
    () => ({ query, setQuery, patterns, executeSearch, hasPatterns, reset }),
    [query, setQuery, patterns, executeSearch, hasPatterns, reset]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
```

- [ ] **Step 2: Run the full test suite — all tests must still pass**

```bash
pnpm --filter @quaesitor-textus/core test 2>&1 | tail -10
```

Expected:
```
Test Files  8 passed (8)
     Tests  75 passed (75)
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/context/WithSearch.tsx
git commit -m "refactor(core): WithSearch uses useSearchInternalState"
```

---

### Task 3: Refactor `useSearch` to use `useSearchInternalState`

**Files:**
- Modify: `packages/core/src/hooks/useSearch.ts`

- [ ] **Step 1: Replace `useSearch.ts` with the refactored version**

Replace the entire contents of `packages/core/src/hooks/useSearch.ts` with:

```ts
import { useMemo } from 'react'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from './useSearchInternalState'

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
  const { caseSensitive = false, diacriticSensitive = false } = options ?? {}

  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({ options })

  const filteredItems = useMemo(
    () => items.filter(item => matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })),
    [items, patterns, getCorpus, caseSensitive, diacriticSensitive]
  )

  return { query, setQuery, patterns, filteredItems, hasPatterns, reset }
}
```

- [ ] **Step 2: Run the full test suite — all tests must still pass**

```bash
pnpm --filter @quaesitor-textus/core test 2>&1 | tail -10
```

Expected:
```
Test Files  8 passed (8)
     Tests  75 passed (75)
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/hooks/useSearch.ts
git commit -m "refactor(core): useSearch uses useSearchInternalState"
```

---

### Task 4: Add `onChange` to `useSearchInternalState` and `WithSearch`

**Files:**
- Modify: `packages/core/src/hooks/useSearchInternalState.ts`
- Modify: `packages/core/src/context/WithSearch.tsx`
- Test: `packages/core/src/context/WithSearch.test.tsx`

- [ ] **Step 1: Add failing tests to `WithSearch.test.tsx`**

Add `vi` to the vitest import at line 1:

```ts
import { describe, it, expect, vi } from 'vitest'
```

Append these four test cases inside the existing `describe('WithSearch + useSearchContext', ...)` block, after the last `it(...)`:

```tsx
  it('calls onChange with old and new value when query changes (uncontrolled)', () => {
    const onChange = vi.fn()
    render(
      <WithSearch onChange={onChange}>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(onChange).toHaveBeenCalledWith('', 'apple')
  })

  it('calls onChange with old value and empty string when reset is called (uncontrolled)', () => {
    const onChange = vi.fn()
    render(
      <WithSearch onChange={onChange}>
        <TestConsumer items={items} getCorpus={getCorpus} />
        <ResetConsumer />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    onChange.mockClear()
    fireEvent.click(screen.getByTestId('reset'))
    expect(onChange).toHaveBeenCalledWith('apple', '')
  })

  it('calls onChange with old and new value when query changes (controlled)', () => {
    const onChange = vi.fn()
    render(
      <WithSearch query="" onSetQuery={() => {}} onChange={onChange}>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(onChange).toHaveBeenCalledWith('', 'apple')
  })

  it('calls onChange with old value and empty string when reset is called with onReset (controlled)', () => {
    const onChange = vi.fn()
    const onReset = vi.fn()
    render(
      <WithSearch query="hello" onSetQuery={() => {}} onReset={onReset} onChange={onChange}>
        <ResetConsumer />
      </WithSearch>
    )
    fireEvent.click(screen.getByTestId('reset'))
    expect(onChange).toHaveBeenCalledWith('hello', '')
  })
```

- [ ] **Step 2: Run tests to verify the 4 new tests fail**

```bash
pnpm --filter @quaesitor-textus/core test 2>&1 | tail -15
```

Expected: 4 tests fail (TypeScript error on `onChange` prop, or prop silently ignored giving 0 calls).

- [ ] **Step 3: Add `onChange` to `useSearchInternalState`**

Replace the entire contents of `packages/core/src/hooks/useSearchInternalState.ts` with:

```ts
import { useState, useMemo, useCallback } from 'react'
import { parseInput } from '../logic/parseInput'
import type { SearchOptions } from '../logic/types'

export interface UseSearchInternalStateParams {
  options?: SearchOptions
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
}

export interface UseSearchInternalStateResult {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  hasPatterns: boolean
  reset: () => void
}

export function useSearchInternalState({
  options,
  query: controlledQuery,
  onSetQuery,
  onReset,
  onChange,
}: UseSearchInternalStateParams): UseSearchInternalStateResult {
  const [internalQuery, setInternalQuery] = useState('')
  const { caseSensitive = false, diacriticSensitive = false, minLength = 2 } = options ?? {}

  const isControlled = controlledQuery !== undefined
  const query = isControlled ? controlledQuery : internalQuery

  const setQuery = useCallback(
    (newValue: string) => {
      onChange?.(query, newValue)
      if (isControlled) {
        onSetQuery?.(newValue)
      } else {
        setInternalQuery(newValue)
      }
    },
    [query, isControlled, onSetQuery, onChange]
  )

  const patterns = useMemo(
    () => parseInput(query, { caseSensitive, diacriticSensitive, minLength }),
    [query, caseSensitive, diacriticSensitive, minLength]
  )

  const hasPatterns = patterns.length > 0

  const reset = useCallback(() => {
    if (onReset) {
      onChange?.(query, '')
      onReset()
    } else {
      setQuery('')
    }
  }, [onReset, setQuery, query, onChange])

  return { query, setQuery, patterns, hasPatterns, reset }
}
```

- [ ] **Step 4: Add `onChange` prop to `WithSearch`**

Replace the entire contents of `packages/core/src/context/WithSearch.tsx` with:

```tsx
import React, { useMemo } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from '../hooks/useSearchInternalState'

export interface WithSearchProps {
  options?: SearchOptions
  children: React.ReactNode
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
}

export function WithSearch({
  options,
  children,
  query: controlledQuery,
  onSetQuery,
  onReset,
  onChange,
}: WithSearchProps) {
  const { caseSensitive = false, diacriticSensitive = false } = options ?? {}

  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
    options,
    query: controlledQuery,
    onSetQuery,
    onReset,
    onChange,
  })

  const executeSearch = useMemo(
    (): SearchContextValue['executeSearch'] =>
      function executeSearch<T>(items: T[], getCorpus: (item: T) => string): T[] {
        return items.filter(item =>
          matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })
        )
      },
    [patterns, caseSensitive, diacriticSensitive]
  )

  const value: SearchContextValue = useMemo(
    () => ({ query, setQuery, patterns, executeSearch, hasPatterns, reset }),
    [query, setQuery, patterns, executeSearch, hasPatterns, reset]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
```

- [ ] **Step 5: Run the full test suite — all tests must pass**

```bash
pnpm --filter @quaesitor-textus/core test 2>&1 | tail -10
```

Expected:
```
Test Files  8 passed (8)
     Tests  79 passed (79)
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/hooks/useSearchInternalState.ts packages/core/src/context/WithSearch.tsx packages/core/src/context/WithSearch.test.tsx
git commit -m "feat(core): add onChange callback to WithSearch"
```

---

### Task 5: Add `onChange` to `useSearch`

**Files:**
- Modify: `packages/core/src/hooks/useSearch.ts`
- Test: `packages/core/src/hooks/useSearch.test.ts`

- [ ] **Step 1: Add failing tests to `useSearch.test.ts`**

Add `vi` to the vitest import at line 1:

```ts
import { describe, it, expect, vi } from 'vitest'
```

Append these three test cases inside the existing `describe('useSearch', ...)` block, after the last `it(...)`:

```ts
  it('calls onChange with old and new value when setQuery is called', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useSearch(items, getCorpus, undefined, onChange))
    act(() => result.current.setQuery('apple'))
    expect(onChange).toHaveBeenCalledWith('', 'apple')
  })

  it('calls onChange with old value and empty string when reset is called', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useSearch(items, getCorpus, undefined, onChange))
    act(() => result.current.setQuery('apple'))
    onChange.mockClear()
    act(() => result.current.reset())
    expect(onChange).toHaveBeenCalledWith('apple', '')
  })

  it('onChange is optional — existing behavior unchanged when not provided', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('apple'))
    act(() => result.current.reset())
    expect(result.current.query).toBe('')
  })
```

- [ ] **Step 2: Run tests to verify the new tests fail**

```bash
pnpm --filter @quaesitor-textus/core test 2>&1 | tail -15
```

Expected: 2 of the 3 new tests fail (onChange never called; the third test passes since it tests existing behavior).

- [ ] **Step 3: Add `onChange` as a 4th parameter to `useSearch`**

Replace the entire contents of `packages/core/src/hooks/useSearch.ts` with:

```ts
import { useMemo } from 'react'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from './useSearchInternalState'

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
 * @param onChange - Optional callback fired on every query change with (oldValue, newValue).
 */
export function useSearch<T>(
  items: T[],
  getCorpus: (item: T) => string,
  options?: SearchOptions,
  onChange?: (oldValue: string, newValue: string) => void
): UseSearchResult<T> {
  const { caseSensitive = false, diacriticSensitive = false } = options ?? {}

  const { query, setQuery, patterns, hasPatterns, reset } = useSearchInternalState({
    options,
    onChange,
  })

  const filteredItems = useMemo(
    () => items.filter(item => matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })),
    [items, patterns, getCorpus, caseSensitive, diacriticSensitive]
  )

  return { query, setQuery, patterns, filteredItems, hasPatterns, reset }
}
```

- [ ] **Step 4: Run the full test suite — all tests must pass**

```bash
pnpm --filter @quaesitor-textus/core test 2>&1 | tail -10
```

Expected:
```
Test Files  8 passed (8)
     Tests  82 passed (82)
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/hooks/useSearch.ts packages/core/src/hooks/useSearch.test.ts
git commit -m "feat(core): add onChange callback to useSearch"
```
