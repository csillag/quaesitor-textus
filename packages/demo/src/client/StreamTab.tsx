import React, { useEffect, useMemo, useRef, useState } from 'react'
import { List, Typography } from 'antd'
import { HighlightedText } from '@quaesitor-textus/core'
import { liveSearchUrl, searchBooks } from './api'
import { hasTextPattern } from '../shared/predicate'
import type { DemoPredicate } from '../shared/predicate'
import type { Book } from '../shared/generator'
import type { Sort } from './App'

function cmp(a: Book, b: Book, sort: Sort): number {
  const av = a[sort.field] as string | number
  const bv = b[sort.field] as string | number
  let r = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
  return sort.dir === 'desc' ? -r : r
}

export function StreamTab({ predicate, sort }: { predicate: DemoPredicate; sort: Sort }) {
  const active = hasTextPattern(predicate)
  const [items, setItems] = useState<Book[]>([])
  const [capped, setCapped] = useState(false)
  const [emptyTotal, setEmptyTotal] = useState<number | null>(null)
  const seen = useRef<Set<string>>(new Set())

  // Re-sort the displayed list whenever the sort changes.
  const sorted = useMemo(() => [...items].sort((a, b) => cmp(a, b, sort)), [items, sort])

  useEffect(() => {
    seen.current = new Set(); setItems([]); setCapped(false); setEmptyTotal(null)
    if (!active) {
      // No text filter -> don't stream; just show the total count for context.
      searchBooks(predicate, 1, 1).then(r => setEmptyTotal(r.total)).catch(() => {})
      return
    }
    const es = new EventSource(liveSearchUrl(predicate, sort.field, sort.dir))
    const add = (book: Book) => {
      if (seen.current.has(book._id)) return
      seen.current.add(book._id)
      setItems(prev => [...prev, book])
    }
    es.onmessage = (ev) => {
      const e = JSON.parse(ev.data)
      if (e.type === 'snapshot') e.items.forEach(add)
      else if (e.type === 'match') add(e.item)
      else if (e.type === 'capped') setCapped(true)
    }
    return () => es.close()
    // Re-subscribe when the predicate changes; sort changes only re-sort (above),
    // so sort.field/dir are intentionally NOT in the deps for the connection.
  }, [predicate, active])

  if (!active) {
    return <Typography.Paragraph type="secondary">
      Enter an author or title to start the live stream{emptyTotal !== null ? ` (${emptyTotal} books total)` : ''}.
    </Typography.Paragraph>
  }
  return (
    <>
      <Typography.Paragraph type="secondary">
        {sorted.length} matching books (live){capped ? ' — showing first 500' : ''}
      </Typography.Paragraph>
      <List size="small" dataSource={sorted} rowKey={(b) => b._id}
        renderItem={(b) => (
          <List.Item>
            <HighlightedText text={b.author} searchNames="author" />{' — '}
            <HighlightedText text={b.title} searchNames="title" />{' '}
            <span style={{ color: '#999', fontSize: 12 }}>({b.year})</span>
          </List.Item>
        )} />
    </>
  )
}
