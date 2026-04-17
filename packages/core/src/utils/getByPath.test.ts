import { describe, it, expect } from 'vitest'
import { getByPath } from './getByPath'

describe('getByPath', () => {
  it('returns root object for "$"', () => {
    const obj = { name: 'Alice' }
    expect(getByPath(obj, '$')).toBe(obj)
  })
  it('returns a primitive itself for "$"', () => {
    expect(getByPath('hello', '$')).toBe('hello')
  })
  it('returns a top-level field', () => {
    expect(getByPath({ name: 'Alice' }, 'name')).toBe('Alice')
  })
  it('returns a nested field', () => {
    expect(getByPath({ meta: { title: 'T' } }, 'meta.title')).toBe('T')
  })
  it('returns undefined for a missing top-level field', () => {
    expect(getByPath({ name: 'Alice' }, 'missing')).toBeUndefined()
  })
  it('returns undefined when an intermediate node is missing', () => {
    expect(getByPath({ name: 'Alice' }, 'meta.title')).toBeUndefined()
  })
  it('returns undefined when an intermediate node is null', () => {
    expect(getByPath({ meta: null }, 'meta.title')).toBeUndefined()
  })
  it('returns undefined when an intermediate node is a primitive', () => {
    expect(getByPath({ meta: 'string' }, 'meta.title')).toBeUndefined()
  })
  it('returns an array value without flattening', () => {
    expect(getByPath({ tags: ['a', 'b'] }, 'tags')).toEqual(['a', 'b'])
  })
  it('accesses an array element by numeric string index', () => {
    expect(getByPath({ items: ['a', 'b', 'c'] }, 'items.1')).toBe('b')
  })
  it('returns undefined for null input with any path', () => {
    expect(getByPath(null, 'name')).toBeUndefined()
  })
})
