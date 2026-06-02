import React from 'react'
import type { TableColumnsType } from 'antd'
import { HighlightedText } from '@quaesitor-textus/core'
import type { Book } from '../shared/generator'

// Shared antd Table columns for both the query and streaming tabs.
export const bookColumns: TableColumnsType<Book> = [
  { title: 'Author', dataIndex: 'author', render: (a: string) => <HighlightedText text={a} searchNames="author" /> },
  { title: 'Title', dataIndex: 'title', render: (t: string) => <HighlightedText text={t} searchNames="title" /> },
  { title: 'Year', dataIndex: 'year', width: 90 },
]
