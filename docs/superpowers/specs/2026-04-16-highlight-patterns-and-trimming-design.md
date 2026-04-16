# Highlight Patterns Accumulation and Text Trimming

**Base revision:** `a42d53c297e0cfbb5fd43ebe21c6d7619182b87c` on branch `main` (as of 2026-04-16T00:08:10Z)

## Summary

Port and adapt a set of features from the `explorer` repo into `quaesitor-textus/core`. The work covers five items from a structured comparison between the two repos:

- **Point 1** — `text` prop on `HighlightedText` accepts `string | undefined`
- **Point 2** — No-match rendering returns the raw string (no `<span>` wrapper)
- **Points 13 + 14** — `SearchContext` grows a `highlightedPatterns` field; `WithSearch` accumulates it across nested contexts; `HighlightedText` consumes it automatically
- **Point 21** — New `trimAroundMatch` pure function and `HighlightedTrimmedText` component

Point 5 (`partsToHighlight`) is explicitly deferred — not needed for trimming in this repo's architecture.

---

## Section 1 — Data model changes

### `SearchContextValue`

Add one new field to `SearchContextValue` in `packages/core/src/context/SearchContext.ts`:

```ts
highlightedPatterns: string[]
```

This is the set of patterns that highlight components (`HighlightedText`, `HighlightedTrimmedText`) should use for rendering marks. It is separate from `patterns` (which drives search filtering) but defaults to the same values when no nesting is in play.

### `WithSearch` accumulation

`WithSearch` reads `highlightedPatterns` from the nearest upstream `SearchContext` via `useContext(SearchContext)` (not `useSearchContext`, to avoid the throw when there is no upstream context). It then provides:

```ts
highlightedPatterns: [...new Set([...upstreamHighlightedPatterns, ...patterns])]
```

where `patterns` is the current instance's own derived patterns (from `parseInput`). When there is no upstream context, `upstreamHighlightedPatterns` is `[]`.

This means nested `WithSearch` trees naturally accumulate highlight patterns from all ancestor search contexts, deduplicated.

### `useSearchContext`

No changes needed — it already returns the full `SearchContextValue`, so `highlightedPatterns` is exposed automatically once added to the context value.

---

## Section 2 — `HighlightedText` changes

File: `packages/core/src/components/HighlightedText.tsx`

**Three changes:**

1. **`text` prop type**: `string` → `string | undefined`. When `undefined`, return `undefined` immediately.

2. **No-match rendering**: When `spans.length === 0`, return the raw `text` string — no `<span>` wrapper. (Currently returns `<span>{text}</span>`.)

3. **Pattern resolution**: Change from:
   ```ts
   const patterns = propPatterns ?? ctx?.patterns ?? []
   ```
   to:
   ```ts
   const patterns = [...new Set([...(ctx?.highlightedPatterns ?? []), ...(propPatterns ?? [])])]
   ```
   Context `highlightedPatterns` are the base; the explicit `patterns` prop adds extra highlights on top, deduplicated. The `patterns` prop is kept but its role is "additional highlights beyond what the context provides," not the primary source.

**Effect on stories**: The `patterns={patterns}` prop on `<HighlightedText>` in both `FullListDemo` stories was already redundant (the component was reading identical values from context). This work makes that explicit and those props will be removed.

---

## Section 3 — `trimAroundMatch` + `HighlightedTrimmedText`

### New file: `packages/core/src/logic/trimAroundMatch.ts`

Pure function, no React dependencies. Independently testable.

```ts
interface TrimOptions extends SearchOptions {
  fragmentLength?: number  // default: 80
}

function trimAroundMatch(text: string, patterns: string[], options?: TrimOptions): string
```

Logic:

1. If `text.length <= fragmentLength`, return `text` unchanged.
2. Run `getHighlightPositions(text, patterns, options)` to find all match spans.
3. If no matches, return `text.substring(0, fragmentLength) + '…'`.
4. Compute bounding box: `minStart = min(span.start)`, `maxEnd = max(span.end)`.
5. Compute available buffer: `fragmentLength - (maxEnd - minStart)`.
6. Start position: `max(0, min(minStart - floor(buffer / 2), text.length - fragmentLength))`.
7. End position: `min(startPos + fragmentLength, text.length)`.
8. Return `(startPos > 0 ? '…' : '') + text.substring(startPos, endPos) + (endPos < text.length ? '…' : '')`.

Exported from `packages/core/src/logic/index.ts` and `packages/core/src/index.ts`.

### New component: `packages/core/src/components/HighlightedTrimmedText.tsx`

```tsx
interface HighlightedTrimmedTextProps {
  text: string | undefined
  fragmentLength?: number       // default: 80
  options?: SearchOptions
  markStyle?: React.CSSProperties
}
```

Implementation:
- Reads `highlightedPatterns` from nearest `SearchContext` via `useContext(SearchContext)` (graceful — no throw if outside context).
- If `text` is `undefined`, returns `undefined`.
- Calls `trimAroundMatch(text, highlightedPatterns, { fragmentLength, ...options })`.
- Passes the trimmed string to `<HighlightedText text={trimmedText} options={options} markStyle={markStyle} />` — `options` is forwarded so `HighlightedText` uses the same normalization settings when re-running highlight positioning.
- `HighlightedText` re-runs highlight positioning on the shorter string — no pre-computed match injection needed.

Exported from `packages/core/src/index.ts`.

---

## Section 4 — Story updates

Both stories are inside a `WithSearch` context, so `HighlightedText` / `HighlightedTrimmedText` pick up patterns automatically.

### `packages/core/stories/FullListDemo.stories.tsx`

- Remove `patterns` from `useSearchContext()` destructure.
- Replace `<HighlightedText text={phrase} patterns={patterns} />` with `<HighlightedTrimmedText text={phrase} fragmentLength={40} />`.

### `packages/antd/stories/FullListDemo.stories.tsx`

- Remove `patterns` from `useSearchContext()` destructure.
- Replace `<HighlightedText text={phrase} patterns={patterns} />` in the column `render` with `<HighlightedTrimmedText text={phrase} fragmentLength={40} />`.

---

## Section 5 — Tests

### `packages/core/src/logic/trimAroundMatch.test.ts` (new)

- Text shorter than `fragmentLength` → returned unchanged, no ellipsis.
- No match → truncates from start, appends `…`.
- Match near the beginning → window starts at 0, no leading `…`.
- Match near the end → window pushed to end, no trailing `…`.
- Match in the middle → window centered, leading and trailing `…`.
- `fragmentLength` respected exactly.

### `packages/core/src/components/HighlightedText.test.tsx` (extend)

- `text={undefined}` → returns `undefined`.
- No match → returns raw string (no wrapper element).
- Inside a context with `highlightedPatterns`, no `patterns` prop → highlights from context.
- Inside a context with `highlightedPatterns`, plus explicit `patterns` prop → both sets highlighted (union).

### `packages/core/src/components/HighlightedTrimmedText.test.tsx` (new)

- `text={undefined}` → returns `undefined`.
- Text shorter than `fragmentLength` → full text rendered with highlights.
- Text longer than `fragmentLength` with match → trimmed fragment with `…` and highlights.
- Respects explicit `fragmentLength` prop.
- Reads patterns from context (no prop required).

---

## Out of scope for this round

- **Point 5** (`partsToHighlight` pre-computed match injection) — deferred.
- **Point 22** (`AdaptiveHighlightedText`) — deferred.
- **Points 7, 8, 9, 11, 15, 16, 17, 18, 19, 20** — not part of this round.
