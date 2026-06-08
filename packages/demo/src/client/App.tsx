import React, { useEffect, useMemo, useState } from 'react'
import { Tabs, Switch, Space, Slider, Checkbox, Button, Select, Typography } from 'antd'
import { WithSearch, SearchInput, useSearchContext } from '@quaesitor-textus/core'
import { and, or, text, yearRange } from '../shared/predicate'
import type { DemoPredicate } from '../shared/predicate'
import { truckload, nextTruck } from './api'
import { QueryTab } from './QueryTab'
import { StreamTab } from './StreamTab'

const YEAR_MIN = -800
const YEAR_MAX = 2024
export type Sort = { field: 'year' | 'author' | 'title'; dir: 'asc' | 'desc' }

function DemoBody() {
  const { patterns: authorP } = useSearchContext('author')
  const { patterns: titleP } = useSearchContext('title')
  const { patterns: globalP } = useSearchContext('global')
  const [mode, setMode] = useState<'AND' | 'OR'>('AND')
  const [years, setYears] = useState<[number, number]>([YEAR_MIN, YEAR_MAX])
  const [authorCS, setAuthorCS] = useState(false)
  const [titleCS, setTitleCS] = useState(false)
  const [sort, setSort] = useState<Sort>({ field: 'year', dir: 'asc' })
  const [truckMsg, setTruckMsg] = useState('')
  const [hint, setHint] = useState('')

  const refreshHint = () => nextTruck().then(t =>
    setHint(`next truck — common author: ${t.commonAuthor} · sentinel: ${t.sentinelAuthor} — “${t.sentinelTitle}”`)).catch(() => {})
  useEffect(() => { refreshHint() }, [])

  const onTruck = async () => {
    setTruckMsg('Delivering…')
    const r = await truckload()
    setTruckMsg(`Delivered ${r.inserted}; ${r.total} total (${10000 - r.total} left).`)
    refreshHint()
  }

  const predicate: DemoPredicate = useMemo(() => {
    const fieldNodes: DemoPredicate[] = []
    if (authorP.length) fieldNodes.push(text('author', authorP, authorCS ? { caseSensitive: true } : undefined))
    if (titleP.length) fieldNodes.push(text('title', titleP, titleCS ? { caseSensitive: true } : undefined))
    const yp = yearRange(years[0], years[1])
    // Global broadens (find anywhere); per-field tightens. Combine them with AND.
    const top: DemoPredicate[] = []
    if (globalP.length) top.push(text('global', globalP))
    if (fieldNodes.length) top.push(mode === 'AND' ? and(...fieldNodes) : or(...fieldNodes))
    top.push(yp)
    return top.length === 1 ? top[0] : and(...top)
  }, [authorP, titleP, globalP, mode, years, authorCS, titleCS])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h2>quaesitor-textus — server-side book search (MongoDB)</h2>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={onTruck}>Receive a truckload of new books (1000)</Button>
        <span style={{ color: '#888' }}>{truckMsg}</span>
      </Space>
      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 12 }}>{hint}</div>
      <div style={{ marginBottom: 12 }}>
        <SearchInput name="global" placeholder="Search anywhere (author or title)" style={{ width: 460 }} />
      </div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Space direction="vertical" size={0}>
          <SearchInput name="author" placeholder="Search author" style={{ width: 220 }} />
          <Checkbox checked={authorCS} onChange={e => setAuthorCS(e.target.checked)}>case sensitive</Checkbox>
        </Space>
        <Space><span>AND</span><Switch checked={mode === 'OR'} onChange={c => setMode(c ? 'OR' : 'AND')} size="small" /><span>OR</span></Space>
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
        <span>Sort:</span>
        <Select value={sort.field} style={{ width: 120 }} onChange={(field: Sort['field']) => setSort(s => ({ ...s, field }))}
          options={[{ value: 'year', label: 'Year' }, { value: 'author', label: 'Author' }, { value: 'title', label: 'Title' }]} />
        <Select value={sort.dir} style={{ width: 100 }} onChange={(dir: Sort['dir']) => setSort(s => ({ ...s, dir }))}
          options={[{ value: 'asc', label: 'Asc' }, { value: 'desc', label: 'Desc' }]} />
      </Space>
      <Tabs
        destroyInactiveTabPane
        items={[
          { key: 'query', label: 'Query-based UI', children: <QueryTab predicate={predicate} sort={sort} /> },
          { key: 'stream', label: 'Streaming-based UI', children: <StreamTab predicate={predicate} sort={sort} /> },
        ]}
      />
    </div>
  )
}

const SEARCHES = [
  { name: 'author', field: 'author' },
  { name: 'title', field: 'title' },
  { name: 'global', fields: ['author', 'title'] },
]

export function App() {
  return (
    <WithSearch searches={SEARCHES}>
      <DemoBody />
    </WithSearch>
  )
}
