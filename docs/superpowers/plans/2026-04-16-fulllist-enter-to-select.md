# FullList Enter-to-Select with Quote Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Enter-to-select behaviour to both FullList demo stories, displaying the selected sentence as a prominent quote, and rename all `phrase`/`phrases` identifiers to `sentence`/`sentences` throughout story files.

**Architecture:** Local state (`selectedSentence`) in each `FullList` component; selection triggered by `onKeyDown` on `SearchInput`; deselection via `useEffect` watching the filtered list. No library source changes.

**Tech Stack:** React (useState, useEffect), TypeScript, Storybook; antd `Card` in the antd story.

---

## File Map

| Action | Path |
|--------|------|
| Rename | `packages/core/stories/data/phrases.ts` → `sentences.ts` |
| Rename | `packages/antd/stories/data/phrases.ts` → `sentences.ts` |
| Modify | `packages/core/stories/FullListDemo.stories.tsx` |
| Modify | `packages/antd/stories/FullListDemo.stories.tsx` |

No changes to any file under `packages/core/src/` or `packages/antd/src/`.

---

## Task 1: Rename core data file

**Files:**
- Delete: `packages/core/stories/data/phrases.ts`
- Create: `packages/core/stories/data/sentences.ts`

These are story/demo files with no unit tests. Testing is done manually in Storybook.

- [ ] **Step 1: Create the renamed file**

  Create `packages/core/stories/data/sentences.ts` with the content below (only the first line changes — the export name — the array contents are identical):

  ```ts
  export const sentences: string[] = [
    // ... (same array as phrases.ts, no content changes)
  ```

  The simplest correct approach is a `git mv`:

  ```bash
  git mv packages/core/stories/data/phrases.ts packages/core/stories/data/sentences.ts
  ```

  Then open the file and change line 1 from:
  ```ts
  export const phrases: string[] = [
  ```
  to:
  ```ts
  export const sentences: string[] = [
  ```

- [ ] **Step 2: Verify the file exists and compiles**

  ```bash
  cd /home/csillag/deai/text-search
  pnpm --filter @quaesitor-textus/core exec tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors related to `sentences.ts`. (There will be errors about `phrases` still being imported in `FullListDemo.stories.tsx` — that is fine; those are fixed in Task 2.)

- [ ] **Step 3: Commit**

  ```bash
  git add packages/core/stories/data/
  git commit -m "refactor(core/stories): rename phrases data file to sentences"
  ```

---

## Task 2: Update core FullListDemo story

**Files:**
- Modify: `packages/core/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Replace the entire file**

  Write the following complete content to `packages/core/stories/FullListDemo.stories.tsx`:

  ```tsx
  import type { Meta, StoryObj } from '@storybook/react'
  import React, { useState, useEffect } from 'react'
  import { WithSearch, SearchInput, HighlightedTrimmedText, useSearchContext } from '../src'
  import { sentences } from './data/sentences'

  const meta: Meta = {
    title: 'Core/FullListDemo',
  }

  export default meta

  const FullList = () => {
    const { filterFunction, hasPatterns, reset } = useSearchContext<string>()
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
                  <HighlightedTrimmedText text={sentence} fragmentLength={40} />
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

- [ ] **Step 2: Type-check**

  ```bash
  cd /home/csillag/deai/text-search
  pnpm --filter @quaesitor-textus/core exec tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors.

- [ ] **Step 3: Manual smoke test in Storybook**

  Start Storybook if not already running:
  ```bash
  cd packages/core && pnpm storybook
  ```
  (Opens on port 6006.)

  Navigate to **Core → FullListDemo → Default**.

  Test the following scenarios:
  1. Type a term that matches exactly one sentence (e.g. `"cinnamon"`) → press Enter → the full sentence appears below the list in a rounded box.
  2. Modify the search so it matches 0 or 2+ sentences → the quote box disappears.
  3. Refine back to exactly one match → press Enter again → quote reappears.
  4. Click the × button to clear → quote disappears.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/core/stories/FullListDemo.stories.tsx
  git commit -m "feat(core/stories): add enter-to-select quote display, rename phrase→sentence"
  ```

---

## Task 3: Rename antd data file

**Files:**
- Delete: `packages/antd/stories/data/phrases.ts`
- Create: `packages/antd/stories/data/sentences.ts`

- [ ] **Step 1: Rename the file and update the export**

  ```bash
  git mv packages/antd/stories/data/phrases.ts packages/antd/stories/data/sentences.ts
  ```

  Then open `packages/antd/stories/data/sentences.ts` and change line 1 from:
  ```ts
  export const phrases: string[] = [
  ```
  to:
  ```ts
  export const sentences: string[] = [
  ```

- [ ] **Step 2: Verify**

  ```bash
  cd /home/csillag/deai/text-search
  pnpm --filter @quaesitor-textus/antd exec tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors from `sentences.ts` itself. (Import errors in the story file are expected and fixed in Task 4.)

- [ ] **Step 3: Commit**

  ```bash
  git add packages/antd/stories/data/
  git commit -m "refactor(antd/stories): rename phrases data file to sentences"
  ```

---

## Task 4: Update antd FullListDemo story

**Files:**
- Modify: `packages/antd/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Replace the entire file**

  Write the following complete content to `packages/antd/stories/FullListDemo.stories.tsx`:

  ```tsx
  import type { Meta, StoryObj } from '@storybook/react'
  import React, { useState, useEffect } from 'react'
  import { Table, Card } from 'antd'
  import type { TableColumnsType } from 'antd'
  import { WithSearch, HighlightedTrimmedText, useSearchContext } from '@quaesitor-textus/core'
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
    const { filterFunction, hasPatterns, reset } = useSearchContext<string>()
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
        render: (sentence: string) => <HighlightedTrimmedText text={sentence} fragmentLength={40} />,
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
      <WithSearch
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

- [ ] **Step 2: Type-check**

  ```bash
  cd /home/csillag/deai/text-search
  pnpm --filter @quaesitor-textus/antd exec tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors.

- [ ] **Step 3: Manual smoke test in Storybook**

  Start the antd Storybook if not already running:
  ```bash
  cd packages/antd && pnpm storybook
  ```
  (Opens on port 6007.)

  Navigate to **Antd → FullListDemo → Default**.

  Test the following scenarios:
  1. Type a term that matches exactly one sentence → press Enter → the full sentence appears below the table in an antd `Card` with rounded corners.
  2. Modify the search so it matches 0 or 2+ sentences → the card disappears.
  3. Refine back to exactly one match → press Enter again → card reappears.
  4. Click the × button to clear → card disappears.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/antd/stories/FullListDemo.stories.tsx
  git commit -m "feat(antd/stories): add enter-to-select quote display, rename phrase→sentence"
  ```
