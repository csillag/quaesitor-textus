# Tokenization minLength Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `parseInput()` so that `minLength` applies consistently — if at least one token meets the threshold all tokens are returned, otherwise none are.

**Architecture:** Single logic file change plus test updates. The new rule replaces the special-case `patterns.length === 1` guard with a `patterns.some(...)` check. No callers change.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Update tests to document the new behaviour

**Files:**
- Modify: `packages/core/src/logic/parseInput.test.ts`

- [ ] **Step 1: Replace the test that documents the old bypass behaviour**

The test on line 37 asserts the old bug. Replace it with two tests: one confirming the old bypass is gone, one confirming the "anchor qualifies, short token rides along" case.

Replace:
```typescript
  it('returns all patterns when multiple patterns are present, regardless of length', () => {
    // minLength check only applies when there is exactly one pattern
    expect(parseInput('f b')).toEqual(['f', 'b'])
  })
```

With:
```typescript
  it('returns empty array when no pattern meets minLength, even with multiple patterns', () => {
    expect(parseInput('f b')).toEqual([])
  })

  it('returns all patterns when at least one meets minLength', () => {
    expect(parseInput('foo a')).toEqual(['foo', 'a'])
  })
```

- [ ] **Step 2: Add tests for the custom-minLength multi-token cases**

After the existing `'respects custom minLength option'` test (line 42), add:
```typescript
  it('returns all patterns when at least one meets custom minLength', () => {
    expect(parseInput('foobar a', { minLength: 4 })).toEqual(['foobar', 'a'])
    expect(parseInput('foo bar', { minLength: 4 })).toEqual([])
  })
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd packages/core && pnpm test
```

Expected: failures on the two new tests (`'returns empty array when no pattern meets minLength...'` and `'returns all patterns when at least one meets minLength'`). All other tests still pass.

---

### Task 2: Implement the fix

**Files:**
- Modify: `packages/core/src/logic/parseInput.ts`

- [ ] **Step 1: Replace the implementation**

Replace the entire file content with:
```typescript
import type { SearchOptions } from './types'

export function parseInput(text: string, options: SearchOptions = {}): string[] {
  const { minLength = 2 } = options
  const patterns = [...new Set(text.trim().split(' ').filter(s => s.length > 0))]
  if (!patterns.some(p => p.length >= minLength)) return []
  return patterns
}
```

- [ ] **Step 2: Run tests to confirm they all pass**

```bash
cd packages/core && pnpm test
```

Expected: all tests pass, including the two new ones.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/logic/parseInput.ts packages/core/src/logic/parseInput.test.ts
git commit -m "fix(core): apply minLength consistently — require at least one qualifying token"
```
