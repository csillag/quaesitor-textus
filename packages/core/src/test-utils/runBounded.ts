import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import ts from 'typescript'

export interface BoundedOptions {
  /** Wall-clock limit for the call, worker start-up included. Below vitest's 5 s test timeout. */
  timeoutMs?: number
  /** V8 old-generation heap limit of the worker, in MB. */
  heapMb?: number
}

// Runs in the worker (CommonJS). The resolve hook adds the `.ts` extension the
// sources' relative imports leave out; the load hook serves the transpiled sources.
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const { registerHooks } = require('node:module')
process.removeAllListeners('warning')
registerHooks({
  resolve(specifier, context, nextResolve) {
    const extensionless = /^\\.\\.?\\//.test(specifier) && !/\\.[a-z]+$/i.test(specifier)
    return nextResolve(extensionless ? specifier + '.ts' : specifier, context)
  },
  load(url, context, nextLoad) {
    const source = workerData.sources[url]
    return source === undefined ? nextLoad(url, context) : { format: 'module', source, shortCircuit: true }
  },
})
import(workerData.url)
  .then((mod) => mod[workerData.exportName](...workerData.args))
  .then(
    (value) => parentPort.postMessage({ ok: true, value }),
    (error) => parentPort.postMessage({ ok: false, error: String((error && error.stack) || error) }),
  )
`

const transpiled = new Map<string, Record<string, string>>()

/** The non-test .ts modules of `dir`, transpiled to JS, by file URL. */
function sourcesOf(dir: string): Record<string, string> {
  let sources = transpiled.get(dir)
  if (!sources) {
    sources = {}
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts') || name.endsWith('.d.ts')) continue
      const path = join(dir, name)
      sources[pathToFileURL(path).href] = ts.transpileModule(readFileSync(path, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
      }).outputText
    }
    transpiled.set(dir, sources)
  }
  return sources
}

/**
 * Calls the export `exportName` of the TypeScript module at `modulePath` with
 * `args` in a worker thread, and resolves with its return value (structured-cloned).
 * Rejects when the call throws, runs out of heap or does not return in time, so
 * a runaway loop fails the test instead of hanging the suite.
 *
 * The module may import only modules in its own directory: those are the ones
 * transpiled for the worker.
 */
export function runBounded<T>(
  modulePath: string,
  exportName: string,
  args: unknown[],
  { timeoutMs = 3000, heapMb = 32 }: BoundedOptions = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: {
        url: pathToFileURL(modulePath).href,
        exportName,
        args,
        sources: sourcesOf(dirname(modulePath)),
      },
      resourceLimits: { maxOldGenerationSizeMb: heapMb },
    })
    const finish = (settle: () => void) => {
      clearTimeout(timer)
      void worker.terminate()
      settle()
    }
    const timer = setTimeout(
      () => finish(() => reject(new Error(`${exportName} did not return within ${timeoutMs} ms`))),
      timeoutMs,
    )
    worker.once('message', (m: { ok: boolean; value?: T; error?: string }) =>
      finish(() => (m.ok ? resolve(m.value as T) : reject(new Error(m.error)))),
    )
    worker.once('error', (error) => finish(() => reject(error)))
    worker.once('exit', (code) =>
      finish(() => reject(new Error(`${exportName}: worker exited (code ${code}) without a result`))),
    )
  })
}
