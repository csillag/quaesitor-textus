import { describe, it, expect } from 'vitest'
import { formatSse, sseComment } from './sse'

describe('sse', () => {
  it('formats a data event with trailing blank line', () => {
    expect(formatSse({ type: 'match', item: { _id: 'x' } })).toBe('data: {"type":"match","item":{"_id":"x"}}\n\n')
  })
  it('formats a heartbeat comment', () => {
    expect(sseComment()).toBe(': ping\n\n')
  })
})
