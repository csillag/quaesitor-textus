# @quaesitor-textus/antd

Ant Design `SearchInput` for [@quaesitor-textus/core](https://github.com/csillag/quaesitor-textus).

## Installation

```bash
npm install @quaesitor-textus/antd
```

Requires `antd ≥ 5` and `react ≥ 18`.

## Basic usage

```tsx
import { WithSearch, useSearchContext, useFilterFunction, HighlightedText } from '@quaesitor-textus/core'
import { SearchInput } from '@quaesitor-textus/antd'

const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry']

const FilteredList = () => {
  const { hasPatterns } = useSearchContext()
  const filterFunction = useFilterFunction()
  const results = items.filter(filterFunction)
  return (
    <ul>
      {results.map(item => (
        <li key={item}>
          <HighlightedText text={item} all />
        </li>
      ))}
    </ul>
  )
}

export const App = () => (
  <WithSearch>
    <SearchInput placeholder="Search…" />
    <FilteredList />
  </WithSearch>
)
```

`SearchInput` is an antd `Input` with a built-in clear button. Search state and filtering logic come from `@quaesitor-textus/core`.

## Multi-field search

```tsx
import { WithSearch, useFilterFunction, HighlightedText } from '@quaesitor-textus/core'
import { SearchInput } from '@quaesitor-textus/antd'

interface Book { author: string; title: string }

const books: Book[] = [
  { author: 'Jane Austen', title: 'Pride and Prejudice' },
  { author: 'Leo Tolstoy', title: 'Anna Karenina' },
]

const BookList = () => {
  const filterFunction = useFilterFunction()
  return (
    <ul>
      {books.filter(filterFunction).map((book, i) => (
        <li key={i}>
          <HighlightedText text={book.author} searchNames="author" />
          {' — '}
          <HighlightedText text={book.title} searchNames="title" />
        </li>
      ))}
    </ul>
  )
}

export const App = () => (
  <WithSearch name="author" field="author">
    <WithSearch name="title" field="title">
      <SearchInput name="author" placeholder="Search author…" />
      <SearchInput name="title" placeholder="Search title…" />
      <BookList />
    </WithSearch>
  </WithSearch>
)
```

## `<SearchInput>` props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | `"default search"` | Name of the `WithSearch` entry this input controls. |
| …rest | `InputProps` | — | All other antd `Input` props except `value`, `onChange`, and `suffix`. |

For `WithSearch`, `useFilterFunction`, `useSearchContext`, `HighlightedText`, and `HighlightedTrimmedText` see the [@quaesitor-textus/core docs](https://github.com/csillag/quaesitor-textus/tree/main/packages/core).
