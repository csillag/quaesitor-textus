# antd Storybook — Phrases Sync Delta Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-sync `packages/antd/stories/data/phrases.ts` with the enlarged `packages/core/stories/data/phrases.ts` after the base branch extended the dataset.

**Architecture:** The antd copy was created from core's phrases file at branch creation time. The base branch later added ~26× more phrases (2,796 → 74,463 bytes). Re-copying restores the "copy of core's" invariant stated in the spec. No logic changes; no story file changes.

**Tech Stack:** bash (cp), git

---

## File Map

| Action | Path |
|--------|------|
| Overwrite | `packages/antd/stories/data/phrases.ts` |

---

### Task 1: Re-sync antd phrases from core

**Files:**
- Modify: `packages/antd/stories/data/phrases.ts` (overwrite with current core version)

- [ ] **Step 1: Overwrite with core's current phrases file**

```bash
cp packages/core/stories/data/phrases.ts packages/antd/stories/data/phrases.ts
```

- [ ] **Step 2: Verify the files are identical**

```bash
diff packages/core/stories/data/phrases.ts packages/antd/stories/data/phrases.ts
```

Expected: no output (files are identical).

- [ ] **Step 3: Verify the antd Storybook still builds without errors**

```bash
pnpm --filter @quaesitor-textus/core build 2>&1 | tail -3
```

Expected last line: `DTS ⚡️ Build success in ...`

- [ ] **Step 4: Commit**

```bash
git add packages/antd/stories/data/phrases.ts
git commit -m "chore(antd): sync phrases dataset with core"
```
