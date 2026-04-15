# quaesitor-textus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `quaesitor-textus` monorepo with `@quaesitor-textus/core` (pure logic + React context API + Storybook) and `@quaesitor-textus/antd` (Ant Design styled SearchInput).

**Architecture:** pnpm workspaces monorepo with two packages. Core exposes pure TypeScript logic functions, a React context (`WithSearch`) that owns search state, and a headless `SearchInput` + `HighlightedText` component. The antd package wraps Ant Design's `Input` as a drop-in `SearchInput` that reads from the same context.

**Tech Stack:** TypeScript 5, React 18, pnpm workspaces, tsup (build), vitest + @testing-library/react (tests), Storybook 8 + @storybook/react-vite, Ant Design 5, GitHub Actions (deploy Storybook to GitHub Pages)

---

## File Map

```
quaesitor-textus/
  .gitignore
  pnpm-workspace.yaml
  package.json
  tsconfig.json
  .github/
    workflows/
      storybook.yml
  packages/
    core/
      package.json
      tsconfig.json
      tsup.config.ts
      vitest.config.ts
      .storybook/
        main.ts
        preview.ts
      src/
        test-setup.ts
        logic/
          types.ts
          parseInput.ts           + parseInput.test.ts
          normalizeText.ts        + normalizeText.test.ts
          matchItem.ts            + matchItem.test.ts
          getHighlightPositions.ts + getHighlightPositions.test.ts
          index.ts
        hooks/
          useSearch.ts            + useSearch.test.ts
        context/
          SearchContext.ts
          WithSearch.tsx          + WithSearch.test.tsx
          useSearchContext.ts
        components/
          SearchInput.tsx         + SearchInput.test.tsx
          HighlightedText.tsx     + HighlightedText.test.tsx
        index.ts
      stories/
        data/
          phrases.ts
        HighlightedText.stories.tsx
        SearchInput.stories.tsx
        FullListDemo.stories.tsx
    antd/
      package.json
      tsconfig.json
      tsup.config.ts
      vitest.config.ts
      src/
        components/
          SearchInput.tsx         + SearchInput.test.tsx
        index.ts
```

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `.gitignore`
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
storybook-static/
*.tsbuildinfo
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "quaesitor-textus",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 4: Create root `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 5: Install root deps**

```bash
pnpm install
```

Expected: `node_modules/` created at root, lockfile written.

- [ ] **Step 6: Commit**

```bash
git add .gitignore pnpm-workspace.yaml package.json tsconfig.json pnpm-lock.yaml
git commit -m "chore: monorepo scaffold"
```

---

## Task 2: Core package scaffold

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/test-setup.ts`

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@quaesitor-textus/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.cjs",
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "devDependencies": {
    "@storybook/addon-essentials": "^8.0.0",
    "@storybook/react-vite": "^8.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "jsdom": "^24.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "storybook": "^8.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/core/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom'],
})
```

- [ ] **Step 4: Create `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 5: Create `packages/core/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Install core deps**

```bash
pnpm install
```

Expected: `packages/core/node_modules/` populated.

- [ ] **Step 7: Commit**

```bash
git add packages/core/
git commit -m "chore: add @quaesitor-textus/core package scaffold"
```

---

## Task 3: Shared types

**Files:**
- Create: `packages/core/src/logic/types.ts`

- [ ] **Step 1: Create `packages/core/src/logic/types.ts`**

```ts
export interface SearchOptions {
  caseSensitive?: boolean
  diacriticSensitive?: boolean
  minLength?: number
}

export interface HighlightSpan {
  start: number
  end: number
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/logic/types.ts
git commit -m "feat(core): add SearchOptions and HighlightSpan types"
```

---

## Task 4: `parseInput` (TDD)

**Files:**
- Create: `packages/core/src/logic/parseInput.ts`
- Create: `packages/core/src/logic/parseInput.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/logic/parseInput.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseInput } from './parseInput'

describe('parseInput', () => {
  it('returns empty array for empty string', () => {
    expect(parseInput('')).toEqual([])
  })

  it('returns empty array for whitespace only', () => {
    expect(parseInput('   ')).toEqual([])
  })

  it('splits on spaces', () => {
    expect(parseInput('foo bar')).toEqual(['foo', 'bar'])
  })

  it('handles multiple consecutive spaces', () => {
    expect(parseInput('foo  bar')).toEqual(['foo', 'bar'])
  })

  it('does not split on commas', () => {
    expect(parseInput('foo,bar')).toEqual(['foo,bar'])
  })

  it('trims leading and trailing whitespace', () => {
    expect(parseInput('  foo  ')).toEqual(['foo'])
  })

  it('returns empty array for single pattern shorter than default minLength (2)', () => {
    expect(parseInput('f')).toEqual([])
  })

  it('returns pattern when single pattern meets minLength', () => {
    expect(parseInput('fo')).toEqual(['fo'])
  })

  it('returns all patterns when multiple patterns are present, regardless of length', () => {
    // minLength check only applies when there is exactly one pattern
    expect(parseInput('f b')).toEqual(['f', 'b'])
  })

  it('respects custom minLength option', () => {
    expect(parseInput('f', { minLength: 1 })).toEqual(['f'])
    expect(parseInput('f', { minLength: 3 })).toEqual([])
    expect(parseInput('fo', { minLength: 3 })).toEqual([])
    expect(parseInput('foo', { minLength: 3 })).toEqual(['foo'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module './parseInput'`

- [ ] **Step 3: Implement `parseInput`**

Create `packages/core/src/logic/parseInput.ts`:

```ts
import type { SearchOptions } from './types'

export function parseInput(text: string, options: SearchOptions = {}): string[] {
  const { minLength = 2 } = options
  const patterns = text.trim().split(' ').filter(s => s.length > 0)
  if (patterns.length === 1 && patterns[0].length < minLength) {
    return []
  }
  return patterns
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: PASS — all `parseInput` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/logic/parseInput.ts packages/core/src/logic/parseInput.test.ts
git commit -m "feat(core): add parseInput"
```

---

## Task 5: `normalizeText` (TDD)

**Files:**
- Create: `packages/core/src/logic/normalizeText.ts`
- Create: `packages/core/src/logic/normalizeText.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/logic/normalizeText.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeText } from './normalizeText'

describe('normalizeText', () => {
  it('lowercases by default', () => {
    expect(normalizeText('Hello World')).toBe('hello world')
  })

  it('removes diacritics by default', () => {
    expect(normalizeText('é')).toBe('e')
    expect(normalizeText('ñ')).toBe('n')
    expect(normalizeText('ü')).toBe('u')
    expect(normalizeText('Héllo')).toBe('hello')
  })

  it('preserves case when caseSensitive: true', () => {
    expect(normalizeText('Hello', { caseSensitive: true })).toBe('Hello')
  })

  it('preserves diacritics when diacriticSensitive: true', () => {
    expect(normalizeText('é', { diacriticSensitive: true })).toBe('é')
    expect(normalizeText('Héllo', { diacriticSensitive: true })).toBe('héllo')
  })

  it('respects both flags combined', () => {
    expect(
      normalizeText('Héllo', { caseSensitive: true, diacriticSensitive: true })
    ).toBe('Héllo')
  })

  it('returns empty string unchanged', () => {
    expect(normalizeText('')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module './normalizeText'`

- [ ] **Step 3: Implement `normalizeText`**

Create `packages/core/src/logic/normalizeText.ts`:

```ts
import type { SearchOptions } from './types'

export function normalizeText(text: string, options: SearchOptions = {}): string {
  const { caseSensitive = false, diacriticSensitive = false } = options
  let result = text
  if (!diacriticSensitive) {
    result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
  if (!caseSensitive) {
    result = result.toLowerCase()
  }
  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: PASS — all `normalizeText` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/logic/normalizeText.ts packages/core/src/logic/normalizeText.test.ts
git commit -m "feat(core): add normalizeText"
```

---

## Task 6: `matchItem` (TDD)

**Files:**
- Create: `packages/core/src/logic/matchItem.ts`
- Create: `packages/core/src/logic/matchItem.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/logic/matchItem.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { matchItem } from './matchItem'

describe('matchItem', () => {
  it('returns true when single pattern matches', () => {
    expect(matchItem('hello world', ['hello'])).toBe(true)
  })

  it('returns false when pattern does not match', () => {
    expect(matchItem('hello world', ['xyz'])).toBe(false)
  })

  it('returns true only when all patterns match (AND logic)', () => {
    expect(matchItem('hello world', ['hello', 'world'])).toBe(true)
    expect(matchItem('hello world', ['hello', 'xyz'])).toBe(false)
  })

  it('returns true for empty patterns array (filter inactive)', () => {
    expect(matchItem('hello world', [])).toBe(true)
  })

  it('is case-insensitive by default', () => {
    expect(matchItem('Hello World', ['hello'])).toBe(true)
    expect(matchItem('hello world', ['HELLO'])).toBe(true)
  })

  it('is diacritic-insensitive by default', () => {
    expect(matchItem('héllo', ['hello'])).toBe(true)
    expect(matchItem('hello', ['héllo'])).toBe(true)
  })

  it('order of patterns does not matter', () => {
    expect(matchItem('hello world', ['world', 'hello'])).toBe(true)
  })

  it('allows overlapping matches', () => {
    expect(matchItem('abcabc', ['abc', 'bca'])).toBe(true)
  })

  it('respects caseSensitive option', () => {
    expect(matchItem('Hello', ['hello'], { caseSensitive: true })).toBe(false)
    expect(matchItem('Hello', ['Hello'], { caseSensitive: true })).toBe(true)
  })

  it('respects diacriticSensitive option', () => {
    expect(matchItem('héllo', ['hello'], { diacriticSensitive: true })).toBe(false)
    expect(matchItem('héllo', ['héllo'], { diacriticSensitive: true })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module './matchItem'`

- [ ] **Step 3: Implement `matchItem`**

Create `packages/core/src/logic/matchItem.ts`:

```ts
import type { SearchOptions } from './types'
import { normalizeText } from './normalizeText'

export function matchItem(
  corpus: string,
  patterns: string[],
  options: SearchOptions = {}
): boolean {
  if (patterns.length === 0) return true
  const normalizedCorpus = normalizeText(corpus, options)
  return patterns.every(pattern => {
    const normalizedPattern = normalizeText(pattern, options)
    return normalizedCorpus.indexOf(normalizedPattern) !== -1
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: PASS — all `matchItem` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/logic/matchItem.ts packages/core/src/logic/matchItem.test.ts
git commit -m "feat(core): add matchItem"
```

---

## Task 7: `getHighlightPositions` (TDD)

**Files:**
- Create: `packages/core/src/logic/getHighlightPositions.ts`
- Create: `packages/core/src/logic/getHighlightPositions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/logic/getHighlightPositions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getHighlightPositions } from './getHighlightPositions'

describe('getHighlightPositions', () => {
  it('returns empty array for empty patterns', () => {
    expect(getHighlightPositions('hello world', [])).toEqual([])
  })

  it('returns correct span for a single match', () => {
    expect(getHighlightPositions('hello world', ['hello'])).toEqual([
      { start: 0, end: 5 },
    ])
  })

  it('returns correct span for a match not at position 0', () => {
    expect(getHighlightPositions('hello world', ['world'])).toEqual([
      { start: 6, end: 11 },
    ])
  })

  it('returns spans sorted by start position', () => {
    expect(getHighlightPositions('hello world', ['world', 'hello'])).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
    ])
  })

  it('discards overlapping spans (later span discarded if it overlaps with earlier)', () => {
    // 'abc' matches 0–3, 'bcd' matches 1–4 — 'bcd' overlaps, discarded
    expect(getHighlightPositions('abcde', ['abc', 'bcd'])).toEqual([
      { start: 0, end: 3 },
    ])
  })

  it('returns empty array when no pattern matches', () => {
    expect(getHighlightPositions('hello', ['xyz'])).toEqual([])
  })

  it('is case-insensitive by default', () => {
    expect(getHighlightPositions('Hello World', ['hello'])).toEqual([
      { start: 0, end: 5 },
    ])
  })

  it('is diacritic-insensitive by default', () => {
    // 'é' normalizes to 'e'; match found at position 0 in 'élan', raw pattern 'el' has length 2
    expect(getHighlightPositions('élan', ['el'])).toEqual([
      { start: 0, end: 2 },
    ])
  })

  it('skips patterns that do not match', () => {
    expect(getHighlightPositions('hello world', ['hello', 'xyz'])).toEqual([
      { start: 0, end: 5 },
    ])
  })

  it('end position uses raw (un-normalized) pattern length', () => {
    // 'héllo' raw length is 5; normalized to 'hello' which is 5 chars; start=0, end=5
    expect(getHighlightPositions('hello world', ['héllo'])).toEqual([
      { start: 0, end: 5 },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module './getHighlightPositions'`

- [ ] **Step 3: Implement `getHighlightPositions`**

Create `packages/core/src/logic/getHighlightPositions.ts`:

```ts
import type { HighlightSpan, SearchOptions } from './types'
import { normalizeText } from './normalizeText'

export function getHighlightPositions(
  text: string,
  patterns: string[],
  options: SearchOptions = {}
): HighlightSpan[] {
  if (patterns.length === 0) return []

  const normalizedText = normalizeText(text, options)

  const spans: HighlightSpan[] = []
  for (const pattern of patterns) {
    const normalizedPattern = normalizeText(pattern, options)
    const start = normalizedText.indexOf(normalizedPattern)
    if (start !== -1) {
      spans.push({ start, end: start + pattern.length })
    }
  }

  spans.sort((a, b) => a.start - b.start)

  const result: HighlightSpan[] = []
  let cursor = 0
  for (const span of spans) {
    if (span.start >= cursor) {
      result.push(span)
      cursor = span.end
    }
  }

  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: PASS — all `getHighlightPositions` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/logic/getHighlightPositions.ts packages/core/src/logic/getHighlightPositions.test.ts
git commit -m "feat(core): add getHighlightPositions"
```

---

## Task 8: Logic barrel export

**Files:**
- Create: `packages/core/src/logic/index.ts`

- [ ] **Step 1: Create `packages/core/src/logic/index.ts`**

```ts
export type { SearchOptions, HighlightSpan } from './types'
export { parseInput } from './parseInput'
export { normalizeText } from './normalizeText'
export { matchItem } from './matchItem'
export { getHighlightPositions } from './getHighlightPositions'
```

- [ ] **Step 2: Run full test suite to confirm nothing broken**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: PASS — all tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/logic/index.ts
git commit -m "feat(core): export logic barrel"
```

---

## Task 9: `useSearch` hook (TDD)

**Files:**
- Create: `packages/core/src/hooks/useSearch.ts`
- Create: `packages/core/src/hooks/useSearch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/hooks/useSearch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearch } from './useSearch'

const items = [
  { id: 1, name: 'Apple' },
  { id: 2, name: 'Banana' },
  { id: 3, name: 'Cherry' },
]

const getCorpus = (item: { name: string }) => item.name

describe('useSearch', () => {
  it('returns all items when query is empty', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    expect(result.current.filteredItems).toEqual(items)
  })

  it('returns all items when query is below minLength', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('a'))
    expect(result.current.filteredItems).toEqual(items)
  })

  it('filters items by query', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('an'))
    expect(result.current.filteredItems).toEqual([{ id: 2, name: 'Banana' }])
  })

  it('returns parsed patterns', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('apple'))
    expect(result.current.patterns).toEqual(['apple'])
  })

  it('returns the current query string', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('apple'))
    expect(result.current.query).toBe('apple')
  })

  it('returns empty patterns when query is below minLength', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('a'))
    expect(result.current.patterns).toEqual([])
  })

  it('is case-insensitive by default', () => {
    const { result } = renderHook(() => useSearch(items, getCorpus))
    act(() => result.current.setQuery('APPLE'))
    expect(result.current.filteredItems).toEqual([{ id: 1, name: 'Apple' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module './useSearch'`

- [ ] **Step 3: Implement `useSearch`**

Create `packages/core/src/hooks/useSearch.ts`:

```ts
import { useState, useMemo } from 'react'
import { parseInput } from '../logic/parseInput'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'

export interface UseSearchResult<T> {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  filteredItems: T[]
}

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

  return { query, setQuery, patterns, filteredItems }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: PASS — all `useSearch` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/hooks/useSearch.ts packages/core/src/hooks/useSearch.test.ts
git commit -m "feat(core): add useSearch hook"
```

---

## Task 10: `SearchContext` + `WithSearch` + `useSearchContext` (TDD)

**Files:**
- Create: `packages/core/src/context/SearchContext.ts`
- Create: `packages/core/src/context/useSearchContext.ts`
- Create: `packages/core/src/context/WithSearch.tsx`
- Create: `packages/core/src/context/WithSearch.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/context/WithSearch.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { WithSearch } from './WithSearch'
import { useSearchContext } from './useSearchContext'

interface Item { name: string }

const TestConsumer = ({ items, getCorpus }: { items: Item[]; getCorpus: (i: Item) => string }) => {
  const { query, setQuery, patterns, executeSearch } = useSearchContext()
  const filtered = executeSearch(items, getCorpus)
  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        data-testid="input"
      />
      <div data-testid="count">{filtered.length}</div>
      <div data-testid="patterns">{patterns.join(',')}</div>
    </div>
  )
}

const items: Item[] = [{ name: 'Apple' }, { name: 'Banana' }, { name: 'Cherry' }]
const getCorpus = (i: Item) => i.name

describe('WithSearch + useSearchContext', () => {
  it('provides initial empty query', () => {
    render(
      <WithSearch>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    expect(screen.getByTestId('input')).toHaveValue('')
  })

  it('executeSearch returns all items when query is empty', () => {
    render(
      <WithSearch>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    expect(screen.getByTestId('count')).toHaveTextContent('3')
  })

  it('executeSearch filters items as query changes', () => {
    render(
      <WithSearch>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'an' } })
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('exposes parsed patterns', () => {
    render(
      <WithSearch>
        <TestConsumer items={items} getCorpus={getCorpus} />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'apple' } })
    expect(screen.getByTestId('patterns')).toHaveTextContent('apple')
  })

  it('throws a descriptive error when used outside WithSearch', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(<TestConsumer items={items} getCorpus={getCorpus} />)
    ).toThrow('useSearchContext must be used within <WithSearch>')
    consoleSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module './WithSearch'`

- [ ] **Step 3: Create `packages/core/src/context/SearchContext.ts`**

```ts
import { createContext } from 'react'

export interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
  patterns: string[]
  executeSearch: <T>(items: T[], getCorpus: (item: T) => string) => T[]
}

export const SearchContext = createContext<SearchContextValue | null>(null)
```

- [ ] **Step 4: Create `packages/core/src/context/useSearchContext.ts`**

```ts
import { useContext } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'

export function useSearchContext(): SearchContextValue {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error('useSearchContext must be used within <WithSearch>')
  }
  return ctx
}
```

- [ ] **Step 5: Create `packages/core/src/context/WithSearch.tsx`**

```tsx
import React, { useState, useMemo } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchContextValue } from './SearchContext'
import { parseInput } from '../logic/parseInput'
import { matchItem } from '../logic/matchItem'
import type { SearchOptions } from '../logic/types'

interface WithSearchProps {
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

  const value: SearchContextValue = useMemo(
    () => ({ query, setQuery, patterns, executeSearch }),
    [query, patterns, executeSearch]
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: PASS — all `WithSearch` tests green.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/context/
git commit -m "feat(core): add WithSearch context, useSearchContext"
```

---

## Task 11: `SearchInput` component (TDD)

**Files:**
- Create: `packages/core/src/components/SearchInput.tsx`
- Create: `packages/core/src/components/SearchInput.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/components/SearchInput.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { WithSearch } from '../context/WithSearch'
import { useSearchContext } from '../context/useSearchContext'
import { SearchInput } from './SearchInput'

const QueryDisplay = () => {
  const { query } = useSearchContext()
  return <div data-testid="query">{query}</div>
}

describe('SearchInput', () => {
  it('renders a text input', () => {
    render(
      <WithSearch>
        <SearchInput />
      </WithSearch>
    )
    expect(screen.getByRole('textbox')).toBeDefined()
  })

  it('reflects query from context as its value', () => {
    render(
      <WithSearch>
        <SearchInput />
      </WithSearch>
    )
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('updates context query when user types', () => {
    render(
      <WithSearch>
        <SearchInput />
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(screen.getByTestId('query')).toHaveTextContent('hello')
  })

  it('forwards placeholder prop', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search here..." />
      </WithSearch>
    )
    expect(screen.getByPlaceholderText('Search here...')).toBeDefined()
  })

  it('forwards additional HTML input props', () => {
    render(
      <WithSearch>
        <SearchInput data-testid="my-input" />
      </WithSearch>
    )
    expect(screen.getByTestId('my-input')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module './SearchInput'`

- [ ] **Step 3: Implement `SearchInput`**

Create `packages/core/src/components/SearchInput.tsx`:

```tsx
import React from 'react'
import { useSearchContext } from '../context/useSearchContext'

type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

export function SearchInput({ placeholder, ...rest }: SearchInputProps) {
  const { query, setQuery } = useSearchContext()
  return (
    <input
      type="text"
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder={placeholder}
      {...rest}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: PASS — all `SearchInput` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/SearchInput.tsx packages/core/src/components/SearchInput.test.tsx
git commit -m "feat(core): add SearchInput component"
```

---

## Task 12: `HighlightedText` component (TDD)

**Files:**
- Create: `packages/core/src/components/HighlightedText.tsx`
- Create: `packages/core/src/components/HighlightedText.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/components/HighlightedText.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { HighlightedText } from './HighlightedText'
import { WithSearch } from '../context/WithSearch'
import { useSearchContext } from '../context/useSearchContext'

describe('HighlightedText', () => {
  it('renders plain text when patterns prop is empty', () => {
    const { container } = render(<HighlightedText text="hello world" patterns={[]} />)
    expect(container.querySelector('mark')).toBeNull()
    expect(screen.getByText('hello world')).toBeDefined()
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

  it('patterns prop overrides context patterns', () => {
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
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module './HighlightedText'`

- [ ] **Step 3: Implement `HighlightedText`**

Create `packages/core/src/components/HighlightedText.tsx`:

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
  text: string
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
  const patterns = propPatterns ?? ctx?.patterns ?? []

  const spans = getHighlightPositions(text, patterns, options)

  if (spans.length === 0) {
    return <span>{text}</span>
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

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: PASS — all `HighlightedText` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/HighlightedText.tsx packages/core/src/components/HighlightedText.test.tsx
git commit -m "feat(core): add HighlightedText component"
```

---

## Task 13: Core package public API

**Files:**
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/src/index.ts`**

```ts
// Logic (zero-dependency)
export type { SearchOptions, HighlightSpan } from './logic/types'
export { parseInput } from './logic/parseInput'
export { normalizeText } from './logic/normalizeText'
export { matchItem } from './logic/matchItem'
export { getHighlightPositions } from './logic/getHighlightPositions'

// React hooks
export { useSearch } from './hooks/useSearch'
export type { UseSearchResult } from './hooks/useSearch'

// Context
export { WithSearch } from './context/WithSearch'
export { useSearchContext } from './context/useSearchContext'
export type { SearchContextValue } from './context/SearchContext'

// Components
export { SearchInput } from './components/SearchInput'
export { HighlightedText } from './components/HighlightedText'
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm --filter @quaesitor-textus/core test -- --reporter=verbose
```

Expected: PASS — all tests green.

- [ ] **Step 3: Build the package**

```bash
pnpm --filter @quaesitor-textus/core build
```

Expected: `packages/core/dist/` created with `index.js`, `index.cjs`, `index.d.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): wire up public API in index.ts"
```

---

## Task 14: Storybook setup

**Files:**
- Create: `packages/core/.storybook/main.ts`
- Create: `packages/core/.storybook/preview.ts`

- [ ] **Step 1: Initialize Storybook**

```bash
cd packages/core && pnpm dlx storybook@latest init --type react --builder vite --skip-install --no-dev
```

This will create `.storybook/main.ts` and `.storybook/preview.ts`. If the generated files differ from the content below, overwrite them.

- [ ] **Step 2: Ensure `.storybook/main.ts` matches**

```ts
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
}

export default config
```

- [ ] **Step 3: Ensure `.storybook/preview.ts` matches**

```ts
import type { Preview } from '@storybook/react'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
```

- [ ] **Step 4: Create the stories directory**

```bash
mkdir -p packages/core/stories/data
```

- [ ] **Step 5: Verify Storybook starts**

```bash
pnpm --filter @quaesitor-textus/core storybook
```

Expected: Storybook dev server starts on `http://localhost:6006`. Stop it with Ctrl+C after confirming.

- [ ] **Step 6: Commit**

```bash
cd ../..
git add packages/core/.storybook/ packages/core/stories/
git commit -m "chore(core): add Storybook configuration"
```

---

## Task 15: `HighlightedText` stories

**Files:**
- Create: `packages/core/stories/HighlightedText.stories.tsx`

- [ ] **Step 1: Create `packages/core/stories/HighlightedText.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { HighlightedText } from '../src'

const meta: Meta<typeof HighlightedText> = {
  title: 'Core/HighlightedText',
  component: HighlightedText,
  args: {
    text: 'The quick brown fox jumps over the lazy dog',
  },
}

export default meta
type Story = StoryObj<typeof HighlightedText>

export const SingleMatch: Story = {
  args: { patterns: ['fox'] },
}

export const MultiplePatterns: Story = {
  args: { patterns: ['fox', 'dog'] },
}

export const OverlappingPatterns: Story = {
  args: {
    text: 'abcde',
    patterns: ['abc', 'bcd'],
  },
}

export const DiacriticInsensitive: Story = {
  args: {
    text: 'Héllo wörld, café au lait',
    patterns: ['hello', 'cafe'],
  },
}

export const NoMatch: Story = {
  args: { patterns: ['xyz'] },
}

export const EmptyPatterns: Story = {
  args: { patterns: [] },
}

export const CustomMarkStyle: Story = {
  args: {
    patterns: ['fox'],
    markStyle: {
      background: '#FF6B6B80',
      padding: '2px',
      margin: '-2px',
      borderRadius: '2px',
    },
  },
}
```

- [ ] **Step 2: Verify stories render in Storybook**

```bash
pnpm --filter @quaesitor-textus/core storybook
```

Open `http://localhost:6006` and confirm all `Core/HighlightedText` stories render without errors. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add packages/core/stories/HighlightedText.stories.tsx
git commit -m "docs(core): add HighlightedText stories"
```

---

## Task 16: `SearchInput` story

**Files:**
- Create: `packages/core/stories/SearchInput.stories.tsx`

- [ ] **Step 1: Create `packages/core/stories/SearchInput.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { WithSearch, SearchInput, HighlightedText, useSearchContext } from '../src'

const meta: Meta = {
  title: 'Core/SearchInput',
  decorators: [
    (Story) => (
      <WithSearch>
        <Story />
      </WithSearch>
    ),
  ],
}

export default meta

const SmallListDemo = () => {
  const { executeSearch, patterns } = useSearchContext()
  const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape']
  const filtered = executeSearch(items, item => item)
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 320 }}>
      <SearchInput placeholder="Filter fruits..." style={{ width: '100%', padding: '6px 8px', fontSize: 14 }} />
      <ul style={{ marginTop: 8, paddingLeft: 20 }}>
        {filtered.map(item => (
          <li key={item}>
            <HighlightedText text={item} patterns={patterns} />
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p style={{ color: '#999', fontStyle: 'italic' }}>No results</p>
      )}
    </div>
  )
}

export const Default: StoryObj = {
  render: () => <SmallListDemo />,
}
```

- [ ] **Step 2: Verify story renders in Storybook**

```bash
pnpm --filter @quaesitor-textus/core storybook
```

Open `http://localhost:6006`, navigate to `Core/SearchInput/Default`, type in the input, confirm filtering and highlighting work. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add packages/core/stories/SearchInput.stories.tsx
git commit -m "docs(core): add SearchInput story"
```

---

## Task 17: Full list demo story

**Files:**
- Create: `packages/core/stories/data/phrases.ts`
- Create: `packages/core/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Create `packages/core/stories/data/phrases.ts`**

```ts
export const phrases: string[] = [
  'apple pie recipe',
  'bicycle repair shop',
  'curious yellow duck',
  'dancing elephant parade',
  'evening sunset glow',
  'fresh morning coffee',
  'gentle ocean breeze',
  'happy little squirrel',
  'invisible ink message',
  'juggling fire torches',
  'knitting a warm sweater',
  'laughing hyena spotted',
  'magic carpet ride',
  'napping under the oak',
  'orange marmalade jar',
  'purple mountain majesty',
  'quick silver fox',
  'rainy day puddles',
  'silent library corner',
  'tiny frog on leaf',
  'umbrella in sunshine',
  'velvet underground sound',
  'walking through tall grass',
  'extra crispy fried chicken',
  'yellow submarine sandwich',
  'zigzag fence post',
  'baking sourdough bread',
  'catching fireflies at dusk',
  'deep sea treasure hunt',
  'elegant clockwork mechanism',
  'fluffy cloud formation',
  'growing tomatoes indoors',
  'hiking the mountain trail',
  'icy road conditions ahead',
  'jumping over the creek',
  'knotted fishing line',
  'lost in the forest',
  'morning dew on roses',
  'night owl reading lamp',
  'old wooden rocking chair',
  'painting the garden fence',
  'quiet thunderstorm passing',
  'rusty vintage bicycle',
  'sparkling clean windows',
  'tired but happy traveler',
  'unique snowflake pattern',
  'vintage record collection',
  'warm woolen mittens',
  'exploring ancient ruins',
  'frozen waterfall wonder',
  'golden autumn leaves',
  'hidden door in the wall',
  'intricate spider web',
  'jungle gym playground',
  'kettle drum performance',
  'long winding river',
  'mysterious foggy valley',
  'narrow cobblestone alley',
  'open field of sunflowers',
  'pebble skipping contest',
  'quietly humming bees',
  'red barn in summer',
  'salted caramel popcorn',
  'telescope stargazing night',
  'underground cave system',
  'violet twilight sky',
  'whistling wind chimes',
  'artisan bread loaf',
  'blueberry muffin recipe',
  'cherry blossom festival',
  'dark chocolate truffle',
  'espresso machine hissing',
  'fragrant lavender field',
  'glazed ceramic pot',
  'honeybee dance language',
  'iris flower arrangement',
  'jasmine tea ceremony',
  'kiwi fruit smoothie',
  'lemon zest tart',
  'mushroom risotto dish',
  'nutmeg spiced cider',
  'oatmeal cookie batch',
  'pumpkin spice latte',
  'raspberry sorbet scoop',
  'strawberry shortcake slice',
  'tangerine peel aroma',
  'udon noodle soup bowl',
  'vanilla bean pod',
  'walnut brownie bake',
  'yogurt parfait layers',
  'zucchini bread loaf',
  'almond butter toast',
  'brioche french toast',
  'creamy pasta carbonara',
  'dried mango slices',
  'elderflower lemonade',
  'fig and goat cheese',
  'grilled halloumi skewers',
  'hazelnut praline cake',
  'iced matcha latte',
  'jalapeño cornbread muffin',
]
```

- [ ] **Step 2: Create `packages/core/stories/FullListDemo.stories.tsx`**

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
  const { executeSearch, patterns } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo</h2>
      <SearchInput
        placeholder="Search phrases…"
        style={{ width: '100%', padding: '8px 10px', fontSize: 15, boxSizing: 'border-box' }}
        autoFocus
      />
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

- [ ] **Step 3: Verify story in Storybook**

```bash
pnpm --filter @quaesitor-textus/core storybook
```

Open `http://localhost:6006`, navigate to `Core/FullListDemo/Default`. Type terms like "apple", "bread", "ca le" (multi-word). Confirm: filtering works, highlights appear, result count updates. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add packages/core/stories/
git commit -m "docs(core): add FullListDemo story with 100 phrases"
```

---

## Task 18: `@quaesitor-textus/antd` package scaffold

**Files:**
- Create: `packages/antd/package.json`
- Create: `packages/antd/tsconfig.json`
- Create: `packages/antd/tsup.config.ts`
- Create: `packages/antd/vitest.config.ts`

- [ ] **Step 1: Create `packages/antd/package.json`**

```json
{
  "name": "@quaesitor-textus/antd",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.cjs",
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@quaesitor-textus/core": "workspace:*"
  },
  "peerDependencies": {
    "antd": ">=5",
    "react": ">=18"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "antd": "^5.0.0",
    "jsdom": "^24.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/antd/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/antd/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom', 'antd', '@quaesitor-textus/core'],
})
```

- [ ] **Step 4: Create `packages/antd/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 5: Create `packages/antd/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Install deps**

```bash
pnpm install
```

Expected: `packages/antd/node_modules/` populated, workspace link to `@quaesitor-textus/core` established.

- [ ] **Step 7: Commit**

```bash
git add packages/antd/
git commit -m "chore: add @quaesitor-textus/antd package scaffold"
```

---

## Task 19: `antd` `SearchInput` (TDD)

**Files:**
- Create: `packages/antd/src/components/SearchInput.tsx`
- Create: `packages/antd/src/components/SearchInput.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/antd/src/components/SearchInput.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { WithSearch, useSearchContext } from '@quaesitor-textus/core'
import { SearchInput } from './SearchInput'

const QueryDisplay = () => {
  const { query } = useSearchContext()
  return <div data-testid="query">{query}</div>
}

describe('antd SearchInput', () => {
  it('renders an input element', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
      </WithSearch>
    )
    expect(screen.getByPlaceholderText('Search...')).toBeDefined()
  })

  it('updates context query when user types', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
        <QueryDisplay />
      </WithSearch>
    )
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'apple' },
    })
    expect(screen.getByTestId('query')).toHaveTextContent('apple')
  })

  it('reflects context query as input value', () => {
    render(
      <WithSearch>
        <SearchInput placeholder="Search..." />
        <QueryDisplay />
      </WithSearch>
    )
    const input = screen.getByPlaceholderText('Search...')
    fireEvent.change(input, { target: { value: 'banana' } })
    expect(input).toHaveValue('banana')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @quaesitor-textus/antd test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module './SearchInput'`

- [ ] **Step 3: Implement antd `SearchInput`**

Create `packages/antd/src/components/SearchInput.tsx`:

```tsx
import React from 'react'
import { Input } from 'antd'
import type { InputProps } from 'antd'
import { useSearchContext } from '@quaesitor-textus/core'

export function SearchInput(props: Omit<InputProps, 'value' | 'onChange'>) {
  const { query, setQuery } = useSearchContext()
  return (
    <Input
      {...props}
      value={query}
      onChange={e => setQuery(e.target.value)}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @quaesitor-textus/antd test -- --reporter=verbose
```

Expected: PASS — all antd `SearchInput` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/antd/src/components/SearchInput.tsx packages/antd/src/components/SearchInput.test.tsx
git commit -m "feat(antd): add Ant Design SearchInput component"
```

---

## Task 20: `antd` public API

**Files:**
- Create: `packages/antd/src/index.ts`

- [ ] **Step 1: Create `packages/antd/src/index.ts`**

```ts
export { SearchInput } from './components/SearchInput'
```

- [ ] **Step 2: Build the antd package**

```bash
pnpm --filter @quaesitor-textus/antd build
```

Expected: `packages/antd/dist/` created with `index.js`, `index.cjs`, `index.d.ts`.

- [ ] **Step 3: Run full workspace test suite**

```bash
pnpm test
```

Expected: PASS — all tests across both packages green.

- [ ] **Step 4: Commit**

```bash
git add packages/antd/src/index.ts
git commit -m "feat(antd): wire up public API"
```

---

## Task 21: GitHub Actions — deploy Storybook to GitHub Pages

**Files:**
- Create: `.github/workflows/storybook.yml`

- [ ] **Step 1: Enable GitHub Pages in repo settings**

In the GitHub repository settings → Pages → Source: select **GitHub Actions**.

- [ ] **Step 2: Create `.github/workflows/storybook.yml`**

```yaml
name: Deploy Storybook to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Storybook
        run: pnpm --filter @quaesitor-textus/core build-storybook

      - uses: actions/upload-pages-artifact@v3
        with:
          path: packages/core/storybook-static

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/storybook.yml
git commit -m "ci: deploy Storybook to GitHub Pages on push to main"
git push origin main
```

- [ ] **Step 4: Verify deployment**

Open the repository's Actions tab on GitHub. Confirm the `Deploy Storybook to GitHub Pages` workflow runs and succeeds. The deployed URL will be shown in the workflow output and in repo Settings → Pages.

---

## Done

All tasks complete. The monorepo has:
- `@quaesitor-textus/core` — pure logic + React context API + headless components + Storybook demo
- `@quaesitor-textus/antd` — Ant Design `SearchInput` drop-in
- GitHub Actions deploying Storybook to GitHub Pages on every push to `main`
