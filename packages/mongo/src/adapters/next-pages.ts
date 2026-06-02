// Next.js Pages Router adapter. NextApiRequest/NextApiResponse extend Node's
// http types, so the shared Node-response adapter accepts them directly — no
// dependency on next itself.
//
//   import { streamLiveSearch } from '@quaesitor-textus/mongo/next/pages'
//   export default function handler(req, res) {
//     streamLiveSearch(req, res, { sync, collection, config, filter })
//   }
//   export const config = { api: { responseLimit: false } } // allow long-lived SSE
export { streamToNodeResponse as streamLiveSearch } from './shared'
export type { StreamLiveSearchOptions } from './shared'
