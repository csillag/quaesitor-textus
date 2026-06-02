import React, { useEffect, useMemo, useState } from 'react'
import { Table, Switch, Space, Slider, Checkbox, Button, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  WithSearch, SearchInput, HighlightedText, useSearchContext,
} from '@quaesitor-textus/core'
import { and, or, text, yearRange } from '../shared/predicate'
import type { DemoPredicate } from '../shared/predicate'
import { searchBooks, truckload } from './api'
import type { Book } from '../shared/generator'

const YEAR_MIN = -800
const YEAR_MAX = 2024

function Results({
  mode, years, authorCS, titleCS, refreshKey,
}: { mode: 'AND' | 'OR'; years: [number, number]; authorCS: boolean; titleCS: boolean; refreshKey: number }) {
  const { patterns: authorP } = useSearchContext('author')
  const { patterns: titleP } = useSearchContext('title')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [data, setData] = useState<{ items: Book[]; total: number }>({ items: [], total: 0 })

  const predicate: DemoPredicate = useMemo(() => {
    const textNodes: DemoPredicate[] = []
    if (authorP.length) textNodes.push(text('author', authorP, authorCS ? { caseSensitive: true } : undefined))
    if (titleP.length) textNodes.push(text('title', titleP, titleCS ? { caseSensitive: true } : undefined))
    const yearPart = yearRange(years[0], years[1])
    if (!textNodes.length) return yearPart
    // AND mode: flatten text nodes into the outer AND (no redundant nesting).
    // OR mode: the text nodes must stay grouped under one OR.
    return mode === 'AND'
      ? and(...textNodes, yearPart)
      : and(or(...textNodes), yearPart)
  }, [authorP, titleP, mode, years, authorCS, titleCS])

  useEffect(() => { setPage(1) }, [predicate])
  useEffect(() => {
    let live = true
    searchBooks(predicate, page, pageSize).then(r => { if (live) setData({ items: r.items, total: r.total }) })
    return () => { live = false }
  }, [predicate, page, refreshKey])

  const columns: TableColumnsType<Book> = [
    { title: 'Author', dataIndex: 'author',
      render: (a: string) => <HighlightedText text={a} searchNames="author" /> },
    { title: 'Title', dataIndex: 'title',
      render: (t: string) => <HighlightedText text={t} searchNames="title" /> },
    { title: 'Year', dataIndex: 'year', width: 90 },
  ]
  return (
    <>
      <Typography.Paragraph type="secondary">{data.total} matching books</Typography.Paragraph>
      <Table<Book>
        rowKey="_id"
        dataSource={data.items}
        columns={columns}
        pagination={{ current: page, pageSize, total: data.total, onChange: setPage }}
      />
    </>
  )
}

export function App() {
  const [mode, setMode] = useState<'AND' | 'OR'>('AND')
  const [years, setYears] = useState<[number, number]>([YEAR_MIN, YEAR_MAX])
  const [authorCS, setAuthorCS] = useState(false)
  const [titleCS, setTitleCS] = useState(false)
  const [truckMsg, setTruckMsg] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const onTruck = async () => {
    setTruckMsg('Delivering…')
    const r = await truckload()
    const left = 10000 - r.total
    const hint = r.sampleAuthors.length ? ` New arrivals include: ${r.sampleAuthors.join(', ')}.` : ''
    setTruckMsg(`Delivered ${r.inserted} (${left} left).${hint} Indexing in the background…`)
    // The change-stream watcher derives search fields asynchronously; refresh the
    // results a few times to reflect the newly-searchable books as they land.
    ;[1500, 3500, 6000].forEach(ms => setTimeout(() => setRefreshKey(k => k + 1), ms))
    setTimeout(() => {
      const try3 = r.sampleAuthors.slice(0, 3).join(', ')
      setTruckMsg(
        `${r.total} books loaded${left ? `, ${left} left` : ''} — now searchable.` +
          (try3 ? ` Try searching author: ${try3}.` : ''),
      )
    }, 6200)
  }

  return (
    <WithSearch name="author" field="author">
      <WithSearch name="title" field="title">
        <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 900, margin: '0 auto' }}>
          <h2>quaesitor-textus — server-side book search (MongoDB)</h2>
          <Space wrap style={{ marginBottom: 12 }}>
            <Space direction="vertical" size={0}>
              <SearchInput name="author" placeholder="Search author" style={{ width: 220 }} />
              <Checkbox checked={authorCS} onChange={e => setAuthorCS(e.target.checked)}>case sensitive</Checkbox>
            </Space>
            <Space>
              <span>AND</span>
              <Switch checked={mode === 'OR'} onChange={c => setMode(c ? 'OR' : 'AND')} size="small" />
              <span>OR</span>
            </Space>
            <Space direction="vertical" size={0}>
              <SearchInput name="title" placeholder="Search title" style={{ width: 220 }} />
              <Checkbox checked={titleCS} onChange={e => setTitleCS(e.target.checked)}>case sensitive</Checkbox>
            </Space>
          </Space>
          <div style={{ maxWidth: 400, marginBottom: 12 }}>
            <span>Year: {years[0]} – {years[1]}</span>
            <Slider range min={YEAR_MIN} max={YEAR_MAX} value={years} onChange={v => setYears(v as [number, number])} />
          </div>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" onClick={onTruck}>Receive a truckload of new books (1000)</Button>
            <span style={{ color: '#888' }}>{truckMsg}</span>
          </Space>
          <Results mode={mode} years={years} authorCS={authorCS} titleCS={titleCS} refreshKey={refreshKey} />
        </div>
      </WithSearch>
    </WithSearch>
  )
}
