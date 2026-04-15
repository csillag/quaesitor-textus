# antd FullListDemo — Table with Controlled Pagination

**Base revision:** `9a4a7d53b2ad5b96af35dd216f6cd64408d3b7e1` on branch `main` (as of 2026-04-15T23:39:56Z)

## Goal

Replace the `<ul>/<li>` list in the antd `FullListDemo` Storybook story with an antd `Table` component. Results are paginated (15 rows per page) using controlled pagination that resets to page 1 when the search term changes.

## Scope

Single file: `packages/antd/stories/FullListDemo.stories.tsx`. No changes to library code, tests, or any other story.

## Behavior

Current behavior is preserved:

- The table is only shown when `hasPatterns` is true (the user has typed a search term).
- The count paragraph ("X of Y phrases") remains above the table.
- The "try a different term" reset link is kept — moved into `locale={{ emptyText: <...> }}` on the Table so it appears as the table's empty state when `filtered.length === 0`. The separate zero-results paragraph is removed.

## Table Shape

- `dataSource`: `filtered` mapped to `{ key: phrase, phrase }` objects (phrase string used as key — unique in the dataset).
- One column: `title: 'Phrase'`, `dataIndex: 'phrase'`, `render: phrase => <HighlightedText text={phrase} patterns={patterns} />`.
- `showHeader`: visible (default) — the "Phrase" column header is shown.

## Pagination

Controlled pagination via a `currentPage` state variable (`useState(1)`) in `FullList`.

```tsx
pagination={{
  pageSize: 15,
  current: currentPage,
  onChange: setCurrentPage,
}}
```

`WithSearch` receives an `onChange` prop that resets the page to 1 on every search change:

```tsx
<WithSearch onChange={() => setCurrentPage(1)}>
  <FullList ... />
</WithSearch>
```

Because `currentPage` must be accessible both in `FullList` (for the Table) and in the `WithSearch` wrapper (for `onChange`), `currentPage` and `setCurrentPage` are lifted to the parent render component that wraps both.

`onChange` arguments `(oldValue, newValue)` are ignored — any change resets to page 1.

This design also prepares the ground for URL-shareable pagination in a future iteration: `currentPage` is already an external state variable that can be synced with a URL query param.

## Layout

Container `maxWidth` stays at 480. Phrases are long strings that wrap naturally within that width.
