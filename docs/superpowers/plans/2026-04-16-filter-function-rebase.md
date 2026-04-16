# filterFunction Rebase — Conflict Resolution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebase `feature/filter-function` onto `main` and resolve the two story file conflicts that arise from combining the `filterFunction` change (this branch) with the `HighlightedTrimmedText` change (parallel feature on main).

**Architecture:** The rebase replays three commits. The second commit (`chore(stories): update FullListDemo stories to use filterFunction`) conflicts with main's parallel story changes. Resolution combines both sides: `filterFunction` for filtering (from this branch) + `HighlightedTrimmedText` for rendering (from main). The other two commits apply cleanly.

**Tech Stack:** git rebase, TypeScript/React (pnpm workspace).

**Worktree:** `.worktrees/filter-function` on branch `feature/filter-function`

**Run all tests:** `pnpm --filter @quaesitor-textus/core build && pnpm test`

---

## File Map

| File | Change |
|------|--------|
| `packages/core/stories/FullListDemo.stories.tsx` | Conflict resolution: `filterFunction` + `HighlightedTrimmedText` |
| `packages/antd/stories/FullListDemo.stories.tsx` | Conflict resolution: `filterFunction` + `HighlightedTrimmedText` |

---

### Task 1: Rebase onto main and resolve story file conflicts

**Files:**
- Modify: `packages/core/stories/FullListDemo.stories.tsx`
- Modify: `packages/antd/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Start the rebase**

  ```bash
  git rebase main
  ```

  Expected output (rebase stops mid-way):
  ```
  Auto-merging packages/antd/stories/FullListDemo.stories.tsx
  CONFLICT (content): Merge conflict in packages/antd/stories/FullListDemo.stories.tsx
  Auto-merging packages/core/stories/FullListDemo.stories.tsx
  CONFLICT (content): Merge conflict in packages/core/stories/FullListDemo.stories.tsx
  error: could not apply a28810f... chore(stories): update FullListDemo stories to use filterFunction
  ```

  The rebase stops at the second of three commits. The first commit (`feat(core): replace executeSearch with filterFunction`) applied cleanly. The third (`feat(core): export ItemOptions type`) will apply after you resolve and continue.

- [ ] **Step 2: Write the resolved core story**

  Replace the full content of `packages/core/stories/FullListDemo.stories.tsx` with:

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
    const { filterFunction, hasPatterns, reset } = useSearchContext<string>()
    const filtered = phrases.filter(filterFunction)
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

- [ ] **Step 3: Stage the resolved core story**

  ```bash
  git add packages/core/stories/FullListDemo.stories.tsx
  ```

- [ ] **Step 4: Write the resolved antd story**

  Replace the full content of `packages/antd/stories/FullListDemo.stories.tsx` with:

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
    const { filterFunction, hasPatterns, reset } = useSearchContext<string>()
    const filtered = phrases.filter(filterFunction)

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

- [ ] **Step 5: Stage the resolved antd story**

  ```bash
  git add packages/antd/stories/FullListDemo.stories.tsx
  ```

- [ ] **Step 6: Continue the rebase**

  ```bash
  git rebase --continue
  ```

  Git will reuse the commit message `chore(stories): update FullListDemo stories to use filterFunction`. If your editor opens, save and close without changing the message.

  Expected: rebase completes cleanly, applying the third commit (`feat(core): export ItemOptions type`) automatically.

  Verify with:
  ```bash
  git log --oneline -5
  ```

  Expected (newest first):
  ```
  <sha> feat(core): export ItemOptions type
  <sha> chore(stories): update FullListDemo stories to use filterFunction
  <sha> feat(core): replace executeSearch with filterFunction on useSearchContext
  <sha> ... (main commits)
  ```

---

### Task 2: Verify the full test suite passes

- [ ] **Step 1: Run the full test suite**

  ```bash
  pnpm --filter @quaesitor-textus/core build && pnpm test 2>&1 | tail -15
  ```

  Expected:
  ```
  Test Files  10 passed (10)
       Tests  103 passed (103)
  ...
  Test Files  1 passed (1)
       Tests  7 passed (7)
  ```

  110 tests total across both packages.

- [ ] **Step 2: Confirm branch is on top of main**

  ```bash
  git log --oneline main..HEAD
  ```

  Expected: exactly 3 commits (the three feature commits, now rebased onto main).
