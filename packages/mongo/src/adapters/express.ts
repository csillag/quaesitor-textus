// Express adapter. Express's Request/Response are subtypes of Node's
// IncomingMessage/ServerResponse, so the shared Node-response adapter accepts
// them directly — no dependency on express itself.
//
//   import { streamLiveSearch } from '@quaesitor-textus/mongo/express'
//   app.get('/api/live', (req, res) => streamLiveSearch(req, res, { sync, collection, config, filter }))
export { streamToNodeResponse as streamLiveSearch } from './shared'
export type { StreamLiveSearchOptions } from './shared'
