# FullList Demo: Enter-to-Select with Quote Display

**Base revision:** `07c269f98c23c06832b8a7fea5c74e481caaac02` on branch `main` (as of 2026-04-16T02:15:33Z)

## Summary

Add a "select on Enter" feature to both FullList demo stories. When the user presses Enter in the search input and there is exactly one matching sentence, that sentence is "selected" and displayed as a prominent quote below the list. The selection is automatically cleared whenever the search changes such that the selected sentence is no longer the sole match.

This change also renames all `phrase`/`phrases` identifiers to `sentence`/`sentences` throughout the story files.

## Scope

Changes are confined to the two story files and their data files:

- `packages/core/stories/FullListDemo.stories.tsx`
- `packages/antd/stories/FullListDemo.stories.tsx`
- `packages/core/stories/data/phrases.ts` → renamed to `sentences.ts`
- `packages/antd/stories/data/phrases.ts` → renamed to `sentences.ts`

No changes to library source (`packages/core/src`, `packages/antd/src`).

## Rename: phrase → sentence

All occurrences of `phrase`/`phrases` in the story files and data files are renamed to `sentence`/`sentences`. Specifically:

- Data file: `phrases.ts` → `sentences.ts`; exported constant `phrases` → `sentences`
- Import in both story files updated accordingly
- Variable names: `phrase` → `sentence`, `phrases` → `sentences`
- Type name (antd): `PhraseRow` → `SentenceRow`
- Column title (antd table): `'Phrase'` → `'Sentence'`
- Placeholder text: `"Search phrases…"` → `"Search sentences…"` (both stories)

## State & Selection Logic

Both `FullList` components gain one piece of local state:

```ts
const [selectedSentence, setSelectedSentence] = useState<string | null>(null)
```

**Selection trigger:** `onKeyDown` prop on `SearchInput`. If `key === 'Enter'` and `filtered.length === 1`, call `setSelectedSentence(filtered[0])`.

**Deselection:** A `useEffect` watching `filtered` and `selectedSentence`. If `selectedSentence !== null` and it is no longer the case that `filtered.length === 1 && filtered[0] === selectedSentence`, call `setSelectedSentence(null)`.

No Escape key handling. No change to `WithSearch`, `SearchContext`, or `SearchInput` library components.

## Quote Display

The selected sentence is rendered **below the list**, only when `selectedSentence !== null`. The list always remains visible (including the single matching item).

The sentence is displayed as plain, untruncated text — no highlights.

**Core version:** A styled `<div>` acting as a blockquote:

```tsx
<div style={{
  marginTop: 16,
  border: '1.5px solid #d0d0d0',
  borderRadius: 12,
  padding: '16px 20px',
  background: '#fafafa',
  fontSize: 16,
}}>
  {selectedSentence}
</div>
```

**Antd version:** An antd `<Card>` component:

```tsx
<Card style={{ marginTop: 16, borderRadius: 12 }}>
  {selectedSentence}
</Card>
```

## Testing

No automated tests are required — these are story/demo components. Manual verification in Storybook (port 6006 for core, 6007 for antd):

1. Type a search term that matches exactly one sentence → press Enter → quote appears below list
2. Edit the search to match 0 or 2+ sentences → quote disappears
3. Edit the search back to exactly one match → press Enter again → quote reappears
4. Clear the search → quote disappears
