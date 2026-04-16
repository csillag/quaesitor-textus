# @quaesitor-textus/core

Text search and highlighting for React.

## Installation

```bash
npm install @quaesitor-textus/core
```

Requires React ≥ 18.

## Usage

### Define a consumer component

```tsx
import { WithSearch, SearchInput, useSearchContext, HighlightedText } from '@quaesitor-textus/core'

const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry']

// FilteredList runs the search and renders results.
// Keeping it separate makes the App tree easy to read.
const FilteredList = () => {
  const { filterFunction } = useSearchContext()
  const results = items.filter(filterFunction)
  return (
    <ul>
      {results.map(item => (
        <li key={item}>
          <HighlightedText text={item} />
        </li>
      ))}
    </ul>
  )
}
```

### Wire it into the tree

```tsx
export const App = () => (
  <WithSearch>
    <SearchInput placeholder="Search…" />
    <FilteredList />
  </WithSearch>
)
```

`WithSearch` owns the search state and makes it available to the tree. `SearchInput`
reads and updates the query. `FilteredList` calls `useSearchContext()` to get
`filterFunction` — a pre-bound filter predicate — and passes it to `Array.filter`.
`HighlightedText` picks up the active search patterns from context automatically.
