import { runLiveSearch, SSE_HEADERS } from './shared'
import type { StreamLiveSearchOptions } from './shared'

export type { StreamLiveSearchOptions }

// Next.js App Router (and any Web/Fetch runtime, e.g. edge): returns a streaming
// Response backed by a ReadableStream. Uses only Web standard APIs, so it has no
// dependency on next.
//
//   import { liveSearchResponse } from '@quaesitor-textus/mongo/next/app'
//   export async function GET(request: Request) {
//     // parse the filter from request.url, build the Mongo filter, then:
//     return liveSearchResponse({ sync, collection, config, filter })
//   }
export function liveSearchResponse(opts: StreamLiveSearchOptions): Response {
  const encoder = new TextEncoder()
  let handle: { stop: () => void } | undefined
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      handle = runLiveSearch(opts, (chunk) => controller.enqueue(encoder.encode(chunk)))
    },
    cancel() {
      handle?.stop()
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}
