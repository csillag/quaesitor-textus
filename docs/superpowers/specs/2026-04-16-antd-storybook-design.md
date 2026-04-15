# antd Storybook Setup

**Base revision:** `13754fb0b81ab5a3f434d7bb94636c9bae62c231` on branch `main` (as of 2026-04-15T22:02:31Z)

## Goal

Add a Storybook instance to the `packages/antd` package with a single story — a reimplementation of the core `FullListDemo` using the antd-styled `SearchInput`. Rename the existing `make storybook` target to `make core-storybook` and add a `make antd-storybook` target.

## Makefile Changes

- Rename the `storybook` target to `core-storybook`; update `.PHONY` and the help text accordingly
- Add `antd-storybook` target: `pnpm --filter @quaesitor-textus/antd storybook`
- Add `antd-storybook` to `.PHONY`

## `packages/antd/package.json`

Add a `storybook` script:

```json
"storybook": "storybook dev -p 6007"
```

Add devDependencies (same versions as core):

```json
"storybook": "^10.3.5",
"@storybook/react-vite": "^10.3.5",
"@storybook/addon-docs": "^10.3.5"
```

## `packages/antd/.storybook/main.ts`

Identical to core's config:

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

## `packages/antd/.storybook/preview.ts`

Identical to core's preview config. antd v5 uses CSS-in-JS so no global stylesheet import is needed.

## `packages/antd/stories/data/phrases.ts`

Copy of `packages/core/stories/data/phrases.ts`. The phrases array is not exported from the core package, so duplication is the clean option here.

## `packages/antd/stories/FullListDemo.stories.tsx`

Reimplementation of core's `FullListDemo` story using the antd components:

- `SearchInput` from `../src` (the antd `Input`-backed version — accepts `InputProps` minus `value`/`onChange`, so no `style` sizing needed)
- `WithSearch`, `HighlightedText`, `useSearchContext` from `@quaesitor-textus/core`
- Story title: `'Antd/FullListDemo'`

The story structure mirrors core's FullListDemo exactly: `WithSearch` wraps a `FullList` component that calls `useSearchContext` for `executeSearch`, `patterns`, and `hasPatterns`.

## Out of Scope

- No `build-storybook` script for antd (can be added later if CI deployment is needed)
- No antd `ConfigProvider` wrapper (not required for basic component rendering in v5)
- No changes to core's Storybook setup beyond the Makefile rename
