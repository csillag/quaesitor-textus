import type { Collection, Document, Filter } from 'mongodb'
import type { IncomingMessage, ServerResponse } from 'http'
import type { MongoSearchConfig } from '../config'
import type { SearchSync } from '../startSearchSync'
import { createLiveSearch } from '../createLiveSearch'
import type { HighlightSpec } from '../computeHighlights'
import { formatSse, sseComment } from '../sse'

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

export interface StreamLiveSearchOptions {
  sync: SearchSync
  collection: Collection
  config: MongoSearchConfig
  filter: Filter<Document>
  sort?: { field: string; dir: 1 | -1 }
  cap?: number
  /** Forwarded to createLiveSearch: out-of-band highlight specs to annotate records. */
  highlightSpecs?: HighlightSpec[]
  /** Forwarded to createLiveSearch: mongo projection for snapshot + match lookups. */
  projection?: Document
  heartbeatMs?: number
}

// Core wiring shared by every adapter: pipe a live search to a write() sink and
// run a heartbeat. Returns stop() (clears the heartbeat + detaches the watcher
// listener). All search behavior lives in createLiveSearch; adapters only own
// their framework's headers and disconnect signal.
export function runLiveSearch(
  opts: StreamLiveSearchOptions,
  write: (chunk: string) => void,
): { stop: () => void } {
  const sendEvent = (e: unknown) => write(formatSse(e))
  const live = createLiveSearch({
    sync: opts.sync,
    collection: opts.collection,
    config: opts.config,
    filter: opts.filter,
    sort: opts.sort,
    cap: opts.cap,
    highlightSpecs: opts.highlightSpecs,
    projection: opts.projection,
    sendEvent,
  })
  const hb = setInterval(() => write(sseComment()), opts.heartbeatMs ?? 25000)
  return {
    stop: () => {
      clearInterval(hb)
      live.stop()
    },
  }
}

// Adapter for any Node http-style response — Express and Next.js Pages Router
// pass objects that are subtypes of IncomingMessage/ServerResponse.
export function streamToNodeResponse(
  req: IncomingMessage,
  res: ServerResponse,
  opts: StreamLiveSearchOptions,
): void {
  res.writeHead(200, SSE_HEADERS)
  const { stop } = runLiveSearch(opts, (chunk) => res.write(chunk))
  req.on('close', stop)
}
