# antd FullListDemo — Table with Controlled Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `<ul>/<li>` phrase list in the antd `FullListDemo` Storybook story with an antd `Table` component with a single "Phrase" column and controlled pagination (15 rows/page) that resets to page 1 on every search change.

**Architecture:** `currentPage` state is lifted into a new `FullListWrapper` component that wraps both `WithSearch` and `FullList`. `WithSearch` receives `onChange={() => setCurrentPage(1)}` to reset pagination on every query change. `FullList` receives `currentPage` and `setCurrentPage` as props for the controlled `Table` pagination.

**Tech Stack:** React, antd v5 (`Table`, `TableColumnsType`), `@quaesitor-textus/core` (`WithSearch`, `HighlightedText`, `useSearchContext`), Storybook.

---

### Task 1: Replace list with antd Table and controlled pagination

This is a Storybook demo story — there are no unit tests. Verification is visual, done in the antd Storybook (port 6007).

**Files:**
- Modify: `packages/antd/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `packages/antd/stories/FullListDemo.stories.tsx` with:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { Table } from 'antd'
import type { TableColumnsType } from 'antd'
import { WithSearch, HighlightedText, useSearchContext } from '@quaesitor-textus/core'
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
  const { executeSearch, patterns, hasPatterns, reset } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)

  const dataSource: PhraseRow[] = filtered.map(phrase => ({ key: phrase, phrase }))

  const cols: TableColumnsType<PhraseRow> = [
    {
      title: 'Phrase',
      dataIndex: 'phrase',
      render: (phrase: string) => <HighlightedText text={phrase} patterns={patterns} />,
    },
  ]

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo (antd)</h2>
      <SearchInput placeholder="Search phrases…" autoFocus />
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            {filtered.length} of {phrases.length} phrases
          </p>
          <Table<PhraseRow>
            dataSource={dataSource}
            columns={cols}
            pagination={{
              pageSize: 15,
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
    <WithSearch onChange={() => setCurrentPage(1)}>
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
cd packages/antd && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify visually in Storybook**

Ensure the antd Storybook dev server is running (port 6007):

```bash
pnpm --filter @quaesitor-textus/antd storybook
```

Open `http://localhost:6007` and navigate to **Antd → FullListDemo → Default**.

Check:
1. No table is shown before typing anything.
2. Typing a term shows the "X of Y phrases" count and the Table with a "Phrase" header.
3. Results matching the search term have the matched text highlighted.
4. The table shows at most 15 rows per page; pagination controls appear at the bottom when there are more than 15 results.
5. Clicking a page number navigates to that page.
6. Changing the search term (adding/removing a character) resets to page 1.
7. A search with zero results shows "No results — try a different term" inside the table's empty state area.
8. Clicking "try a different term" clears the search input and hides the table.

- [ ] **Step 4: Commit**

```bash
git add packages/antd/stories/FullListDemo.stories.tsx
git commit -m "feat(antd): replace list with Table and controlled pagination in FullListDemo"
```
