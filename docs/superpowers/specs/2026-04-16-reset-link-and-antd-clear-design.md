# Reset Link and antd SearchInput Clear Button

**Base revision:** `6cf38b5238fa9a9f9ccf621ed3bf85b12ded1f2f` on branch `main` (as of 2026-04-15T22:40:05Z)

## Goal

Two related UX improvements:

1. In both FullListDemo stories (core and antd), make "try a different term" a clickable link that calls `reset()` from the search context.
2. Add a clear button to the antd `SearchInput` component, mirroring the core version's behaviour exactly (correct in all modes including controlled mode with `onReset`).

## FullListDemo Stories (both core and antd)

**Files:** `packages/core/stories/FullListDemo.stories.tsx`, `packages/antd/stories/FullListDemo.stories.tsx`

Add `reset` to the `useSearchContext()` destructuring in each story's `FullList` component.

Replace the static "no results" paragraph:

```tsx
<p style={{ color: '#999', fontStyle: 'italic' }}>No results — try a different term</p>
```

with:

```tsx
<p style={{ color: '#999', fontStyle: 'italic' }}>
  No results —{' '}
  <span
    onClick={reset}
    style={{ textDecoration: 'underline', color: '#1677ff', cursor: 'pointer' }}
  >
    try a different term
  </span>
</p>
```

`#1677ff` is antd's default primary blue, which reads consistently in both the plain-HTML core story and the antd story. A `<span>` is used rather than `<a>` to avoid needing a dummy `href`.

## antd `SearchInput` Component

**File:** `packages/antd/src/components/SearchInput.tsx`

Add `reset` to the context destructuring. Add a `suffix` prop that renders a clear button when `query.length > 0`, calling `reset()` directly. `suffix` is added to the `Omit` type so callers cannot override it — the clear button is always managed internally.

```tsx
export function SearchInput(props: Omit<InputProps, 'value' | 'onChange' | 'suffix'>) {
  const { query, setQuery, reset } = useSearchContext()
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
        ) : <span />
      }
    />
  )
}
```

`<span />` as the empty-state suffix keeps antd's input layout stable — without it, the input shifts width when the × appears and disappears.

`rgba(0,0,0,0.45)` matches antd's standard muted icon color.

This approach mirrors core's `SearchInput` exactly: `reset()` is called directly on click, which correctly delegates to `onReset` in controlled mode rather than just calling `setQuery('')`. antd's `allowClear` is not used because it fires `onChange` with an empty value in addition to any `onClear` handler, causing a double-call in controlled mode.

## Testing

### antd `SearchInput`

New test cases in `packages/antd/src/components/SearchInput.test.tsx`:

1. Clear button is absent when query is empty
2. Clear button is present when query is non-empty
3. Clicking the clear button calls `reset()` from context (not just `setQuery('')`)

### Stories

The "try a different term" link behaviour is verified visually in Storybook. No automated tests for story files.

## Out of Scope

- No changes to the core `SearchInput` component (already has a clear button)
- No changes to `WithSearch`, `useSearch`, or any context logic
- No changes to the antd package's test for existing controlled/uncontrolled behaviour (those tests are unaffected)
