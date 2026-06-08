import type { MongoSearchConfig } from '@quaesitor-textus/mongo'

export const DEMO_NAMESPACE = '_qt'
export const demoConfig: MongoSearchConfig = {
  namespace: DEMO_NAMESPACE,
  ngramSizes: [2, 3],
  targets: {
    author: { fields: ['author'], queryModes: [{ caseSensitive: true }] },
    title:  { fields: ['title'],  queryModes: [{ caseSensitive: true }] },
    // Global "find anywhere" search across both fields (one multi-field target).
    global: { fields: ['author', 'title'] },
  },
}
