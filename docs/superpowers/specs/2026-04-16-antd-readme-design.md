# antd Package README

**Base revision:** `65822056699dbeaa8c1bef8a590a9f66398c70d6` on branch `main` (as of 2026-04-16T02:15:20Z)

## Goal

Add a `README.md` to `packages/antd` with a short explanation of what the package provides and a minimal React usage example.

## Scope

Single file: `packages/antd/README.md`. No changes to library code, tests, or stories.

## What this package provides

`@quaesitor-textus/antd` exports a single component: `SearchInput` — an antd `Input` wrapper with a built-in clear button (×). The search state and filtering logic are provided by `@quaesitor-textus/core`, which is a regular dependency (not a peer).

## Structure

One-liner description, installation, usage in two named sections, short closing sentence.

### Title and intro

```markdown
# @quaesitor-textus/antd

Ant Design `SearchInput` for [@quaesitor-textus/core](https://github.com/csillag/quaesitor-textus).
```

### Installation

```markdown
## Installation

```bash
npm install @quaesitor-textus/antd
```

Requires `antd ≥ 5` and `react ≥ 18`.
```

Note: `@quaesitor-textus/core` is a regular dependency and is installed automatically. `antd` and `react` are peer dependencies the user must provide.

### Usage

Two named sections, same `FilteredList` + `WithSearch` pattern as the core README.

**"Define a consumer component"** — `FilteredList` with a comment explaining isolation. Calls `useSearchContext()` for `filterFunction`, filters with `items.filter(filterFunction)`, renders with `<HighlightedText text={item} />`. Imports: `SearchInput` from `@quaesitor-textus/antd`; `WithSearch`, `useSearchContext`, `HighlightedText` from `@quaesitor-textus/core`.

**"Wire it into the tree"** — `WithSearch` wrapping `SearchInput` and `FilteredList`. Identical structure to the core README.

### Closing sentence

```markdown
`SearchInput` is an antd `Input` with a built-in clear button. The search state and
filtering logic are provided by `@quaesitor-textus/core`.
```
