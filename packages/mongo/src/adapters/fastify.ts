import type { Collection, Document, Filter } from 'mongodb'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { MongoSearchConfig } from '../config'
import type { SearchSync } from '../startSearchSync'
import { createLiveSearch } from '../createLiveSearch'
import { formatSse, sseComment } from '../sse'

export interface StreamLiveSearchOptions {
  sync: SearchSync
  collection: Collection
  config: MongoSearchConfig
  filter: Filter<Document>
  sort?: { field: string; dir: 1 | -1 }
  cap?: number
  heartbeatMs?: number
}

// Stream a live search to a Fastify reply as Server-Sent Events. Transport glue
// only: it owns SSE headers, the heartbeat, and disconnect cleanup; all search
// behavior is in createLiveSearch.
export function streamLiveSearch(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: StreamLiveSearchOptions,
): void {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  reply.hijack() // we own the socket; Fastify must not try to send a reply
  const sendEvent = (e: unknown) => reply.raw.write(formatSse(e))
  const live = createLiveSearch({ ...opts, sendEvent })
  const hb = setInterval(() => reply.raw.write(sseComment()), opts.heartbeatMs ?? 25000)
  request.raw.on('close', () => { clearInterval(hb); live.stop() })
}
