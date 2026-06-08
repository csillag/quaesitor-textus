import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HighlightedCell } from './HighlightedCell'
import { WithSearch } from '../context/WithSearch'

describe('HighlightedCell', () => {
  it('highlights a flagged field using the sidecar tokens (data-driven)', () => {
    const record = { title: 'War and Peace', _highlights: { title: { tokens: ['war'], fields: ['title'] } } }
    const { container } = render(<HighlightedCell record={record} field="title" searchName="title" />)
    expect(container.querySelector('mark')?.textContent).toBe('War')
  })

  it('renders plain text for a field not flagged in the sidecar', () => {
    const record = { author: 'Tolstoy', _highlights: { title: { tokens: ['war'], fields: ['title'] } } }
    const { container } = render(<HighlightedCell record={record} field="author" searchName="title" />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('Tolstoy')
  })

  it('renders plain text when the searchName has no sidecar entry', () => {
    const record = { title: 'War', _highlights: {} }
    const { container } = render(<HighlightedCell record={record} field="title" searchName="title" />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('War')
  })

  it('falls back to context-driven highlighting when the record has no _highlights', () => {
    const record = { title: 'War and Peace' }
    const { container } = render(
      <WithSearch name="title" query="war" onSetQuery={() => {}}>
        <HighlightedCell record={record} field="title" searchName="title" />
      </WithSearch>
    )
    expect(container.querySelector('mark')?.textContent).toBe('War')
  })
})
