# Controlled `WithSearch` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `WithSearch` usable as a controlled component by accepting optional `query`, `onSetQuery`, and `onReset` props, while keeping the existing uncontrolled behavior as the default.

**Architecture:** Two optional props (`query` / `onSetQuery`) let the caller own the search term. A third optional prop (`onReset`) overrides what `reset()` does. At the top of `WithSearch` the component resolves the active query and setter once; all downstream logic (patterns, executeSearch, hasPatterns) is unchanged.

**Tech Stack:** TypeScript, React 18, vitest + @testing-library/react, pnpm workspaces.

---

## File Map

| File | Change |
|---|---|
| `packages/core/src/context/WithSearch.tsx` | Add 3 new optional props; resolve controlled vs uncontrolled query/setter; update `reset` |
| `packages/core/src/context/WithSearch.test.tsx` | Add 4 new controlled-mode tests and a `ResetConsumer` helper |

---

### Task 1: Add controlled-mode support to `WithSearch`

**Files:**
- Modify: `packages/core/src/context/WithSearch.test.tsx`
- Modify: `packages/core/src/context/WithSearch.tsx`

---

- [ ] **Step 1: Add failing tests**

Open `packages/core/src/context/WithSearch.test.tsx`. After the existing `TestConsumer` component, add a `ResetConsumer` helper. Then append four new test cases inside the `describe` block.

The file currently starts with:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { WithSearch } from './WithSearch'
import { useSearchContext } from './useSearchContext'
```

Add `ResetConsumer` immediately after `TestConsumer`:

```tsx
const ResetConsumer = () => {
  const { reset } = useSearchContext()
  return <button data-testid="reset" onClick={reset}>Reset</button>
}
```

Then append these four tests at the end of the `describe('WithSearch + useSearchContext', ...)` block:

```tsx
  it('controlled mode: reflects the provided query value', () => {
    render(
      <WithSearch query="hello" onSetQuery={() => {}}>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    expect(screen.getByTestId('input')).toHaveValue('hello')
  })

  it('controlled mode: calls onSetQuery when input changes', () => {
    const onSetQuery = vi.fn()
    render(
      <WithSearch query="" onSetQuery={onSetQuery}>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(onSetQuery).toHaveBeenCalledWith('apple')
  })

  it('controlled mode: reset calls onSetQuery with empty string when no onReset given', () => {
    const onSetQuery = vi.fn()
    render(
      <WithSearch query="hello" onSetQuery={onSetQuery}>
        <ResetConsumer />
      </WithSearch>
    )
    fireEvent.click(screen.getByTestId('reset'))
    expect(onSetQuery).toHaveBeenCalledWith('')
  })

  it('controlled mode: reset calls onReset instead of onSetQuery when onReset is given', () => {
    const onSetQuery = vi.fn()
    const onReset = vi.fn()
    render(
      <WithSearch query="hello" onSetQuery={onSetQuery} onReset={onReset}>
        <ResetConsumer />
      </WithSearch>
    )
    fireEvent.click(screen.getByTestId('reset'))
    expect(onReset).toHaveBeenCalled()
    expect(onSetQuery).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run tests — verify the 4 new tests fail**

```bash
pnpm --filter @quaesitor-textus/core test
```

Expected: 4 failures on the new tests (TypeScript will complain about unknown props `query`, `onSetQuery`, `onReset`). All existing tests still pass.

- [ ] **Step 3: Implement controlled-mode support in `WithSearch`**

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
  const [internalQuery, setInternalQuery] = useState('')
  const { caseSensitive = false, diacriticSensitive = false, minLength = 2 } = options ?? {}

  const isControlled = controlledQuery !== undefined
  const query = isControlled ? controlledQuery : internalQuery
  const setQuery = isControlled ? (onSetQuery ?? (() => {})) : setInternalQuery

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

  const reset = useCallback(() => {
    if (onReset) {
      onReset()
    } else {
      setQuery('')
    }
  }, [onReset, setQuery])

  const value: SearchContextValue = useMemo(
    () => ({ query, setQuery, patterns, executeSearch, hasPatterns, reset }),
    [query, setQuery, patterns, executeSearch, hasPatterns, reset]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
pnpm --filter @quaesitor-textus/core test
```

Expected: all tests pass, including the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/context/WithSearch.tsx packages/core/src/context/WithSearch.test.tsx
git commit -m "feat(core): add controlled-mode support to WithSearch"
```
