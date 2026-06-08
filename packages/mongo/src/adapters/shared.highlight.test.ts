import { describe, it, expect } from 'vitest'
import { runLiveSearch } from './shared'
import type { MongoSearchConfig } from '../config'

const config: MongoSearchConfig = { targets: { title: { fields: ['title'] } } }

function stubCollection(snapshot: any[]) {
  return {
    find() { return { sort() { return this }, limit() { return this }, toArray: async () => snapshot } },
    findOne: async () => null,
  } as any
}
const stubSync: any = { on() {}, off() {}, stop: async () => {} }

describe('runLiveSearch highlight forwarding', () => {
  it('forwards highlightSpecs so emitted records carry _highlights in the SSE stream', async () => {
    const col = stubCollection([{ _id: '1', title: 'War', _qt: { title: { norm: 'war' } } }])
    const chunks: string[] = []
    const { stop } = runLiveSearch(
      { sync: stubSync, collection: col, config, filter: {}, highlightSpecs: [{ target: 'title', patterns: ['war'] }] },
      c => chunks.push(c),
    )
    await new Promise(r => setTimeout(r, 10))
    stop()
    const joined = chunks.join('')
    expect(joined).toContain('"_highlights"')
    expect(joined).toContain('"title"')
  })
})
