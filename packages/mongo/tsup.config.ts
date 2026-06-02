import { defineConfig } from 'tsup'
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/adapters/fastify.ts',
    'src/adapters/express.ts',
    'src/adapters/next-app.ts',
    'src/adapters/next-pages.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['mongodb', 'fastify', '@quaesitor-textus/core'],
})
