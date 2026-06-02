import Fastify from 'fastify'
import { MongoClient } from 'mongodb'
import { createSearchIndexes, startSearchSync } from '@quaesitor-textus/mongo'
import { demoConfig } from '../shared/config'
import { predicateToMongo } from '../shared/predicateToMongo'
import type { DemoPredicate } from '../shared/predicate'
import { generateBooks, TOTAL_BOOKS, TRUCK_SIZE } from '../shared/generator'

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
  startSearchSync(col, demoConfig, {
    onEvent: (e) => {
      if (e.type === 'indexing-started') app.log.info('search-sync: indexing started')
      else app.log.info(`search-sync: indexing finished — ${e.count} document(s) in ${e.durationMs}ms`)
    },
  })

  app.get('/api/books', async (req) => {
    const q = req.query as Record<string, string>
    const page = Math.max(1, Number(q.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 10)))
    const filter = q.filter
      ? predicateToMongo(JSON.parse(q.filter) as DemoPredicate, demoConfig)
      : {}
    const [items, total] = await Promise.all([
      col.find(filter).skip((page - 1) * pageSize).limit(pageSize).toArray(),
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
    return { inserted: total - n, total }
  })

  await app.listen({ port: PORT, host: '0.0.0.0' })
}

main().catch(err => { console.error(err); process.exit(1) })
