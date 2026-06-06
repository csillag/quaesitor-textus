# `searches` prop on `WithSearch` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `searches` prop to `WithSearch` so one provider hosts any number of independent, uncontrolled named searches — giving a flat, stable React tree for a dynamic number of fields.

**Architecture:** Additive discriminated union on `WithSearchProps`. The new multi-search path keeps a single `useState<Record<name,string>>` (no per-item hooks → rules-of-hooks safe for dynamic N) and derives N `SearchEntry` objects via `useMemo`. A shared `deriveEntry` helper builds the `SearchEntry` shape for both the existing single-search path and the new multi path (single source of truth). Spec: `docs/superpowers/specs/2026-06-07-with-search-searches-prop-design.md`.

**Tech Stack:** TypeScript, React 18, Vitest + @testing-library/react, tsup. Package: `@quaesitor-textus/core`.

---

## Plan shape (parallel execution)

This plan is **parallel-shaped**. Tasks 1–5 are **file-disjoint** and run **concurrently**. There are **no per-task test runs** — all verification is deferred to **Task 6** (the final task). The tree may not compile mid-execution; that is expected and caught at the end.

File ownership (no file appears in two tasks):

| Task | Owns (create/modify) |
|------|----------------------|
| 1 | `packages/core/src/context/deriveEntry.ts`, `packages/core/src/context/deriveEntry.test.ts` |
| 2 | `packages/core/src/context/WithSearch.tsx` |
| 3 | `packages/core/src/context/WithSearch.searches.test.tsx` |
| 4 | `packages/core/src/index.ts` |
| 5 | `packages/core/stories/BookSearchDemo.stories.tsx` |
| 6 | (verification only — runs build + tests, may touch any file to fix small integration errors) |

## Pinned shared contracts

All concurrent tasks MUST conform to these exact shapes/strings so independently-written code and tests align.

**`SearchSpec` type** (defined & exported from `WithSearch.tsx`, Task 2; re-exported from `index.ts`, Task 4):

```ts
export interface SearchSpec {
  name?: string
  field?: string
  fields?: string[]
  options?: SearchOptions
}
```

**`deriveEntry` signature** (Task 1; consumed by Task 2):

```ts
export function deriveEntry(params: {
  query: string
  setQuery: (q: string) => void
  reset: () => void
  fields: string[]
  options?: SearchOptions
}): SearchEntry
```

**Name resolution per spec:** `name ?? (field !== undefined ? field : (fields ?? ['$']).join('+'))`.
**Default fields per spec:** `field !== undefined ? [field] : (fields ?? ['$'])`.
**Options merge per spec:** `{ ...withSearchLevelOptions, ...spec.options }`.

**Exact error strings (asserted by tests):**
- Spec with both field and fields: `WithSearch: a search spec cannot specify both \`field\` and \`fields\`.`
- Duplicate name within `searches`: `WithSearch: duplicate name "<name>" in searches.`
- Duplicate name vs upstream map (existing string, unchanged): `WithSearch: duplicate name "<name>". Each WithSearch in the same tree must have a unique name.`
- `searches` combined with single-search/controlled props: `WithSearch: cannot combine \`searches\` with \`field\`, \`fields\`, or controlled props.`

---

## Task 1: `deriveEntry` shared helper

**Files:**
- Create: `packages/core/src/context/deriveEntry.ts`
- Test: `packages/core/src/context/deriveEntry.test.ts`

- [ ] **Step 1: Write the helper**

Create `packages/core/src/context/deriveEntry.ts`:

```ts
import { parseInput } from '../logic/parseInput'
import type { SearchOptions } from '../logic/types'
import type { SearchEntry } from './SearchContext'

/**
 * Build a SearchEntry from a query plus its wiring. Single source of truth for
 * pattern derivation and entry shape, shared by the single-search and
 * multi-search (`searches`) paths of WithSearch.
 */
export function deriveEntry(params: {
  query: string
  setQuery: (q: string) => void
  reset: () => void
  fields: string[]
  options?: SearchOptions
}): SearchEntry {
  const { query, setQuery, reset, fields, options } = params
  const patterns = parseInput(query, options ?? {})
  return {
    query,
    setQuery,
    patterns,
    hasPatterns: patterns.length > 0,
    reset,
    fields,
    options,
  }
}
```

- [ ] **Step 2: Write the test**

Create `packages/core/src/context/deriveEntry.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { deriveEntry } from './deriveEntry'

describe('deriveEntry', () => {
  it('derives patterns from the query and reports hasPatterns', () => {
    const entry = deriveEntry({
      query: 'war peace',
      setQuery: () => {},
      reset: () => {},
      fields: ['title'],
    })
    expect(entry.patterns).toEqual(['war', 'peace'])
    expect(entry.hasPatterns).toBe(true)
    expect(entry.fields).toEqual(['title'])
  })

  it('produces no patterns and hasPatterns=false for a sub-minLength query', () => {
    const entry = deriveEntry({
      query: 'a',
      setQuery: () => {},
      reset: () => {},
      fields: ['$'],
    })
    expect(entry.patterns).toEqual([])
    expect(entry.hasPatterns).toBe(false)
  })

  it('passes options through to parseInput (minLength override)', () => {
    const entry = deriveEntry({
      query: 'a',
      setQuery: () => {},
      reset: () => {},
      fields: ['$'],
      options: { minLength: 1 },
    })
    expect(entry.patterns).toEqual(['a'])
    expect(entry.hasPatterns).toBe(true)
    expect(entry.options).toEqual({ minLength: 1 })
  })

  it('wires setQuery and reset straight through', () => {
    const setQuery = vi.fn()
    const reset = vi.fn()
    const entry = deriveEntry({ query: '', setQuery, reset, fields: ['$'] })
    entry.setQuery('x')
    entry.reset()
    expect(setQuery).toHaveBeenCalledWith('x')
    expect(reset).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/context/deriveEntry.ts packages/core/src/context/deriveEntry.test.ts
git commit -m "feat(core): deriveEntry helper for SearchEntry shape"
```

---

## Task 2: `WithSearch` — add `searches` prop, multi path, guard, route single path through `deriveEntry`

**Files:**
- Modify (full rewrite): `packages/core/src/context/WithSearch.tsx`

This task fully replaces the file. The single-search behavior is preserved (controlled + uncontrolled, name/field/fields defaults, duplicate-name-vs-upstream check) but its entry is now built via `deriveEntry`. The new `searches` path is added.

- [ ] **Step 1: Rewrite `WithSearch.tsx`**

Replace the entire contents of `packages/core/src/context/WithSearch.tsx` with:

```tsx
import React, { useContext, useMemo, useState, useCallback } from 'react'
import { SearchContext } from './SearchContext'
import type { SearchEntry, SearchContextValue } from './SearchContext'
import type { SearchOptions } from '../logic/types'
import { useSearchInternalState } from '../hooks/useSearchInternalState'
import { deriveEntry } from './deriveEntry'

export interface SearchSpec {
  name?: string
  field?: string
  fields?: string[]
  options?: SearchOptions
}

type WithSearchBaseProps = {
  options?: SearchOptions
  children: React.ReactNode
}

type SingleSearchProps = WithSearchBaseProps & {
  name?: string
  query?: string
  onSetQuery?: (q: string) => void
  onReset?: () => void
  onChange?: (oldValue: string, newValue: string) => void
  searches?: never
} & (
  | { field?: never; fields?: never }
  | { field: string; fields?: never }
  | { fields: string[]; field?: never }
)

type MultiSearchProps = WithSearchBaseProps & {
  searches: SearchSpec[]
  name?: never
  field?: never
  fields?: never
  query?: never
  onSetQuery?: never
  onReset?: never
  onChange?: never
}

export type WithSearchProps = SingleSearchProps | MultiSearchProps

function resolveSpecFields(field?: string, fields?: string[]): string[] {
  return field !== undefined ? [field] : (fields ?? ['$'])
}

export function WithSearch(props: WithSearchProps) {
  const { options, children } = props
  const searches = (props as MultiSearchProps).searches
  const isMulti = searches !== undefined

  // Single-search props (undefined in multi mode — harmless).
  const single = props as SingleSearchProps

  // Hooks are always called unconditionally (rules of hooks). The single-search
  // internal state is unused in multi mode; the multi query map is unused in
  // single mode.
  const singleState = useSearchInternalState({
    options,
    query: single.query,
    onSetQuery: single.onSetQuery,
    onReset: single.onReset,
    onChange: single.onChange,
  })

  const [queryMap, setQueryMap] = useState<Record<string, string>>({})

  const setQueryFor = useCallback(
    (name: string, value: string) =>
      setQueryMap(m => ({ ...m, [name]: value })),
    []
  )

  const upstreamMap = useContext(SearchContext)

  // --- Single-search entry (existing behavior, now via deriveEntry) ---
  const singleEntry: SearchEntry = useMemo(() => {
    if (single.field !== undefined && single.fields !== undefined) {
      throw new Error('WithSearch: cannot specify both `field` and `fields`.')
    }
    return deriveEntry({
      query: singleState.query,
      setQuery: singleState.setQuery,
      reset: singleState.reset,
      fields: resolveSpecFields(single.field, single.fields),
      options,
    })
  }, [singleState.query, singleState.setQuery, singleState.reset, single.field, single.fields, options])

  const singleName = single.name ?? resolveSpecFields(single.field, single.fields).join('+')

  // --- Multi-search entries (new) ---
  const multiEntries: SearchContextValue = useMemo(() => {
    const result: SearchContextValue = {}
    if (!isMulti) return result
    for (const spec of searches!) {
      if (spec.field !== undefined && spec.fields !== undefined) {
        throw new Error('WithSearch: a search spec cannot specify both `field` and `fields`.')
      }
      const specFields = resolveSpecFields(spec.field, spec.fields)
      const name = spec.name ?? specFields.join('+')
      if (name in result) {
        throw new Error(`WithSearch: duplicate name "${name}" in searches.`)
      }
      const query = queryMap[name] ?? ''
      result[name] = deriveEntry({
        query,
        setQuery: (q: string) => setQueryFor(name, q),
        reset: () => setQueryFor(name, ''),
        fields: specFields,
        options: { ...options, ...spec.options },
      })
    }
    return result
  }, [isMulti, searches, queryMap, options, setQueryFor])

  // --- Runtime guard for JS callers (TS union already forbids this) ---
  if (isMulti) {
    if (
      single.field !== undefined ||
      single.fields !== undefined ||
      single.name !== undefined ||
      single.query !== undefined ||
      single.onSetQuery !== undefined ||
      single.onReset !== undefined ||
      single.onChange !== undefined
    ) {
      throw new Error(
        'WithSearch: cannot combine `searches` with `field`, `fields`, or controlled props.'
      )
    }
  }

  const value = useMemo(() => {
    const additions = isMulti ? multiEntries : { [singleName]: singleEntry }
    const merged: SearchContextValue = { ...upstreamMap }
    for (const [k, v] of Object.entries(additions)) {
      if (k in merged) {
        throw new Error(
          `WithSearch: duplicate name "${k}". Each WithSearch in the same tree must have a unique name.`
        )
      }
      merged[k] = v
    }
    return merged
  }, [upstreamMap, isMulti, multiEntries, singleName, singleEntry])

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/context/WithSearch.tsx
git commit -m "feat(core): searches prop on WithSearch for parallel searches"
```

---

## Task 3: Multi-search behavior tests

**Files:**
- Create: `packages/core/src/context/WithSearch.searches.test.tsx`

These tests assert the new behavior using only the public `WithSearch` + `useSearchContext` + `SearchContext` API and the pinned error strings.

- [ ] **Step 1: Write the test file**

Create `packages/core/src/context/WithSearch.searches.test.tsx`:

```tsx
import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WithSearch } from './WithSearch'
import { useSearchContext } from './useSearchContext'
import { SearchContext } from './SearchContext'

const QueryBox = ({ name }: { name: string }) => {
  const { query, setQuery, patterns } = useSearchContext(name)
  return (
    <div>
      <input
        data-testid={`input-${name}`}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div data-testid={`patterns-${name}`}>{patterns.join(',')}</div>
    </div>
  )
}

const MapKeys = () => {
  const map = React.useContext(SearchContext)
  return <div data-testid="map-keys">{Object.keys(map).sort().join(',')}</div>
}

describe('WithSearch searches prop', () => {
  it('creates one entry per spec, keyed by name', () => {
    render(
      <WithSearch searches={[{ name: 'author', field: 'author' }, { name: 'title', field: 'title' }]}>
        <MapKeys />
      </WithSearch>
    )
    expect(screen.getByTestId('map-keys')).toHaveTextContent('author,title')
  })

  it('runs the searches independently', () => {
    render(
      <WithSearch searches={[{ name: 'author', field: 'author' }, { name: 'title', field: 'title' }]}>
        <QueryBox name="author" />
        <QueryBox name="title" />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input-author'), { target: { value: 'tolstoy' } })
    expect(screen.getByTestId('patterns-author')).toHaveTextContent('tolstoy')
    expect(screen.getByTestId('patterns-title')).toHaveTextContent('')
    fireEvent.change(screen.getByTestId('input-title'), { target: { value: 'war' } })
    expect(screen.getByTestId('patterns-title')).toHaveTextContent('war')
    expect(screen.getByTestId('patterns-author')).toHaveTextContent('tolstoy')
  })

  it('defaults a spec name to its field, and to joined fields', () => {
    render(
      <WithSearch searches={[{ field: 'author' }, { fields: ['title', 'subtitle'] }]}>
        <MapKeys />
      </WithSearch>
    )
    expect(screen.getByTestId('map-keys')).toHaveTextContent('author,title+subtitle')
  })

  it('merges per-search options over WithSearch-level options', () => {
    // WithSearch-level minLength=5 would drop "ab"; per-search minLength=1 keeps it.
    render(
      <WithSearch options={{ minLength: 5 }} searches={[{ name: 'a', field: 'a', options: { minLength: 1 } }]}>
        <QueryBox name="a" />
      </WithSearch>
    )
    fireEvent.change(screen.getByTestId('input-a'), { target: { value: 'ab' } })
    expect(screen.getByTestId('patterns-a')).toHaveTextContent('ab')
  })

  it('does not remount children and preserves queries when the spec count grows', () => {
    let authorMounts = 0
    const MountCountedAuthor = () => {
      React.useEffect(() => {
        authorMounts += 1
      }, [])
      return <QueryBox name="author" />
    }

    const Harness = () => {
      const [specs, setSpecs] = useState([
        { name: 'author', field: 'author' },
        { name: 'title', field: 'title' },
      ])
      return (
        <WithSearch searches={specs}>
          <MountCountedAuthor />
          <button
            data-testid="add"
            onClick={() => setSpecs(s => [...s, { name: 'year', field: 'year' }])}
          >
            add
          </button>
          <MapKeys />
        </WithSearch>
      )
    }

    render(<Harness />)
    fireEvent.change(screen.getByTestId('input-author'), { target: { value: 'tolstoy' } })
    expect(authorMounts).toBe(1)

    fireEvent.click(screen.getByTestId('add'))

    // New entry present, the existing author input did not remount, query preserved.
    expect(screen.getByTestId('map-keys')).toHaveTextContent('author,title,year')
    expect(authorMounts).toBe(1)
    expect(screen.getByTestId('input-author')).toHaveValue('tolstoy')
  })

  it('renders with an empty searches array (no entries)', () => {
    render(
      <WithSearch searches={[]}>
        <MapKeys />
      </WithSearch>
    )
    expect(screen.getByTestId('map-keys')).toHaveTextContent('')
  })

  it('throws on a duplicate name within searches', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <WithSearch searches={[{ name: 'dup', field: 'a' }, { name: 'dup', field: 'b' }]}>
          <div />
        </WithSearch>
      )
    ).toThrow('WithSearch: duplicate name "dup" in searches.')
    spy.mockRestore()
  })

  it('throws when a spec sets both field and fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <WithSearch searches={[{ field: 'a', fields: ['a', 'b'] } as any]}>
          <div />
        </WithSearch>
      )
    ).toThrow('WithSearch: a search spec cannot specify both `field` and `fields`.')
    spy.mockRestore()
  })

  it('throws when searches is combined with field/fields/controlled props', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <WithSearch {...({ searches: [{ field: 'a' }], field: 'b' } as any)}>
          <div />
        </WithSearch>
      )
    ).toThrow('WithSearch: cannot combine `searches` with `field`, `fields`, or controlled props.')
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/context/WithSearch.searches.test.tsx
git commit -m "test(core): multi-search WithSearch behavior"
```

---

## Task 4: Export `SearchSpec` from the package index

**Files:**
- Modify: `packages/core/src/index.ts:23`

- [ ] **Step 1: Add the type export**

In `packages/core/src/index.ts`, the line currently reads:

```ts
export type { WithSearchProps } from './context/WithSearch'
```

Replace it with:

```ts
export type { WithSearchProps, SearchSpec } from './context/WithSearch'
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export SearchSpec type"
```

---

## Task 5: Refactor the core Book demo to a single `WithSearch`

**Files:**
- Modify: `packages/core/stories/BookSearchDemo.stories.tsx:52-99`

Demonstrates the new API: the two nested `WithSearch` wrappers collapse to one with a `searches` array. `BookList` and the rest are unchanged (they already read `useSearchContext('author')` / `('title')`).

- [ ] **Step 1: Replace the `BookSearchWrapper` component**

In `packages/core/stories/BookSearchDemo.stories.tsx`, replace the entire `BookSearchWrapper` definition (the `const BookSearchWrapper = () => { ... }` block) with:

```tsx
const SEARCHES = [
  { name: 'author', field: 'author' },
  { name: 'title', field: 'title' },
]

const BookSearchWrapper = () => {
  const [mode, setMode] = useState<'AND' | 'OR'>('AND')

  return (
    <WithSearch searches={SEARCHES}>
      <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 640 }}>
        <h2 style={{ marginTop: 0 }}>Classical Book Search</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <SearchInput
            name="author"
            placeholder="Search for author"
            style={{ flex: 1, padding: '6px 10px', fontSize: 14, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="radio"
                name="mode"
                value="AND"
                checked={mode === 'AND'}
                onChange={() => setMode('AND')}
              />
              AND
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="radio"
                name="mode"
                value="OR"
                checked={mode === 'OR'}
                onChange={() => setMode('OR')}
              />
              OR
            </label>
          </div>
          <SearchInput
            name="title"
            placeholder="Search for title"
            style={{ flex: 1, padding: '6px 10px', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
        <BookList mode={mode} />
      </div>
    </WithSearch>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/stories/BookSearchDemo.stories.tsx
git commit -m "docs(core): book demo uses single WithSearch with searches"
```

---

## Task 6: Verification (final, sequential — runs after Tasks 1–5 land)

**Files:** none owned; may edit any file from Tasks 1–5 to fix small integration errors surfaced here.

This is the single deferred-verification task. Do not run it until Tasks 1–5 are merged.

- [ ] **Step 1: Type-check + build core**

Run: `pnpm --filter @quaesitor-textus/core build`
Expected: tsup/DTS build succeeds with no TypeScript errors. (This validates the `WithSearchProps` union and `SearchSpec` export compile.)

- [ ] **Step 2: Run the full core test suite**

Run: `pnpm --filter @quaesitor-textus/core test`
Expected: all suites pass — existing `WithSearch.test.tsx` (unchanged single-search behavior), new `WithSearch.searches.test.tsx`, `deriveEntry.test.ts`, and all prior core tests. Test count = previous 167 + new (deriveEntry 4 + searches 9).

- [ ] **Step 3: Fix any integration errors**

If build or tests fail, fix the offending file (most likely a mismatch between the `deriveEntry` signature in Task 1 and its use in Task 2, or an error-string typo vs Task 3). Re-run Steps 1–2 until green.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(core): integration fixes for searches prop"
```

(Skip if Steps 1–2 passed with no edits.)

---

## Release (after Task 6 is green)

Not part of execution; do when ready. New feature → minor bump. Use the fixed Makefile target:

```bash
make publish-minor-version   # bumps core/antd/mongo to 0.4.0, commits, publishes, tags, pushes
```

Note: npm may need its cache pointed off the full `/mnt/docker-data` disk — see memory `project_shared_docker_disk_near_full` for the `npm_config_cache=…` workaround.

---

## Self-review

**Spec coverage:**
- Public API (`SearchSpec`, `searches` prop, union) → Tasks 2, 4.
- One entry per spec, name/fields defaults, options merge, duplicate-name (array + upstream), composes with nesting → Task 2; asserted in Task 3.
- One-state-map / no per-item hooks / stable tree → Task 2; stability asserted in Task 3 (remount test).
- Shared `deriveEntry` (no duplication), single path routed through it → Tasks 1, 2.
- Runtime guard for combining props → Task 2; asserted Task 3.
- Edge cases (empty array, neither field/fields → `['$']`, dup name, combine guard) → Tasks 2/3.
- Backward compatibility → existing `WithSearch.test.tsx` left untouched, verified green in Task 6.
- Release as v0.4.0 → Release section.
- Out of scope (controlled-multi, Approach 3) → not present. ✓

**Placeholder scan:** none — every code/test step shows full content; the only "similar/analogous" reference (antd demo) was deliberately excluded from scope.

**Type/string consistency:** `deriveEntry` signature identical in Tasks 1 and 2; `SearchSpec` identical in contracts/Tasks 2/4; error strings identical between Task 2 (thrown) and Task 3 (asserted).
