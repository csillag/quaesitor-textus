import { describe, it, expect } from 'vitest'
import { buildCorpus } from './buildCorpus'

describe('buildCorpus', () => {
  it('joins multiple fields with a space', () => {
    expect(buildCorpus({ a: 'foo', b: 'bar' }, ['a', 'b'])).toBe('foo bar')
  })
  it('deep-harvests nested objects and arrays', () => {
    expect(buildCorpus({ a: { x: ['p', 'q'] } }, ['a'])).toBe('p q')
  })
  it('drops empty/missing fields', () => {
    expect(buildCorpus({ a: 'foo' }, ['a', 'missing'])).toBe('foo')
  })
  it('supports the $ root path', () => {
    expect(buildCorpus('hi', ['$'])).toBe('hi')
  })
})
