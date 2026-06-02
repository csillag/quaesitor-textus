import type { FastifyReply, FastifyRequest } from 'fastify'
import { runLiveSearch, SSE_HEADERS } from './shared'
import type { StreamLiveSearchOptions } from './shared'

export type { StreamLiveSearchOptions }

// Stream a live search to a Fastify reply as Server-Sent Events. Fastify needs
// `reply.hijack()` so it does not try to send its own response; everything else
// is the shared wiring.
export function streamLiveSearch(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: StreamLiveSearchOptions,
): void {
  reply.raw.writeHead(200, SSE_HEADERS)
  reply.hijack()
  const { stop } = runLiveSearch(opts, (chunk) => reply.raw.write(chunk))
  request.raw.on('close', stop)
}
