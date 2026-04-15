# Reset Link and antd SearchInput Clear Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clear button to the antd `SearchInput` component and make the "try a different term" text in both FullListDemo stories a clickable reset link.

**Architecture:** The antd `SearchInput` gains a `suffix`-based clear button that calls `reset()` from context directly (not `allowClear`, to avoid double-calls in controlled mode). Both FullListDemo stories add `reset` to their context destructuring and replace the static "no results" text with a styled clickable span.

**Tech Stack:** React 18, antd 5, Vitest, @testing-library/react

---

## File Map

| Action | Path |
|--------|------|
| Modify | `packages/antd/src/components/SearchInput.tsx` |
| Modify | `packages/antd/src/components/SearchInput.test.tsx` |
| Modify | `packages/core/stories/FullListDemo.stories.tsx` |
| Modify | `packages/antd/stories/FullListDemo.stories.tsx` |

---

### Task 1: antd SearchInput — add clear button

**Files:**
- Modify: `packages/antd/src/components/SearchInput.tsx`
- Test: `packages/antd/src/components/SearchInput.test.tsx`

- [ ] **Step 1: Add failing tests**

Open `packages/antd/src/components/SearchInput.test.tsx`. Add `vi` to the vitest import and append these four test cases inside the existing `describe('antd SearchInput', ...)` block:

```tsx
import { describe, it, expect, vi } from 'vitest'
```

New tests (add after the last existing `it(...)` block, still inside `describe`):

```tsx
  it('does not show clear button when query is empty', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
      </WithSearch>
    )
    expect(screen.queryByLabelText('Clear search')).toBeNull()
  })

  it('shows clear button when query is non-empty', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
      </WithSearch>
    )
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'hello' },
    })
    expect(screen.getByLabelText('Clear search')).toBeDefined()
  })

  it('clicking clear button resets query to empty', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'hello' },
    })
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(screen.getByTestId('query')).toHaveTextContent('')
  })

  it('clicking clear button calls onReset when provided', () => {
    const onReset = vi.fn()
    render(
      <WithSearch query="hello" onSetQuery={() => {}} onReset={onReset}>
        <SearchInput placeholder="Search..." />
      </WithSearch>
    )
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(onReset).toHaveBeenCalledTimes(1)
  })
```

`QueryDisplay` is already defined earlier in the test file as:
```tsx
const QueryDisplay = () => {
  const { query } = useSearchContext()
  return <div data-testid="query">{query}</div>
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @quaesitor-textus/antd test 2>&1 | tail -15
```

Expected: 4 new tests fail (`queryByLabelText`/`getByLabelText` return null or throw, `onReset` not called).

- [ ] **Step 3: Implement the clear button**

Replace the entire contents of `packages/antd/src/components/SearchInput.tsx` with:

```tsx
import React from 'react'
import { Input } from 'antd'
import type { InputProps } from 'antd'
import { useSearchContext } from '@quaesitor-textus/core'

export function SearchInput(props: Omit<InputProps, 'value' | 'onChange' | 'suffix'>) {
  const { query, setQuery, reset } = useSearchContext()
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
        ) : <span />
      }
    />
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @quaesitor-textus/antd test 2>&1 | tail -15
```

Expected:
```
Test Files  1 passed (1)
     Tests  7 passed (7)
```

- [ ] **Step 5: Commit**

```bash
git add packages/antd/src/components/SearchInput.tsx packages/antd/src/components/SearchInput.test.tsx
git commit -m "feat(antd): add clear button to SearchInput"
```

---

### Task 2: Core FullListDemo — reset link

**Files:**
- Modify: `packages/core/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Add `reset` to context destructuring**

In `packages/core/stories/FullListDemo.stories.tsx`, change line 13:

```tsx
  const { executeSearch, patterns, hasPatterns } = useSearchContext()
```

to:

```tsx
  const { executeSearch, patterns, hasPatterns, reset } = useSearchContext()
```

- [ ] **Step 2: Replace the "no results" paragraph**

Change:

```tsx
          {filtered.length === 0 && (
            <p style={{ color: '#999', fontStyle: 'italic' }}>No results — try a different term</p>
          )}
```

to:

```tsx
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
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
pnpm --filter @quaesitor-textus/core test 2>&1 | tail -5
```

Expected: all tests still pass (no story test files — this just confirms the package compiles).

- [ ] **Step 4: Commit**

```bash
git add packages/core/stories/FullListDemo.stories.tsx
git commit -m "feat(core): make 'try a different term' a reset link in FullListDemo"
```

---

### Task 3: Antd FullListDemo — reset link

**Files:**
- Modify: `packages/antd/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Add `reset` to context destructuring**

In `packages/antd/stories/FullListDemo.stories.tsx`, change line 14:

```tsx
  const { executeSearch, patterns, hasPatterns } = useSearchContext()
```

to:

```tsx
  const { executeSearch, patterns, hasPatterns, reset } = useSearchContext()
```

- [ ] **Step 2: Replace the "no results" paragraph**

Change:

```tsx
          {filtered.length === 0 && (
            <p style={{ color: '#999', fontStyle: 'italic' }}>No results — try a different term</p>
          )}
```

to:

```tsx
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
```

- [ ] **Step 3: Verify tests still pass**

```bash
pnpm --filter @quaesitor-textus/antd test 2>&1 | tail -5
```

Expected: 7 tests pass (story changes don't affect component tests).

- [ ] **Step 4: Commit**

```bash
git add packages/antd/stories/FullListDemo.stories.tsx
git commit -m "feat(antd): make 'try a different term' a reset link in FullListDemo"
```
