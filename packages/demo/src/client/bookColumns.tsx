import React from 'react'
import type { TableColumnsType } from 'antd'
import { HighlightedCell } from '@quaesitor-textus/core'
import type { Book } from '../shared/generator'

// Shared antd Table columns for both the query and streaming tabs.
// Streaming records carry a server `_highlights` sidecar (data-driven highlighting);
// the paged query records do not, so HighlightedCell falls back to context-driven
// highlighting there — both are correct.
export const bookColumns: TableColumnsType<Book> = [
  {
    title: 'Author',
    dataIndex: 'author',
    render: (_a: string, record: Book) => (
      <HighlightedCell record={record} field="author" searchNames="author" />
    ),
  },
  {
    title: 'Title',
    dataIndex: 'title',
    render: (_t: string, record: Book) => (
      <HighlightedCell record={record} field="title" searchNames="title" />
    ),
  },
  { title: 'Year', dataIndex: 'year', width: 90 },
]
