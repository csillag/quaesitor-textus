import React, { useEffect, useState } from 'react'
import { Table, Button, Typography, Space } from 'antd'
import { searchBooks } from './api'
import { bookColumns } from './bookColumns'
import type { DemoPredicate } from '../shared/predicate'
import type { Book } from '../shared/generator'
import type { Sort } from './App'

export function QueryTab({ predicate, sort }: { predicate: DemoPredicate; sort: Sort }) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [data, setData] = useState<{ items: Book[]; total: number }>({ items: [], total: 0 })
  const [tick, setTick] = useState(0)

  useEffect(() => { setPage(1) }, [predicate, sort])
  useEffect(() => {
    let live = true
    searchBooks(predicate, page, pageSize, sort.field, sort.dir)
      .then(r => { if (live) setData({ items: r.items, total: r.total }) })
    return () => { live = false }
  }, [predicate, sort, page, tick])

  return (
    <>
      <Space style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">{data.total} matching books</Typography.Text>
        <Button size="small" onClick={() => setTick(t => t + 1)}>Refresh</Button>
      </Space>
      <Table<Book> rowKey="_id" dataSource={data.items} columns={bookColumns}
        pagination={{ current: page, pageSize, total: data.total, onChange: setPage }} />
    </>
  )
}
