# antd Storybook Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Storybook instance to `packages/antd` with a FullListDemo story, rename `make storybook` to `make core-storybook`, and add `make antd-storybook`.

**Architecture:** Mirror core's Storybook setup verbatim in the antd package. The antd story re-implements FullListDemo using `SearchInput` from `../src` (antd-backed) with `WithSearch`, `HighlightedText`, and `useSearchContext` from `@quaesitor-textus/core`. The phrases dataset is copied from core since it is not exported from the core package.

**Tech Stack:** Storybook 10 (`@storybook/react-vite`), React 18, antd 5, pnpm workspaces

---

## File Map

| Action | Path |
|--------|------|
| Modify | `Makefile` |
| Modify | `packages/antd/package.json` |
| Create | `packages/antd/.storybook/main.ts` |
| Create | `packages/antd/.storybook/preview.ts` |
| Create | `packages/antd/stories/data/phrases.ts` |
| Create | `packages/antd/stories/FullListDemo.stories.tsx` |

---

### Task 1: Update the Makefile

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Replace the Makefile contents**

Replace the entire file with:

```makefile
.PHONY: help install core-storybook antd-storybook build dev-tools

VENV := .venv
PIP  := $(VENV)/bin/pip

help:
	@echo "Available targets:"
	@echo "  install          Install all dependencies (pnpm install)"
	@echo "  core-storybook   Launch core Storybook dev server on http://localhost:6006"
	@echo "  antd-storybook   Launch antd Storybook dev server on http://localhost:6007"
	@echo "  build            Build all packages"
	@echo "  dev-tools        Install debug tools (Playwright headless browser)"

$(VENV)/bin/activate:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip

install:
	pnpm install

core-storybook:
	pnpm --filter @quaesitor-textus/core storybook

antd-storybook:
	pnpm --filter @quaesitor-textus/antd storybook

build:
	pnpm -r build

dev-tools: $(VENV)/bin/activate
	$(PIP) install playwright
	$(VENV)/bin/playwright install chromium
```

**Important:** The indentation inside targets must be a tab character, not spaces — Make requires tabs.

- [ ] **Step 2: Verify the help target**

```bash
make help
```

Expected output:
```
Available targets:
  install          Install all dependencies (pnpm install)
  core-storybook   Launch core Storybook dev server on http://localhost:6006
  antd-storybook   Launch antd Storybook dev server on http://localhost:6007
  build            Build all packages
  dev-tools        Install debug tools (Playwright headless browser)
```

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "chore: rename storybook target to core-storybook, add antd-storybook"
```

---

### Task 2: Add Storybook to antd's package.json

**Files:**
- Modify: `packages/antd/package.json`

- [ ] **Step 1: Add the storybook script**

In the `"scripts"` block, add after `"test:watch"`:

```json
"storybook": "storybook dev -p 6007"
```

The scripts block should look like:

```json
"scripts": {
  "build": "tsup",
  "test": "vitest run",
  "test:watch": "vitest",
  "storybook": "storybook dev -p 6007"
},
```

- [ ] **Step 2: Add Storybook devDependencies**

In the `"devDependencies"` block, add:

```json
"@storybook/addon-docs": "^10.3.5",
"@storybook/react-vite": "^10.3.5",
"storybook": "^10.3.5"
```

The full devDependencies block should look like:

```json
"devDependencies": {
  "@storybook/addon-docs": "^10.3.5",
  "@storybook/react-vite": "^10.3.5",
  "@testing-library/jest-dom": "^6.4.0",
  "@testing-library/react": "^16.0.0",
  "@types/react": "^18.3.0",
  "antd": "^5.0.0",
  "jsdom": "^24.0.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "storybook": "^10.3.5",
  "tsup": "^8.0.0",
  "typescript": "^5.4.0",
  "vitest": "^2.0.0"
}
```

- [ ] **Step 3: Install dependencies**

```bash
pnpm install
```

Expected: pnpm resolves and installs the new Storybook packages into `packages/antd/node_modules`.

- [ ] **Step 4: Commit**

```bash
git add packages/antd/package.json pnpm-lock.yaml
git commit -m "chore(antd): add storybook devDependencies and script"
```

---

### Task 3: Create Storybook config for antd

**Files:**
- Create: `packages/antd/.storybook/main.ts`
- Create: `packages/antd/.storybook/preview.ts`

- [ ] **Step 1: Create `packages/antd/.storybook/main.ts`**

```ts
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
}

export default config
```

- [ ] **Step 2: Create `packages/antd/.storybook/preview.ts`**

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

- [ ] **Step 3: Commit**

```bash
git add packages/antd/.storybook/
git commit -m "chore(antd): add Storybook config"
```

---

### Task 4: Create story files

**Files:**
- Create: `packages/antd/stories/data/phrases.ts`
- Create: `packages/antd/stories/FullListDemo.stories.tsx`

- [ ] **Step 1: Copy the phrases dataset**

```bash
mkdir -p packages/antd/stories/data
cp packages/core/stories/data/phrases.ts packages/antd/stories/data/phrases.ts
```

The file exports a single `phrases: string[]` array — no changes needed after copying.

- [ ] **Step 2: Create `packages/antd/stories/FullListDemo.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { WithSearch, HighlightedText, useSearchContext } from '@quaesitor-textus/core'
import { SearchInput } from '../src'
import { phrases } from './data/phrases'

const meta: Meta = {
  title: 'Antd/FullListDemo',
}

export default meta

const FullList = () => {
  const { executeSearch, patterns, hasPatterns } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo (antd)</h2>
      <SearchInput placeholder="Search phrases…" autoFocus />
      {hasPatterns && (
        <>
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

- [ ] **Step 3: Commit**

```bash
git add packages/antd/stories/
git commit -m "feat(antd): add FullListDemo Storybook story"
```

---

### Task 5: Verify antd Storybook runs

**Files:** none

- [ ] **Step 1: Start the antd Storybook**

```bash
make antd-storybook
```

Expected: Storybook starts on http://localhost:6007, no build errors in the terminal output.

- [ ] **Step 2: Confirm the story renders**

Open http://localhost:6007 in a browser. Navigate to **Antd → FullListDemo → Default**. Verify:
- The antd `Input` component renders with placeholder "Search phrases…"
- Typing a term filters the list and shows highlighted matches
- Clearing the input hides the list (controlled by `hasPatterns`)

- [ ] **Step 3: Stop the server** (`Ctrl+C`)

- [ ] **Step 4: Confirm core Storybook still works**

```bash
make core-storybook
```

Expected: Storybook starts on http://localhost:6006 with the same stories as before. Stop with `Ctrl+C`.
