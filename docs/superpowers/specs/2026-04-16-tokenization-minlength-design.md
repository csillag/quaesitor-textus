# Tokenization minLength Cleanup

**Base revision:** `3071ae62f277d7236b8f693a8e8f0613843f2715` on branch `main` (as of 2026-04-16T16:05:08Z)

## Summary

Fix the `minLength` logic in `parseInput()` to apply consistently regardless of how many tokens are present. The current implementation only enforces `minLength` when there is exactly one token, which means multi-token input can bypass the threshold entirely. The new rule: if at least one token meets `minLength`, all tokens are returned; if no token meets `minLength`, return empty.

## Problem

The current `parseInput` implementation:

```typescript
const patterns = [...new Set(text.trim().split(' ').filter(s => s.length > 0))]
if (patterns.length === 1 && patterns[0].length < minLength) {
  return []
}
return patterns
```

The `minLength` guard is gated on `patterns.length === 1`. A query like `"a b"` bypasses the check entirely and returns `['a', 'b']`, even though neither token would pass the threshold alone. This is an asymmetric special case — the intent of `minLength` (avoid noisy results from very short queries) is defeated as soon as the user types a second word.

The same asymmetry exists in `dapp-sidedao/frontend`'s inline tokenization code (where the threshold is additionally set so low as to never trigger). It is not a pattern worth preserving.

## Design

### Rule

> Return all tokens if at least one token meets `minLength`; otherwise return empty.

This matches the approach used in `explorer`'s `multiTermSearch`. The key trade-off versus a "filter every token" approach:

- **Some-qualifies (chosen):** `"foo a"` → `['foo', 'a']`. The short token rides along because the long one has already narrowed the result set meaningfully.
- **Filter-all:** `"foo a"` → `['foo']`. The short token is silently dropped, which could be surprising to a user who typed it intentionally.

### Implementation

Single file change: `packages/core/src/logic/parseInput.ts`

```typescript
import type { SearchOptions } from './types'

export function parseInput(text: string, options: SearchOptions = {}): string[] {
  const { minLength = 2 } = options
  const patterns = [...new Set(text.trim().split(' ').filter(s => s.length > 0))]
  if (!patterns.some(p => p.length >= minLength)) return []
  return patterns
}
```

No other source files change. All callers reach `parseInput` via `useSearchInternalState`, which passes `SearchOptions` through unchanged.

### Test changes

File: `packages/core/src/logic/parseInput.test.ts`

One existing test documents the old bypass behaviour and must be updated:

- **Before:** `'returns all patterns when multiple patterns are present, regardless of length'` — asserts `parseInput('f b')` → `['f', 'b']`
- **After:** update to document the new rule — `parseInput('f b')` → `[]` (neither meets default `minLength: 2`)

New cases to add:
- `parseInput('foo a')` → `['foo', 'a']` (anchor qualifies, short token rides along)
- `parseInput('foo a', { minLength: 4 })` → `[]` (no token meets `minLength: 4`)
- `parseInput('foobar a', { minLength: 4 })` → `['foobar', 'a']` (anchor qualifies under custom threshold)

All other existing tests remain valid and pass unchanged.

## Scope

This change is limited to `parseInput` and its tests. No API surface changes. No behaviour changes for single-token queries. No changes to `SearchOptions`, `normalizeText`, `matchItem`, `getHighlightPositions`, or any React hooks/components.
