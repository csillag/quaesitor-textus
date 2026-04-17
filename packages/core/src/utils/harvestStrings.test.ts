import { describe, it, expect } from 'vitest'
import { harvestStrings } from './harvestStrings'

describe('harvestStrings', () => {
  it('returns string wrapped in array', () => {
    expect(harvestStrings('hello')).toEqual(['hello'])
  })
  it('coerces number to string', () => {
    expect(harvestStrings(42)).toEqual(['42'])
  })
  it('coerces boolean to string', () => {
    expect(harvestStrings(true)).toEqual(['true'])
  })
  it('returns empty array for null', () => {
    expect(harvestStrings(null)).toEqual([])
  })
  it('returns empty array for undefined', () => {
    expect(harvestStrings(undefined)).toEqual([])
  })
  it('flattens a string array', () => {
    expect(harvestStrings(['foo', 'bar'])).toEqual(['foo', 'bar'])
  })
  it('flattens nested arrays', () => {
    expect(harvestStrings(['foo', ['bar', 'baz']])).toEqual(['foo', 'bar', 'baz'])
  })
  it('harvests leaf values from an object', () => {
    expect(harvestStrings({ name: 'Alice', age: 30 })).toEqual(['Alice', '30'])
  })
  it('skips nullish values in objects', () => {
    expect(harvestStrings({ name: 'Alice', alias: null })).toEqual(['Alice'])
  })
  it('recursively harvests nested objects', () => {
    expect(harvestStrings({ meta: { title: 'T', count: 1 } })).toEqual(['T', '1'])
  })
  it('handles mixed array of primitives and objects', () => {
    expect(harvestStrings([{ name: 'Alice' }, 'extra'])).toEqual(['Alice', 'extra'])
  })
})
