import { describe, it, expect } from 'vitest'
import { SEARCH_FIELDS_VERSION, searchFieldsVersion } from './version'
import { computeSearchFields } from './computeSearchFields'
import type { MongoSearchConfig } from './config'

const cfg = (extra?: Partial<MongoSearchConfig>): MongoSearchConfig => ({
  targets: { author: { fields: ['author'] } },
  ...extra,
})

describe('searchFieldsVersion', () => {
  it('starts with the code version prefix', () => {
    expect(searchFieldsVersion(cfg()).startsWith(`${SEARCH_FIELDS_VERSION}:`)).toBe(true)
  })

  it('is stable for the same config', () => {
    expect(searchFieldsVersion(cfg())).toBe(searchFieldsVersion(cfg()))
  })

  it('changes when the config changes', () => {
    const a = searchFieldsVersion(cfg())
    const b = searchFieldsVersion(cfg({ ngramSizes: [2, 3, 4] }))
    const c = searchFieldsVersion({ targets: { author: { fields: ['author', 'title'] } } })
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('is order-independent over target keys', () => {
    const x: MongoSearchConfig = { targets: { author: { fields: ['author'] }, title: { fields: ['title'] } } }
    const y: MongoSearchConfig = { targets: { title: { fields: ['title'] }, author: { fields: ['author'] } } }
    expect(searchFieldsVersion(x)).toBe(searchFieldsVersion(y))
  })
})

describe('computeSearchFields version stamp', () => {
  it('stamps _v on the derived namespace block', () => {
    const out = computeSearchFields({ author: 'x' }, cfg()) as any
    expect(out._qt._v).toBe(searchFieldsVersion(cfg()))
  })
})
