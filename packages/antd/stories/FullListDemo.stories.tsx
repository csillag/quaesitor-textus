import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { Table } from 'antd'
import type { TableColumnsType } from 'antd'
import { WithSearch, HighlightedText, useSearchContext } from '@quaesitor-textus/core'
import { SearchInput } from '../src'
import { phrases } from './data/phrases'

const meta: Meta = {
  title: 'Antd/FullListDemo',
}

export default meta

type PhraseRow = { key: string; phrase: string }

interface FullListProps {
  currentPage: number
  setCurrentPage: (page: number) => void
}

const FullList = ({ currentPage, setCurrentPage }: FullListProps) => {
  const { executeSearch, patterns, hasPatterns, reset } = useSearchContext()
  const filtered = executeSearch(phrases, item => item)

  const dataSource: PhraseRow[] = filtered.map(phrase => ({ key: phrase, phrase }))

  const cols: TableColumnsType<PhraseRow> = [
    {
      title: 'Phrase',
      dataIndex: 'phrase',
      render: (phrase: string) => <HighlightedText text={phrase} patterns={patterns} />,
    },
  ]

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo (antd)</h2>
      <SearchInput placeholder="Search phrases…" autoFocus />
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            {filtered.length} of {phrases.length} phrases
          </p>
          <Table<PhraseRow>
            dataSource={dataSource}
            columns={cols}
            pagination={{
              pageSize: 15,
              current: currentPage,
              onChange: setCurrentPage,
            }}
            locale={{
              emptyText: (
                <span style={{ color: '#999', fontStyle: 'italic' }}>
                  No results —{' '}
                  <span
                    onClick={reset}
                    style={{ textDecoration: 'underline', color: '#1677ff', cursor: 'pointer' }}
                  >
                    try a different term
                  </span>
                </span>
              ),
            }}
          />
        </>
      )}
    </div>
  )
}

const FullListWrapper = () => {
  const [currentPage, setCurrentPage] = useState(1)
  return (
    {/* Reset to page 1 whenever the search query changes (old/new values not needed here) */}
    <WithSearch onChange={() => setCurrentPage(1)}>
      <FullList currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </WithSearch>
  )
}

export const Default: StoryObj = {
  render: () => <FullListWrapper />,
}
