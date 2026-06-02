// Framework-agnostic SSE wire helpers.
export function formatSse(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`
}
export function sseComment(text = 'ping'): string {
  return `: ${text}\n\n`
}
