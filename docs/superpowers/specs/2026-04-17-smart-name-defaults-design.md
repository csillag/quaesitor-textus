# Smart Name Defaults

**Base revision:** `a634afc25ddcce36547c5c5e392a5a71b3e77c0d` on branch `main` (as of 2026-04-17T03:22:35Z)

## Summary

Eliminate boilerplate by making `name` on `WithSearch` auto-derive from the resolved field paths, and making `useSearchContext`, `SearchInput`, and `HighlightedText` automatically use the single active search when no name is specified.

## Section 1: `WithSearch` — name auto-derivation

`name` defaults to `resolvedFields.join('+')`, computed after `field`/`fields` normalization (the same normalization that already runs at the top of `WithSearch`):

| Props | `resolvedFields` | Default `name` |
|-------|-----------------|----------------|
| `<WithSearch>` | `["$"]` | `"$"` |
| `<WithSearch field="author">` | `["author"]` | `"author"` |
| `<WithSearch fields={["title","author"]}>` | `["title","author"]` | `"title+author"` |

If `name` is explicitly supplied, it takes precedence. Implementation change: replace `name ?? "default search"` with `name ?? resolvedFields.join('+')`.

The string `"default search"` disappears from the API entirely. Any consumer relying on it as a literal in `useSearchContext`, `SearchInput`, or `HighlightedText` will break, but this pattern is incompatible with `field`/`fields` and so is implausible in practice.

## Section 2: `useSearchContext` and `SearchInput` — smart single-entry lookup

**`useSearchContext(name?: string)`** changes behavior when `name` is `undefined`:

- **1 entry in map** → return it regardless of its name
- **0 entries** → throw: `"useSearchContext: no WithSearch found in the tree"`
- **2+ entries** → throw: `"useSearchContext: found N searches in context; pass a name to select one"`

When `name` is a string, behavior is unchanged (looks up by name, throws if not found).

**`SearchInput`** — the internal default for its `name` prop changes from `"default search"` to `undefined`. No TypeScript signature change (`name?: string` stays). The smart lookup triggers automatically when `name` is omitted.

Multi-field `SearchInput` usage still requires explicit `name` — with 2+ entries in the map, `useSearchContext()` throws as above, making the omission visible rather than silently picking the wrong search.

## Section 3: `HighlightedText` — smart single-entry auto-pick

When neither `searchNames` nor `all` is provided, `HighlightedText` reads the full context map (via `useContext(SearchContext)`, the same primitive used by `useFilterFunction`) and checks its size:

- **1 entry** → use its patterns (equivalent to passing `all`)
- **0 or 2+ entries** → no context-driven highlights; silent, not a throw

The local `patterns` prop is unaffected and always applied regardless of context size.

`HighlightedTrimmedText` inherits the same behavior (identical props interface).

The doc constraint "at least one of `searchNames`, `all`, or `patterns` must be supplied to see highlights" is removed.

## Net effect on examples

**Basic single-field search:**

```tsx
// Before
<WithSearch name="default search">
  <SearchInput name="default search" placeholder="Search…" />
  <HighlightedText text={item} all />

// After
<WithSearch>
  <SearchInput placeholder="Search…" />
  <HighlightedText text={item} />
```

**Multi-field search:**

```tsx
// Before
<WithSearch name="author" field="author">
  <WithSearch name="title" field="title">
    <SearchInput name="author" placeholder="Search author…" />
    <SearchInput name="title" placeholder="Search title…" />
    <HighlightedText text={book.author} searchNames="author" />
    <HighlightedText text={book.title} searchNames="title" />

// After
<WithSearch field="author">
  <WithSearch field="title">
    <SearchInput name="author" placeholder="Search author…" />
    <SearchInput name="title" placeholder="Search title…" />
    <HighlightedText text={book.author} searchNames="author" />
    <HighlightedText text={book.title} searchNames="title" />
```

In the multi-field case `SearchInput` still needs explicit `name`; `HighlightedText` still needs explicit `searchNames` because 2 entries are in the map.

## Files to change

- `packages/core/src/context/WithSearch.tsx` — name default derivation
- `packages/core/src/hooks/useSearchContext.ts` — smart single-entry lookup
- `packages/core/src/components/SearchInput.tsx` — change internal name default to `undefined`
- `packages/core/src/components/HighlightedText.tsx` — smart single-entry auto-pick
- `packages/core/src/components/HighlightedTrimmedText.tsx` — inherits from HighlightedText logic (verify no separate handling needed)
- Tests for all of the above
- `packages/core/README.md` — update examples, remove "at least one of" note, update API tables
- `packages/antd/README.md` — update examples

## Breaking changes

- `<WithSearch>` (bare, no field/fields): name changes from `"default search"` to `"$"`. Any consumer using the literal `"default search"` to connect inputs or look up context will break.
- `<WithSearch field="x">` without explicit `name`: name changes from `"default search"` to `"x"`. Same breakage vector.
- `<SearchInput>` without `name`: previously connected to the `"default search"` entry; now uses smart single-entry lookup (behavior change, not an error, but context wiring changes).

## Out of scope

- Smart auto-pick for `useFilterFunction` — it already reads the whole context map, no change needed.
- Any changes to `SearchOptions`, `patterns`, tokenization, or matching logic.
