import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { Table, Switch, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  WithSearch,
  HighlightedText,
  useFilterFunction,
  useSearchContext,
} from '@quaesitor-textus/core'
import { SearchInput } from '../src'
import { books } from './data/books'
import type { Book } from './data/books'

const meta: Meta = {
  title: 'Antd/BookSearchDemo',
}

export default meta

type BookRow = Book & { key: string }

interface BookTableProps {
  mode: 'AND' | 'OR'
  currentPage: number
  setCurrentPage: (page: number) => void
}

const BookTable = ({ mode, currentPage, setCurrentPage }: BookTableProps) => {
  const filterFunction = useFilterFunction<Book>(mode)
  const { hasPatterns: authorHasPatterns } = useSearchContext('author')
  const { hasPatterns: titleHasPatterns } = useSearchContext('title')
  const hasPatterns = authorHasPatterns || titleHasPatterns
  const filtered = hasPatterns ? books.filter(filterFunction) : books

  const dataSource: BookRow[] = filtered.map((book, i) => ({ ...book, key: String(i) }))

  const columns: TableColumnsType<BookRow> = [
    {
      title: 'Author',
      dataIndex: 'author',
      render: (author: string) => (
        <HighlightedText text={author} searchNames="author" />
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      render: (title: string) => (
        <HighlightedText text={title} searchNames="title" />
      ),
    },
    {
      title: 'Year',
      dataIndex: 'year',
      width: 80,
    },
  ]

  return (
    <>
      {hasPatterns && (
        <p style={{ color: '#666', fontSize: 13, margin: '0 0 12px' }}>
          {filtered.length} of {books.length} books
        </p>
      )}
      <Table<BookRow>
        dataSource={dataSource}
        columns={columns}
        pagination={{
          pageSize: 10,
          current: currentPage,
          onChange: setCurrentPage,
        }}
      />
    </>
  )
}

const BookSearchWrapper = () => {
  const [mode, setMode] = useState<'AND' | 'OR'>('AND')
  const [currentPage, setCurrentPage] = useState(1)

  const resetPage = () => setCurrentPage(1)

  return (
    <WithSearch name="author" mapping={(b: Book) => b.author} onChange={resetPage}>
      <WithSearch name="title" mapping={(b: Book) => b.title} onChange={resetPage}>
        <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 800 }}>
          <h2 style={{ marginTop: 0 }}>Classical Book Search</h2>
          <Space style={{ marginBottom: 12 }} wrap>
            <SearchInput
              name="author"
              placeholder="Search for author"
              style={{ width: 220 }}
            />
            <Space>
              <span style={{ fontSize: 13 }}>AND</span>
              <Switch
                checked={mode === 'OR'}
                onChange={checked => setMode(checked ? 'OR' : 'AND')}
                size="small"
              />
              <span style={{ fontSize: 13 }}>OR</span>
            </Space>
            <SearchInput
              name="title"
              placeholder="Search for title"
              style={{ width: 220 }}
            />
          </Space>
          <BookTable mode={mode} currentPage={currentPage} setCurrentPage={setCurrentPage} />
        </div>
      </WithSearch>
    </WithSearch>
  )
}

export const Default: StoryObj = {
  render: () => <BookSearchWrapper />,
}
