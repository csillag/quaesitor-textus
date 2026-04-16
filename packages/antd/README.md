# @quaesitor-textus/antd

Ant Design `SearchInput` for [@quaesitor-textus/core](https://github.com/csillag/quaesitor-textus).

## Installation

```bash
npm install @quaesitor-textus/antd
```

Requires `antd ≥ 5` and `react ≥ 18`.

## Usage

### Define a consumer component

```tsx
import { WithSearch, useSearchContext, HighlightedText } from '@quaesitor-textus/core'
import { SearchInput } from '@quaesitor-textus/antd'

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

`SearchInput` is an antd `Input` with a built-in clear button. The search state and
filtering logic are provided by `@quaesitor-textus/core`.
