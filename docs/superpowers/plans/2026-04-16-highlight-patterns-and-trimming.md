# Highlight Patterns Accumulation and Text Trimming — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `highlightedPatterns` accumulation to `SearchContext`/`WithSearch`, update `HighlightedText` to use it, and add `trimAroundMatch` + `HighlightedTrimmedText` for displaying trimmed text around search matches.

**Architecture:** `SearchContextValue` gains a `highlightedPatterns` field that each `WithSearch` builds by merging its own `patterns` with any `highlightedPatterns` from the nearest upstream context. `HighlightedText` reads this field instead of `patterns`, merging it with any explicit `patterns` prop. `HighlightedTrimmedText` is a new component that trims text to a fragment centered on the match before delegating to `HighlightedText`. Both stories are updated to use `HighlightedTrimmedText` with `fragmentLength={40}` and no explicit `patterns` prop.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/core/src/context/SearchContext.ts` |
| Modify | `packages/core/src/context/WithSearch.tsx` |
| Modify (tests) | `packages/core/src/context/WithSearch.test.tsx` |
| Modify | `packages/core/src/components/HighlightedText.tsx` |
| Modify (tests) | `packages/core/src/components/HighlightedText.test.tsx` |
| Create | `packages/core/src/logic/trimAroundMatch.ts` |
| Create (tests) | `packages/core/src/logic/trimAroundMatch.test.ts` |
| Modify | `packages/core/src/logic/index.ts` |
| Create | `packages/core/src/components/HighlightedTrimmedText.tsx` |
| Create (tests) | `packages/core/src/components/HighlightedTrimmedText.test.tsx` |
| Modify | `packages/core/src/index.ts` |
| Modify | `packages/core/stories/FullListDemo.stories.tsx` |
| Modify | `packages/antd/stories/FullListDemo.stories.tsx` |

---

## Task 1: Add `highlightedPatterns` to `SearchContext` and `WithSearch`

**Files:**
- Modify: `packages/core/src/context/SearchContext.ts`
- Modify: `packages/core/src/context/WithSearch.tsx`
- Modify (tests): `packages/core/src/context/WithSearch.test.tsx`

- [ ] **Step 1: Add the type + minimal stub to keep TypeScript happy**

In `packages/core/src/context/SearchContext.ts`, add `highlightedPatterns: string[]` to `SearchContextValue`:

```ts
export interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  highlightedPatterns: string[]
  executeSearch: <T>(items: T[], getCorpus: (item: T) => string) => T[]
  hasPatterns: boolean
  reset: () => void
}
```

In `packages/core/src/context/WithSearch.tsx`, add a stub so the file compiles. Change the `import` line from:

```ts
import React, { useMemo } from 'react'
```

to:

```ts
import React, { useContext, useMemo } from 'react'
```

Inside `WithSearch`, add `highlightedPatterns: []` to the value memo (stub, will be replaced in step 4):

```ts
const value: SearchContextValue = useMemo(
  () => ({ query, setQuery, patterns, highlightedPatterns: [], executeSearch, hasPatterns, reset }),
  [query, setQuery, patterns, executeSearch, hasPatterns, reset]
)
```

- [ ] **Step 2: Write failing tests in `WithSearch.test.tsx`**

Add a `HighlightConsumer` helper near the top of the test file, after the existing `ResetConsumer`:

```tsx
const HighlightConsumer = () => {
  const { highlightedPatterns } = useSearchContext()
  return <div data-testid="highlighted">{highlightedPatterns.join(',')}</div>
}
```

Append these two tests to the `describe` block:

```tsx
it('exposes highlightedPatterns equal to patterns', () => {
  render(
    <WithSearch>
      <TestConsumer items={items} getCorpus={getCorpus} />
      <HighlightConsumer />
    </WithSearch>
  )
  fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
  expect(screen.getByTestId('highlighted')).toHaveTextContent('apple')
})

it('nested WithSearch accumulates highlightedPatterns from both levels', () => {
  const InnerHighlight = () => {
    const { highlightedPatterns } = useSearchContext()
    return <div data-testid="inner-highlighted">{highlightedPatterns.join(',')}</div>
  }
  render(
    <WithSearch query="apple">
      <WithSearch query="banana">
        <InnerHighlight />
      </WithSearch>
    </WithSearch>
  )
  const el = screen.getByTestId('inner-highlighted')
  expect(el.textContent).toContain('apple')
  expect(el.textContent).toContain('banana')
})
```

- [ ] **Step 3: Run tests — confirm the two new tests fail**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|✓|✗|×|highlightedPatterns|accumulates"
```

Expected: the two new tests fail (stub returns `[]`, so `highlighted` is empty).

- [ ] **Step 4: Implement `highlightedPatterns` properly in `WithSearch`**

Replace the entire body of `WithSearch.tsx` with:

```tsx
import React, { useContext, useMemo } from 'react'
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

  const upstreamCtx = useContext(SearchContext)

  const executeSearch = useMemo(
    (): SearchContextValue['executeSearch'] =>
      function executeSearch<T>(items: T[], getCorpus: (item: T) => string): T[] {
        return items.filter(item =>
          matchItem(getCorpus(item), patterns, { caseSensitive, diacriticSensitive })
        )
      },
    [patterns, caseSensitive, diacriticSensitive]
  )

  const highlightedPatterns = useMemo(
    () => [...new Set([...(upstreamCtx?.highlightedPatterns ?? []), ...patterns])],
    [upstreamCtx, patterns]
  )

  const value: SearchContextValue = useMemo(
    () => ({ query, setQuery, patterns, highlightedPatterns, executeSearch, hasPatterns, reset }),
    [query, setQuery, patterns, highlightedPatterns, executeSearch, hasPatterns, reset]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
```

- [ ] **Step 5: Run all tests — confirm all pass**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass (previously 82, now 84).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/context/SearchContext.ts packages/core/src/context/WithSearch.tsx packages/core/src/context/WithSearch.test.tsx
git commit -m "feat(core): add highlightedPatterns accumulation to SearchContext and WithSearch"
```

---

## Task 2: Update `HighlightedText`

**Files:**
- Modify: `packages/core/src/components/HighlightedText.tsx`
- Modify (tests): `packages/core/src/components/HighlightedText.test.tsx`

- [ ] **Step 1: Update and add failing tests in `HighlightedText.test.tsx`**

Replace the entire file content with the following (changes from current are: test 1 updated to check `container.textContent` instead of `screen.getByText`; test 7 renamed; three new tests added at the end):

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { HighlightedText } from './HighlightedText'
import { WithSearch } from '../context/WithSearch'
import { useSearchContext } from '../context/useSearchContext'

describe('HighlightedText', () => {
  it('renders plain text without marks or wrapper when patterns are empty', () => {
    const { container } = render(<HighlightedText text="hello world" patterns={[]} />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.querySelector('span')).toBeNull()
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
    expect(marks[0].textContent).toBe('hello')
    expect(marks[1].textContent).toBe('world')
  })

  it('renders only one mark when patterns overlap', () => {
    // 'abc' and 'bcd' overlap — only 'abc' should be marked
    const { container } = render(
      <HighlightedText text="abcde" patterns={['abc', 'bcd']} />
    )
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('abc')
  })

  it('renders text without marks when used outside WithSearch and no patterns prop', () => {
    const { container } = render(<HighlightedText text="hello world" />)
    expect(container.querySelector('mark')).toBeNull()
  })

  it('reads patterns from context when no patterns prop is given', async () => {
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
    // After setQuery('hello'), patterns = ['hello'] (length 5 ≥ minLength 2)
    await act(async () => {})
    const mark = container.querySelector('mark')
    expect(mark?.textContent).toBe('hello')
  })

  it('explicit patterns prop highlights when context has no patterns', () => {
    const { container } = render(
      <WithSearch>
        <HighlightedText text="hello world" patterns={['world']} />
      </WithSearch>
    )
    const mark = container.querySelector('mark')
    expect(mark?.textContent).toBe('world')
  })

  it('applies custom markStyle', () => {
    const { container } = render(
      <HighlightedText
        text="hello"
        patterns={['hello']}
        markStyle={{ background: 'red' }}
      />
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
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('hello')
  })

  it('merges prop patterns with context highlightedPatterns', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('hello') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedText text="hello world" patterns={['world']} />
      </WithSearch>
    )
    await act(async () => {})
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(2)
    expect(marks[0].textContent).toBe('hello')
    expect(marks[1].textContent).toBe('world')
  })
})
```

- [ ] **Step 2: Run tests — confirm the new/updated tests fail**

```bash
cd packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|✓|✗|×|undefined|wrapper|merges"
```

Expected: "returns nothing when text is undefined", "returns raw string without span wrapper when no patterns match", "merges prop patterns", and "renders plain text without marks or wrapper" all fail.

- [ ] **Step 3: Implement the three changes in `HighlightedText.tsx`**

Replace the entire file with:

```tsx
import React, { useContext } from 'react'
import { SearchContext } from '../context/SearchContext'
import { getHighlightPositions } from '../logic/getHighlightPositions'
import type { SearchOptions } from '../logic/types'

const DEFAULT_MARK_STYLE: React.CSSProperties = {
  background: '#FFFF5480',
  padding: '2px',
  margin: '-2px',
}

interface HighlightedTextProps {
  text: string | undefined
  /** Additional patterns to highlight on top of any context highlightedPatterns. */
  patterns?: string[]
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

export function HighlightedText({
  text,
  patterns: propPatterns,
  options,
  markStyle = DEFAULT_MARK_STYLE,
}: HighlightedTextProps) {
  const ctx = useContext(SearchContext)
  const patterns = [...new Set([...(ctx?.highlightedPatterns ?? []), ...(propPatterns ?? [])])]

  if (text === undefined) return undefined

  const spans = getHighlightPositions(text, patterns, options)

  if (spans.length === 0) {
    return text
  }

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

- [ ] **Step 4: Run all tests — confirm all pass**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass (previously 84, now 87).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/HighlightedText.tsx packages/core/src/components/HighlightedText.test.tsx
git commit -m "feat(core): update HighlightedText to use highlightedPatterns from context"
```

---

## Task 3: `trimAroundMatch` pure function

**Files:**
- Create: `packages/core/src/logic/trimAroundMatch.ts`
- Create (tests): `packages/core/src/logic/trimAroundMatch.test.ts`
- Modify: `packages/core/src/logic/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests in `packages/core/src/logic/trimAroundMatch.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { trimAroundMatch } from './trimAroundMatch'

describe('trimAroundMatch', () => {
  it('returns text unchanged when shorter than fragmentLength', () => {
    expect(trimAroundMatch('hello', ['h'], { fragmentLength: 10 })).toBe('hello')
  })

  it('returns text unchanged when exactly equal to fragmentLength', () => {
    expect(trimAroundMatch('hello', ['h'], { fragmentLength: 5 })).toBe('hello')
  })

  it('truncates from start with trailing ellipsis when no match found', () => {
    expect(trimAroundMatch('abcdefghijklmno', ['zzz'], { fragmentLength: 5 })).toBe('abcde…')
  })

  it('truncates from start with trailing ellipsis when patterns are empty', () => {
    expect(trimAroundMatch('abcdefghijklmno', [], { fragmentLength: 5 })).toBe('abcde…')
  })

  it('returns fragment with no leading ellipsis when match is near the start', () => {
    // 'hello world' (11), pattern 'hello' at 0–5, fragmentLength=8
    // buffer=3, idealStart=-1, startPos=0, endPos=8 → 'hello wo…'
    expect(trimAroundMatch('hello world', ['hello'], { fragmentLength: 8 })).toBe('hello wo…')
  })

  it('returns fragment with no trailing ellipsis when match is near the end', () => {
    // 'hello world' (11), pattern 'world' at 6–11, fragmentLength=8
    // buffer=3, idealStart=5, startPos=3, endPos=11 → '…lo world'
    expect(trimAroundMatch('hello world', ['world'], { fragmentLength: 8 })).toBe('…lo world')
  })

  it('returns fragment with both ellipses when match is in the middle', () => {
    // 'aaaaabcdeaaaaa' (14), pattern 'bcd' at 5–8, fragmentLength=5
    // buffer=2, idealStart=4, startPos=4, endPos=9 → '…abcde…'
    expect(trimAroundMatch('aaaaabcdeaaaaa', ['bcd'], { fragmentLength: 5 })).toBe('…abcde…')
  })

  it('uses default fragmentLength of 80 when not specified', () => {
    const text = 'x'.repeat(100)
    const result = trimAroundMatch(text, [])
    // no match → first 80 chars + ellipsis
    expect(result).toBe('x'.repeat(80) + '…')
  })

  it('is case-insensitive by default when locating the trim window', () => {
    // 'hello world' (11), pattern 'HELLO', fragmentLength=8
    // same window as lowercase: 'hello wo…'
    expect(trimAroundMatch('hello world', ['HELLO'], { fragmentLength: 8 })).toBe('hello wo…')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail (file not found)**

```bash
cd packages/core && pnpm test -- trimAroundMatch 2>&1 | tail -10
```

Expected: error — cannot find module `./trimAroundMatch`.

- [ ] **Step 3: Create `packages/core/src/logic/trimAroundMatch.ts`**

```ts
import type { SearchOptions } from './types'
import { getHighlightPositions } from './getHighlightPositions'

export interface TrimOptions extends SearchOptions {
  /**
   * Maximum number of characters in the returned fragment.
   * Ellipsis characters (…) are appended/prepended on top of this count.
   * Defaults to 80.
   */
  fragmentLength?: number
}

export function trimAroundMatch(
  text: string,
  patterns: string[],
  options: TrimOptions = {}
): string {
  const { fragmentLength = 80, ...searchOptions } = options

  if (text.length <= fragmentLength) return text

  const spans = getHighlightPositions(text, patterns, searchOptions)

  if (spans.length === 0) {
    return text.substring(0, fragmentLength) + '…'
  }

  const minStart = Math.min(...spans.map(s => s.start))
  const maxEnd = Math.max(...spans.map(s => s.end))
  const buffer = fragmentLength - (maxEnd - minStart)

  const idealStart = minStart - Math.floor(buffer / 2)
  const startPos = Math.max(0, Math.min(idealStart, text.length - fragmentLength))
  const endPos = Math.min(startPos + fragmentLength, text.length)

  const prefix = startPos > 0 ? '…' : ''
  const suffix = endPos < text.length ? '…' : ''

  return prefix + text.substring(startPos, endPos) + suffix
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd packages/core && pnpm test -- trimAroundMatch 2>&1 | tail -5
```

Expected: all 9 tests pass.

- [ ] **Step 5: Export from `packages/core/src/logic/index.ts`**

Add to the end of the file:

```ts
export { trimAroundMatch } from './trimAroundMatch'
export type { TrimOptions } from './trimAroundMatch'
```

- [ ] **Step 6: Export from `packages/core/src/index.ts`**

Add after the existing logic exports (after the `getHighlightPositions` line):

```ts
export { trimAroundMatch } from './logic/trimAroundMatch'
export type { TrimOptions } from './logic/trimAroundMatch'
```

- [ ] **Step 7: Run all tests — confirm nothing broke**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass (now 96).

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/logic/trimAroundMatch.ts packages/core/src/logic/trimAroundMatch.test.ts packages/core/src/logic/index.ts packages/core/src/index.ts
git commit -m "feat(core): add trimAroundMatch pure function"
```

---

## Task 4: `HighlightedTrimmedText` component

**Files:**
- Create: `packages/core/src/components/HighlightedTrimmedText.tsx`
- Create (tests): `packages/core/src/components/HighlightedTrimmedText.test.tsx`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests in `packages/core/src/components/HighlightedTrimmedText.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'
import { HighlightedTrimmedText } from './HighlightedTrimmedText'
import { WithSearch } from '../context/WithSearch'
import { useSearchContext } from '../context/useSearchContext'

describe('HighlightedTrimmedText', () => {
  it('returns nothing when text is undefined', () => {
    const { container } = render(<HighlightedTrimmedText text={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders full text with highlights when shorter than fragmentLength', async () => {
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('fox') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedTrimmedText text="fox" fragmentLength={80} />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.querySelector('mark')?.textContent).toBe('fox')
    expect(container.textContent).toBe('fox')
  })

  it('trims long text to fragmentLength around the match and highlights it', async () => {
    // 'The quick brown fox jumps' (25), 'fox' at 16–19, fragmentLength=10
    // buffer=7, idealStart=13, startPos=13, endPos=23 → '…n fox jum…'
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('fox') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedTrimmedText text="The quick brown fox jumps" fragmentLength={10} />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.querySelector('mark')?.textContent).toBe('fox')
    expect(container.textContent).toBe('…n fox jum…')
  })

  it('respects explicit fragmentLength prop', async () => {
    // 'aaaaabcaaaaa' (12), 'bc' at 5–7, fragmentLength=4
    // buffer=2, idealStart=4, startPos=4, endPos=8 → '…abca…'
    // then HighlightedText marks 'bc' inside '…abca…'
    const Setter = () => {
      const { setQuery } = useSearchContext()
      React.useEffect(() => { setQuery('bc') }, [setQuery])
      return null
    }
    const { container } = render(
      <WithSearch>
        <Setter />
        <HighlightedTrimmedText text="aaaaabcaaaaa" fragmentLength={4} />
      </WithSearch>
    )
    await act(async () => {})
    expect(container.textContent).toBe('…abca…')
    expect(container.querySelector('mark')?.textContent).toBe('bc')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail (file not found)**

```bash
cd packages/core && pnpm test -- HighlightedTrimmedText 2>&1 | tail -10
```

Expected: error — cannot find module `./HighlightedTrimmedText`.

- [ ] **Step 3: Create `packages/core/src/components/HighlightedTrimmedText.tsx`**

```tsx
import React, { useContext } from 'react'
import { SearchContext } from '../context/SearchContext'
import { trimAroundMatch } from '../logic/trimAroundMatch'
import type { SearchOptions } from '../logic/types'
import { HighlightedText } from './HighlightedText'

interface HighlightedTrimmedTextProps {
  text: string | undefined
  /** Maximum characters in the displayed fragment. Ellipsis not counted. Defaults to 80. */
  fragmentLength?: number
  options?: SearchOptions
  markStyle?: React.CSSProperties
}

export function HighlightedTrimmedText({
  text,
  fragmentLength = 80,
  options,
  markStyle,
}: HighlightedTrimmedTextProps) {
  const ctx = useContext(SearchContext)
  const highlightedPatterns = ctx?.highlightedPatterns ?? []

  if (text === undefined) return undefined

  const trimmed = trimAroundMatch(text, highlightedPatterns, { fragmentLength, ...options })
  return <HighlightedText text={trimmed} options={options} markStyle={markStyle} />
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd packages/core && pnpm test -- HighlightedTrimmedText 2>&1 | tail -5
```

Expected: all 4 tests pass.

- [ ] **Step 5: Export from `packages/core/src/index.ts`**

Add after the `HighlightedText` export line:

```ts
export { HighlightedTrimmedText } from './components/HighlightedTrimmedText'
```

- [ ] **Step 6: Run all tests — confirm nothing broke**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass (now 100).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/components/HighlightedTrimmedText.tsx packages/core/src/components/HighlightedTrimmedText.test.tsx packages/core/src/index.ts
git commit -m "feat(core): add HighlightedTrimmedText component"
```

---

## Task 5: Update stories

**Files:**
- Modify: `packages/core/stories/FullListDemo.stories.tsx`
- Modify: `packages/antd/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Update `packages/core/stories/FullListDemo.stories.tsx`**

Replace the file with:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { WithSearch, SearchInput, HighlightedTrimmedText, useSearchContext } from '../src'
import { phrases } from './data/phrases'

const meta: Meta = {
  title: 'Core/FullListDemo',
}

export default meta

const FullList = () => {
  const { executeSearch, hasPatterns, reset } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo</h2>
      <SearchInput
        placeholder="Search phrases…"
        style={{ width: '100%', padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
        autoFocus
      />
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            matches: {filtered.length} of {phrases.length} sentences
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {filtered.map(phrase => (
              <li key={phrase} style={{ marginBottom: 4 }}>
                <HighlightedTrimmedText text={phrase} fragmentLength={40} />
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

- [ ] **Step 2: Update `packages/antd/stories/FullListDemo.stories.tsx`**

Replace the file with:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { Table } from 'antd'
import type { TableColumnsType } from 'antd'
import { WithSearch, HighlightedTrimmedText, useSearchContext } from '@quaesitor-textus/core'
import { SearchInput } from '../src'
import { phrases } from './data/phrases'

const meta: Meta = {
  title: 'Antd/FullListDemo',
}

export default meta

type PhraseRow = { key: string; phrase: string }

interface FullListProps {
  currentPage: number
  setCurrentPage: (page: number) => void
}

const FullList = ({ currentPage, setCurrentPage }: FullListProps) => {
  const { executeSearch, hasPatterns, reset } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)

  const dataSource: PhraseRow[] = filtered.map(phrase => ({ key: phrase, phrase }))

  const cols: TableColumnsType<PhraseRow> = [
    {
      title: 'Phrase',
      dataIndex: 'phrase',
      render: (phrase: string) => <HighlightedTrimmedText text={phrase} fragmentLength={40} />,
    },
  ]

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo (antd)</h2>
      <SearchInput placeholder="Search phrases…" autoFocus />
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            matches: {filtered.length} of {phrases.length} sentences
          </p>
          <Table<PhraseRow>
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
        </>
      )}
    </div>
  )
}

const FullListWrapper = () => {
  const [currentPage, setCurrentPage] = useState(1)
  return (
    <WithSearch
      // Reset to page 1 whenever the search query changes (old/new values not needed here)
      onChange={() => setCurrentPage(1)}
    >
      <FullList currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </WithSearch>
  )
}

export const Default: StoryObj = {
  render: () => <FullListWrapper />,
}
```

- [ ] **Step 3: Run all core tests — confirm nothing broke**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/stories/FullListDemo.stories.tsx packages/antd/stories/FullListDemo.stories.tsx
git commit -m "feat(stories): use HighlightedTrimmedText with fragmentLength=40 in both FullListDemos"
```
