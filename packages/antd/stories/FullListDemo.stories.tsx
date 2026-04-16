import type { Meta, StoryObj } from '@storybook/react'
import React, { useState, useEffect } from 'react'
import { Table, Card } from 'antd'
import type { TableColumnsType } from 'antd'
import { WithSearch, HighlightedTrimmedText, useSearchContext, useFilterFunction } from '@quaesitor-textus/core'
import { SearchInput } from '../src'
import { sentences } from './data/sentences'

const meta: Meta = {
  title: 'Antd/FullListDemo',
}

export default meta

type SentenceRow = { key: string; sentence: string }

interface FullListProps {
  currentPage: number
  setCurrentPage: (page: number) => void
}

const FullList = ({ currentPage, setCurrentPage }: FullListProps) => {
  const { hasPatterns, reset } = useSearchContext()
  const filterFunction = useFilterFunction<string>()
  const filtered = sentences.filter(filterFunction)
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null)

  useEffect(() => {
    if (selectedSentence !== null) {
      if (!(filtered.length === 1 && filtered[0] === selectedSentence)) {
        setSelectedSentence(null)
      }
    }
  }, [filtered, selectedSentence])

  const dataSource: SentenceRow[] = filtered.map(sentence => ({ key: sentence, sentence }))

  const cols: TableColumnsType<SentenceRow> = [
    {
      title: 'Sentence',
      dataIndex: 'sentence',
      render: (sentence: string) => (
        <HighlightedTrimmedText text={sentence} fragmentLength={40} all />
      ),
    },
  ]

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>quaesitor-textus demo (antd)</h2>
      <SearchInput
        placeholder="Search sentences…"
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter' && filtered.length === 1) {
            setSelectedSentence(filtered[0])
          }
        }}
      />
      {hasPatterns && (
        <>
          <p style={{ color: '#666', fontSize: 13 }}>
            matches: {filtered.length} of {sentences.length} sentences
          </p>
          <Table<SentenceRow>
            dataSource={dataSource}
            columns={cols}
            pagination={{
              pageSize: 8,
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
          {selectedSentence !== null && (
            <Card style={{ marginTop: 16, borderRadius: 12 }}>
              {selectedSentence}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

const FullListWrapper = () => {
  const [currentPage, setCurrentPage] = useState(1)
  return (
    <WithSearch
      onChange={() => setCurrentPage(1)}
    >
      <FullList currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </WithSearch>
  )
}

export const Default: StoryObj = {
  render: () => <FullListWrapper />,
}
