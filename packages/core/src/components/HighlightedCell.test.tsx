import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HighlightedCell } from './HighlightedCell'
import { WithSearch } from '../context/WithSearch'

describe('HighlightedCell', () => {
  it('highlights a flagged field using the sidecar tokens (data-driven)', () => {
    const record = { title: 'War and Peace', _highlights: { title: { tokens: ['war'], fields: ['title'] } } }
    const { container } = render(<HighlightedCell record={record} field="title" searchNames="title" />)
    expect(container.querySelector('mark')?.textContent).toBe('War')
  })

  it('renders plain text for a field not flagged in the sidecar', () => {
    const record = { author: 'Tolstoy', _highlights: { title: { tokens: ['war'], fields: ['title'] } } }
    const { container } = render(<HighlightedCell record={record} field="author" searchNames="title" />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('Tolstoy')
  })

  it('renders plain text when the searchName has no sidecar entry', () => {
    const record = { title: 'War', _highlights: {} }
    const { container } = render(<HighlightedCell record={record} field="title" searchNames="title" />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('War')
  })

  it('unions highlights from multiple searches (per-field + global)', () => {
    const record = {
      title: 'War and Peace',
      _highlights: {
        title: { tokens: ['war'], fields: ['title'] },
        global: { tokens: ['peace'], fields: ['title', 'author'] },
      },
    }
    const { container } = render(
      <HighlightedCell record={record} field="title" searchNames={['title', 'global']} />
    )
    const marks = [...container.querySelectorAll('mark')].map(m => m.textContent)
    expect(marks).toContain('War')
    expect(marks).toContain('Peace')
  })

  it('only applies a search whose fields include this cell field', () => {
    const record = {
      author: 'Leo Tolstoy',
      _highlights: {
        title: { tokens: ['war'], fields: ['title'] },        // not this field
        global: { tokens: ['tolstoy'], fields: ['title', 'author'] },
      },
    }
    const { container } = render(
      <HighlightedCell record={record} field="author" searchNames={['title', 'global']} />
    )
    const marks = [...container.querySelectorAll('mark')].map(m => m.textContent)
    expect(marks).toEqual(['Tolstoy']) // only the global search reaches the author field
  })

  it('all=true unions every search in the sidecar', () => {
    const record = {
      title: 'War and Peace',
      _highlights: {
        title: { tokens: ['war'], fields: ['title'] },
        global: { tokens: ['peace'], fields: ['title'] },
      },
    }
    const { container } = render(<HighlightedCell record={record} field="title" all />)
    const marks = [...container.querySelectorAll('mark')].map(m => m.textContent)
    expect(marks).toContain('War')
    expect(marks).toContain('Peace')
  })

  it('falls back to context-driven highlighting when the record has no _highlights', () => {
    const record = { title: 'War and Peace' }
    const { container } = render(
      <WithSearch name="title" query="war" onSetQuery={() => {}}>
        <HighlightedCell record={record} field="title" searchNames="title" />
      </WithSearch>
    )
    expect(container.querySelector('mark')?.textContent).toBe('War')
  })
})
