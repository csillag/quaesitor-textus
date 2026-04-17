# Smart Name Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate boilerplate by auto-deriving `WithSearch` names from field paths and making `useSearchContext`, `SearchInput`, and `HighlightedText` automatically use the single active search when no name is given.

**Architecture:** Three coordinated changes: (1) `useSearchContext` gets a smart single-entry lookup when called without a name; (2) `WithSearch` derives its name from `resolvedFields.join('+')` instead of hardcoding `"default search"`; (3) `useResolvedPatterns` (used by both `HighlightedText` and `HighlightedTrimmedText`) auto-picks the single active search when neither `searchNames` nor `all` is provided. Tasks are ordered so each leaves tests green: smart lookup first, then name auto-derivation (which relies on the lookup), then cleanup.

**Tech Stack:** React 18, TypeScript, Vitest, `@testing-library/react`, pnpm workspaces.

---

## File Map

| File | Change |
|------|--------|
| `packages/core/src/context/useSearchContext.ts` | Smart single-entry lookup when `name` is `undefined` |
| `packages/core/src/context/WithSearch.tsx` | `name` defaults to `resolvedFields.join('+')` |
| `packages/core/src/components/SearchInput.tsx` | Remove hardcoded default name |
| `packages/core/src/context/useResolvedPatterns.ts` | Auto-pick single entry when no `searchNames`/`all` |
| `packages/antd/src/components/SearchInput.tsx` | Remove hardcoded default name |
| `packages/core/src/context/SearchContext.ts` | Remove `DEFAULT_SEARCH_NAME` constant |
| `packages/core/src/index.ts` | Remove `DEFAULT_SEARCH_NAME` re-export |
| `packages/core/src/context/WithSearch.test.tsx` | Update stale `"default search"` references, add name-derivation tests |
| `packages/core/src/components/HighlightedText.test.tsx` | Update auto-pick test, add regression test |
| `packages/core/src/components/SearchInput.test.tsx` | Add test for multi-search ambiguity error |
| `packages/core/README.md` | Update examples and API tables |
| `packages/antd/README.md` | Update examples and API table |

---

### Task 1: `useSearchContext` — smart single-entry lookup

**Files:**
- Modify: `packages/core/src/context/useSearchContext.ts`
- Modify: `packages/core/src/context/WithSearch.test.tsx`

- [ ] **Step 1: Write three failing tests**

Add these three tests inside the `describe('WithSearch + useSearchContext', ...)` block in `packages/core/src/context/WithSearch.test.tsx`:

```typescript
it('useSearchContext with no name finds the single entry regardless of its name', () => {
  render(
    <WithSearch name="author">
      <QueryDisplay />
    </WithSearch>
  )
  expect(screen.getByTestId('input')).toHaveValue('')
})

it('useSearchContext with no name throws when context is empty', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() =>
    render(<QueryDisplay />)
  ).toThrow('useSearchContext: no WithSearch found in the tree')
  spy.mockRestore()
})

it('useSearchContext with no name throws when multiple searches are active', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() =>
    render(
      <WithSearch name="author">
        <WithSearch name="title">
          <QueryDisplay />
        </WithSearch>
      </WithSearch>
    )
  ).toThrow('useSearchContext: found 2 searches in context')
  spy.mockRestore()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/csillag/deai/quaesitor-textus
pnpm --filter @quaesitor-textus/core test -- --run src/context/WithSearch.test.tsx
```

Expected: the three new tests FAIL. All others pass.

- [ ] **Step 3: Implement smart lookup**

Replace `packages/core/src/context/useSearchContext.ts` entirely:

```typescript
import { useContext } from 'react'
import { SearchContext } from './SearchContext'

export function useSearchContext(name?: string) {
  const map = useContext(SearchContext)

  if (name === undefined) {
    const entries = Object.values(map)
    if (entries.length === 1) {
      const entry = entries[0]
      return {
        query: entry.query,
        setQuery: entry.setQuery,
        patterns: entry.patterns,
        hasPatterns: entry.hasPatterns,
        reset: entry.reset,
      }
    }
    if (entries.length === 0) {
      throw new Error('useSearchContext: no WithSearch found in the tree.')
    }
    throw new Error(
      `useSearchContext: found ${entries.length} searches in context; pass a name to select one.`
    )
  }

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @quaesitor-textus/core test -- --run src/context/WithSearch.test.tsx
```

Expected: all tests in that file pass.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test --run
```

Expected: all 142 + 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/context/useSearchContext.ts packages/core/src/context/WithSearch.test.tsx
git commit -m "feat(core): smart single-entry lookup in useSearchContext"
```

---

### Task 2: `WithSearch` — name auto-derivation

**Files:**
- Modify: `packages/core/src/context/WithSearch.tsx`
- Modify: `packages/core/src/context/WithSearch.test.tsx`
- Modify: `packages/core/src/components/HighlightedText.test.tsx`

- [ ] **Step 1: Write failing tests and update stale ones**

In `packages/core/src/context/WithSearch.test.tsx`:

**Replace** the existing test `'defaults name to "default search"'` (it currently uses `'default search'` as expected value):

```typescript
it('defaults name to "$" when no field or fields given', () => {
  render(<WithSearch><MapKeys /></WithSearch>)
  expect(screen.getByTestId('map-keys')).toHaveTextContent('$')
})

it('defaults name to field value when field is given', () => {
  render(<WithSearch field="author"><MapKeys /></WithSearch>)
  expect(screen.getByTestId('map-keys')).toHaveTextContent('author')
})

it('defaults name to joined fields when fields is given', () => {
  render(<WithSearch fields={['title', 'author']}><MapKeys /></WithSearch>)
  expect(screen.getByTestId('map-keys')).toHaveTextContent('title+author')
})
```

**Update** the three `FieldsCheck` tests that access `map['default search']` directly. In each case, change the accessed key to match the auto-derived name:

1. `stores fields in the context entry` — uses `<WithSearch fields={['author', 'title']}>`:
   Change `const entry = map['default search']` to `const entry = map['author+title']`

2. `field prop is stored as a single-element array` — uses `<WithSearch field="name">`:
   Change `const entry = map['default search']` to `const entry = map['name']`

3. `defaults fields to ["$"] when neither field nor fields is provided` — uses `<WithSearch>`:
   Change `const entry = map['default search']` to `const entry = map['$']`

In `packages/core/src/components/HighlightedText.test.tsx`:

**Update** the test `'highlights from context when searchNames matches the WithSearch name'`. The `WithSearch` in that test has no `name` prop so after Task 2 it will be named `"$"` instead of `"default search"`:

```typescript
it('highlights from context when searchNames matches the WithSearch name', async () => {
  const Setter = () => {
    const { setQuery } = useSearchContext()
    React.useEffect(() => { setQuery('hello') }, [setQuery])
    return null
  }
  const { container } = render(
    <WithSearch>
      <Setter />
      <HighlightedText text="hello world" searchNames="$" />
    </WithSearch>
  )
  await act(async () => {})
  expect(container.querySelector('mark')?.textContent).toBe('hello')
})
```

- [ ] **Step 2: Run tests to verify the new/updated tests fail**

```bash
pnpm --filter @quaesitor-textus/core test -- --run src/context/WithSearch.test.tsx
pnpm --filter @quaesitor-textus/core test -- --run src/components/HighlightedText.test.tsx
```

Expected: the newly added/updated tests fail; others pass.

- [ ] **Step 3: Implement name auto-derivation**

Replace `packages/core/src/context/WithSearch.tsx` entirely:

```typescript
import React, { useContext, useMemo } from 'react'
import { SearchContext } from './SearchContext'
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
  name: nameProp,
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

  const resolvedFields = field !== undefined ? [field] : (fields ?? ['$'])
  const name = nameProp ?? resolvedFields.join('+')

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @quaesitor-textus/core test -- --run src/context/WithSearch.test.tsx
pnpm --filter @quaesitor-textus/core test -- --run src/components/HighlightedText.test.tsx
```

Expected: all tests in both files pass.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/context/WithSearch.tsx \
        packages/core/src/context/WithSearch.test.tsx \
        packages/core/src/components/HighlightedText.test.tsx
git commit -m "feat(core): auto-derive WithSearch name from field paths"
```

---

### Task 3: `SearchInput` (core) — remove hardcoded default name

**Files:**
- Modify: `packages/core/src/components/SearchInput.tsx`
- Modify: `packages/core/src/components/SearchInput.test.tsx`

- [ ] **Step 1: Write a failing test**

Add to `packages/core/src/components/SearchInput.test.tsx`:

```typescript
it('throws when used without name inside 2 nested WithSearch contexts', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() =>
    render(
      <WithSearch name="author">
        <WithSearch name="title">
          <SearchInput />
        </WithSearch>
      </WithSearch>
    )
  ).toThrow('useSearchContext: found 2 searches in context')
  spy.mockRestore()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @quaesitor-textus/core test -- --run src/components/SearchInput.test.tsx
```

Expected: new test FAILS (current code throws "no WithSearch with name 'default search' found", not "found 2 searches"). All other tests pass.

- [ ] **Step 3: Remove the default name**

Replace `packages/core/src/components/SearchInput.tsx` entirely:

```typescript
import React from 'react'
import { useSearchContext } from '../context/useSearchContext'

type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  name?: string
}

export function SearchInput({ name, style, ...props }: SearchInputProps) {
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @quaesitor-textus/core test -- --run src/components/SearchInput.test.tsx
```

Expected: all 9 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/SearchInput.tsx \
        packages/core/src/components/SearchInput.test.tsx
git commit -m "feat(core): SearchInput uses smart lookup when name omitted"
```

---

### Task 4: `useResolvedPatterns` — auto-pick single context entry

**Files:**
- Modify: `packages/core/src/context/useResolvedPatterns.ts`
- Modify: `packages/core/src/components/HighlightedText.test.tsx`

- [ ] **Step 1: Write failing test and add regression test**

In `packages/core/src/components/HighlightedText.test.tsx`:

**Replace** the existing test `'shows no highlights when neither searchNames nor all is given'` with:

```typescript
it('auto-picks single context entry patterns when no searchNames or all given', async () => {
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
  await act(async () => {})
  expect(container.querySelector('mark')?.textContent).toBe('hello')
})
```

**Add** a regression test after it:

```typescript
it('shows no context highlights when 2 searches are active and no searchNames or all given', async () => {
  const Setter = () => {
    const { setQuery } = useSearchContext('search1')
    React.useEffect(() => { setQuery('hello') }, [setQuery])
    return null
  }
  const { container } = render(
    <WithSearch name="search1">
      <WithSearch name="search2">
        <Setter />
        <HighlightedText text="hello world" />
      </WithSearch>
    </WithSearch>
  )
  await act(async () => {})
  expect(container.querySelector('mark')).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify the auto-pick test fails**

```bash
pnpm --filter @quaesitor-textus/core test -- --run src/components/HighlightedText.test.tsx
```

Expected: `'auto-picks single context entry...'` FAILS. `'shows no context highlights when 2 searches...'` passes. All other tests pass.

- [ ] **Step 3: Implement auto-pick in `useResolvedPatterns`**

Replace `packages/core/src/context/useResolvedPatterns.ts` entirely:

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
    } else {
      const entries = Object.values(map)
      if (entries.length === 1) {
        contextPatterns.push(...entries[0].patterns)
      }
    }

    return [...new Set([...contextPatterns, ...(localPatterns ?? [])])]
  }, [map, searchNames, all, localPatterns])
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @quaesitor-textus/core test -- --run src/components/HighlightedText.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/context/useResolvedPatterns.ts \
        packages/core/src/components/HighlightedText.test.tsx
git commit -m "feat(core): HighlightedText auto-picks single context entry when no searchNames/all"
```

---

### Task 5: `SearchInput` (antd) — remove hardcoded default name

**Files:**
- Modify: `packages/antd/src/components/SearchInput.tsx`

No new tests needed — the antd package's only test is for a different component, and the behavioral change is covered by core's tests.

- [ ] **Step 1: Remove the default name**

Edit `packages/antd/src/components/SearchInput.tsx`. Remove the `DEFAULT_SEARCH_NAME` import and change the destructuring:

```typescript
import React from 'react'
import { Input } from 'antd'
import type { InputProps } from 'antd'
import { useSearchContext } from '@quaesitor-textus/core'

interface SearchInputProps extends Omit<InputProps, 'value' | 'onChange' | 'suffix'> {
  name?: string
}

export function SearchInput({ name, ...props }: SearchInputProps) {
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

- [ ] **Step 2: Run tests**

```bash
pnpm test --run
```

Expected: all tests pass (no regressions in antd package).

- [ ] **Step 3: Commit**

```bash
git add packages/antd/src/components/SearchInput.tsx
git commit -m "feat(antd): SearchInput uses smart lookup when name omitted"
```

---

### Task 6: Remove `DEFAULT_SEARCH_NAME`

**Files:**
- Modify: `packages/core/src/context/SearchContext.ts`
- Modify: `packages/core/src/index.ts`

At this point `DEFAULT_SEARCH_NAME` is unused in all consuming files. Removing it is a breaking change to the public API (it was exported from the package index), which is intentional — the string has no meaning anymore.

- [ ] **Step 1: Remove the constant from `SearchContext.ts`**

Replace `packages/core/src/context/SearchContext.ts` entirely:

```typescript
import { createContext } from 'react'
import type { SearchOptions } from '../logic/types'

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

- [ ] **Step 2: Remove the re-export from `index.ts`**

In `packages/core/src/index.ts`, delete the line:

```
export { DEFAULT_SEARCH_NAME } from './context/SearchContext'
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/context/SearchContext.ts packages/core/src/index.ts
git commit -m "feat(core)!: remove DEFAULT_SEARCH_NAME — names auto-derived from field paths"
```

---

### Task 7: README updates

**Files:**
- Modify: `packages/core/README.md`
- Modify: `packages/antd/README.md`

- [ ] **Step 1: Update `packages/core/README.md`**

**Basic usage example** — in `FilteredList`, change:
```tsx
<HighlightedText text={item} all />
```
to:
```tsx
<HighlightedText text={item} />
```

**Multi-field search example** — change:
```tsx
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
to:
```tsx
export const App = () => (
  <WithSearch field="author">
    <WithSearch field="title">
      <SearchInput name="author" placeholder="Search author…" />
      <SearchInput name="title" placeholder="Search title…" />
      <BookList />
    </WithSearch>
  </WithSearch>
)
```

**`<WithSearch>` API table** — change the `name` row:

| Before | After |
|--------|-------|
| `"default search"` | derived from `field`/`fields`: `"author"`, `"title+year"`, `"$"` |

Full updated row:
```
| `name` | `string` | derived from `field`/`fields` (e.g. `"author"`, `"title+year"`, `"$"`) | Name of this search entry in the context map. Must be unique within the tree. |
```

**`useSearchContext(name?)` section** — update the description to document smart behavior. Change the existing prose to:

```
Looks up the named entry in the context map. When `name` is omitted: if exactly one `WithSearch` is active, returns it; if zero or more than one, throws. Throws if the named entry is not found.
```

**`<HighlightedText>` section** — remove the trailing note:

```
At least one of `searchNames`, `all`, or `patterns` must be supplied to see highlights.
```

Replace with:

```
When none of `searchNames`, `all`, or `patterns` is given, highlights from the single active search automatically (no-op when zero or multiple searches are active).
```

- [ ] **Step 2: Update `packages/antd/README.md`**

**Basic usage example** — change:
```tsx
<HighlightedText text={item} all />
```
to:
```tsx
<HighlightedText text={item} />
```

**Multi-field search example** — change:
```tsx
export const App = () => (
  <WithSearch name="author" field="author">
    <WithSearch name="title" field="title">
```
to:
```tsx
export const App = () => (
  <WithSearch field="author">
    <WithSearch field="title">
```

**`<SearchInput>` props table** — change the `name` row default:

```
| `name` | `string` | auto (single search) or required when multiple | Name of the `WithSearch` entry this input controls. |
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/README.md packages/antd/README.md
git commit -m "docs: update READMEs for smart name defaults"
```
