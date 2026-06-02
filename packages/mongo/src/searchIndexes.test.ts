import { describe, it, expect } from 'vitest'
import { searchIndexSpecs } from './searchIndexes'

describe('searchIndexSpecs', () => {
  it('one multikey index per target', () => {
    const specs = searchIndexSpecs({ targets: { author: { fields: ['author'] }, title: { fields: ['title'] } } })
    expect(specs).toEqual([
      { key: { '_qt.author.ngrams': 1 }, name: '_qt_author_ngrams' },
      { key: { '_qt.title.ngrams': 1 },  name: '_qt_title_ngrams'  },
    ])
  })
})
