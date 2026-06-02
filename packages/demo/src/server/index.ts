import Fastify from 'fastify'
import { MongoClient } from 'mongodb'
import { createSearchIndexes, startSearchSync, formatSse } from '@quaesitor-textus/mongo'
import { streamLiveSearch } from '@quaesitor-textus/mongo/fastify'
import { demoConfig } from '../shared/config'
import { predicateToMongo } from '../shared/predicateToMongo'
import { hasTextPattern } from '../shared/predicate'
import type { DemoPredicate } from '../shared/predicate'
import { generateBooks, TOTAL_BOOKS, TRUCK_SIZE, batchCommonAuthor, batchSentinel } from '../shared/generator'

const URL = process.env.MONGO_URL ?? 'mongodb://localhost:27018/?directConnection=true'
const PORT = Number(process.env.PORT ?? 3001)

async function main() {
  const client = await MongoClient.connect(URL)
  const col = client.db('demo').collection('books')

  // info-level app logs, pretty-printed, without per-request access-log dumps
  const app = Fastify({
    disableRequestLogging: true,
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    },
  })

  await createSearchIndexes(col, demoConfig)
  const sync = startSearchSync(col, demoConfig)
  sync.on((e) => {
    if (e.type === 'indexing-started') app.log.info('search-sync: indexing started')
    else if (e.type === 'indexing-finished') app.log.info(`search-sync: indexing finished — ${e.count} document(s) in ${e.durationMs}ms`)
  })

  app.get('/api/books', async (req) => {
    const q = req.query as Record<string, string>
    const page = Math.max(1, Number(q.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 10)))
    const filter = q.filter
      ? predicateToMongo(JSON.parse(q.filter) as DemoPredicate, demoConfig)
      : {}
    const sortField = ['year', 'author', 'title'].includes(q.sort) ? q.sort : undefined
    const sortDir = q.dir === 'desc' ? -1 : 1
    const cursor = col.find(filter)
    if (sortField) cursor.sort({ [sortField]: sortDir })
    const [items, total] = await Promise.all([
      cursor.skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
    ])
    return { items, total, page, pageSize }
  })

  app.post('/api/truckload', async () => {
    const n = await col.countDocuments({})
    if (n >= TOTAL_BOOKS) return { inserted: 0, total: n }
    // Insert the next batch RAW (no derived fields) — the watcher fills them in.
    const batch = generateBooks(TOTAL_BOOKS).slice(n, n + TRUCK_SIZE)
    try {
      await col.insertMany(batch as never[], { ordered: false })
    } catch { /* dup-key no-ops on re-click are expected */ }
    const total = await col.countDocuments({})
    // Surface a few distinct authors from this batch so the UI can hint what to
    // search for (this batch's sentinel first when present — it proves the watcher).
    const sentinel = batchSentinel(Math.floor(n / TRUCK_SIZE)).author
    const distinct = [...new Set(batch.map((b) => b.author))]
    const sampleAuthors = (distinct.includes(sentinel)
      ? [sentinel, ...distinct.filter((a) => a !== sentinel)]
      : distinct
    ).slice(0, 6)
    return { inserted: total - n, total, sampleAuthors }
  })

  app.get('/api/live', (request, reply) => {
    const q = request.query as Record<string, string>
    const predicate: DemoPredicate | null = q.filter ? (JSON.parse(q.filter) as DemoPredicate) : null
    if (!predicate || !hasTextPattern(predicate)) {
      reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
      reply.hijack()
      reply.raw.write(formatSse({ type: 'idle' }))
      reply.raw.end()
      return
    }
    const filter = predicateToMongo(predicate, demoConfig)
    const sortField = ['year', 'author', 'title'].includes(q.sort) ? q.sort : undefined
    const sort = sortField ? { field: sortField, dir: (q.dir === 'desc' ? -1 : 1) as 1 | -1 } : undefined
    streamLiveSearch(request, reply, { sync, collection: col, config: demoConfig, filter, sort, cap: 500 })
  })

  app.get('/api/next-truck', async () => {
    const n = await col.countDocuments({})
    const batch = Math.floor(n / TRUCK_SIZE) // n=1000 -> batch 1 (indices 1000..1999)
    const s = batchSentinel(batch)
    return { batch, commonAuthor: batchCommonAuthor(batch), sentinelAuthor: s.author, sentinelTitle: s.title }
  })

  await app.listen({ port: PORT, host: '0.0.0.0' })
}

main().catch(err => { console.error(err); process.exit(1) })
