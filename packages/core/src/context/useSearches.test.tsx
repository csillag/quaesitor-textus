import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WithSearch } from './WithSearch'
import { useSearches } from './useSearches'

// Renders the full map: each name with its current patterns, plus a setter so we
// can drive a query and assert the map reflects it reactively.
const MapView = () => {
  const map = useSearches()
  const names = Object.keys(map).sort()
  return (
    <div>
      <div data-testid="names">{names.join(',')}</div>
      {names.map((n) => (
        <div key={n} data-testid={`patterns-${n}`}>{map[n].patterns.join(',')}</div>
      ))}
      <button
        data-testid="set-title"
        onClick={() => map.title?.setQuery('war')}
      >set</button>
    </div>
  )
}

describe('useSearches', () => {
  it('returns an empty object when no WithSearch is present', () => {
    render(<MapView />)
    expect(screen.getByTestId('names')).toHaveTextContent('')
  })

  it('exposes every named entry from a multi-search WithSearch', () => {
    render(
      <WithSearch searches={[{ name: 'author', field: 'author' }, { name: 'title', field: 'title' }]}>
        <MapView />
      </WithSearch>,
    )
    expect(screen.getByTestId('names')).toHaveTextContent('author,title')
  })

  it('reflects query changes reactively (patterns update via the map setter)', () => {
    render(
      <WithSearch searches={[{ name: 'title', field: 'title' }]}>
        <MapView />
      </WithSearch>,
    )
    expect(screen.getByTestId('patterns-title')).toHaveTextContent('')
    fireEvent.click(screen.getByTestId('set-title'))
    expect(screen.getByTestId('patterns-title')).toHaveTextContent('war')
  })
})
