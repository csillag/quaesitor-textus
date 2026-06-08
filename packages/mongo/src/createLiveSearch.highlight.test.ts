import { describe, it, expect } from 'vitest'
import { createLiveSearch } from './createLiveSearch'
import type { LiveEvent } from './createLiveSearch'
import { buildTextSearchFilter } from './buildTextSearchFilter'
import type { MongoSearchConfig } from './config'

const config: MongoSearchConfig = { targets: { title: { fields: ['title'] }, author: { fields: ['author'] } } }

function stubCollection(snapshot: any[]) {
  const calls: any[] = []
  const collection: any = {
    calls,
    find(filter: any) {
      calls.push(filter)
      return { sort() { return this }, limit() { return this }, toArray: async () => snapshot }
    },
    findOne: async () => null,
  }
  return collection
}
const stubSync: any = { on() {}, off() {}, stop: async () => {} }

describe('createLiveSearch highlight annotation', () => {
  it('annotates snapshot items from highlightSpecs and passes the filter to mongo unchanged', async () => {
    const col = stubCollection([{ _id: '1', title: 'War and Peace', _qt: { title: { norm: 'war and peace' } } }])
    const filter: any = buildTextSearchFilter('title', ['war'], config)
    expect(filter.__qtHighlights).toBeUndefined() // filter is clean now

    const events: LiveEvent[] = []
    createLiveSearch({
      sync: stubSync, collection: col, config, filter,
      highlightSpecs: [{ target: 'title', patterns: ['war'] }],
      sendEvent: e => events.push(e),
    })
    await new Promise(r => setTimeout(r, 10))

    const snap = events.find(e => e.type === 'snapshot') as any
    expect(snap.items[0]._highlights).toEqual({ title: { tokens: ['war'], fields: ['title'] } })
    expect(col.calls[0]).toBe(filter) // filter handed to mongo untouched
  })

  it('annotates from multiple specs (compound query)', async () => {
    const col = stubCollection([{ _id: '1', title: 'War', author: 'Tolstoy', _qt: { title: { norm: 'war' }, author: { norm: 'tolstoy' } } }])
    const events: LiveEvent[] = []
    createLiveSearch({
      sync: stubSync, collection: col, config, filter: { $and: [] },
      highlightSpecs: [{ target: 'title', patterns: ['war'] }, { target: 'author', patterns: ['tolst'] }],
      sendEvent: e => events.push(e),
    })
    await new Promise(r => setTimeout(r, 10))
    const snap = events.find(e => e.type === 'snapshot') as any
    expect(snap.items[0]._highlights).toEqual({
      title: { tokens: ['war'], fields: ['title'] },
      author: { tokens: ['tolst'], fields: ['author'] },
    })
  })

  it('does not annotate when highlightSpecs is omitted', async () => {
    const col = stubCollection([{ _id: '1', title: 'War', _qt: { title: { norm: 'war' } } }])
    const events: LiveEvent[] = []
    createLiveSearch({ sync: stubSync, collection: col, config, filter: buildTextSearchFilter('title', ['war'], config), sendEvent: e => events.push(e) })
    await new Promise(r => setTimeout(r, 10))
    const snap = events.find(e => e.type === 'snapshot') as any
    expect(snap.items[0]._highlights).toBeUndefined()
  })
})
