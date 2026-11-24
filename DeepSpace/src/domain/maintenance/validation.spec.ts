import { describe, expect, it } from 'vitest'
import { checklist, enumValue, isoDateOrEmpty, stableStringify, textRange } from './validation'

describe('MaintenanceFlow domain validation', () => {
  it('accepts a bounded checklist and rejects malformed items', () => {
    expect(checklist([{ id: 'seal', label: 'Inspect seal', completed: false, origin: 'supervisor' }])).toEqual([
      { id: 'seal', label: 'Inspect seal', completed: false, origin: 'supervisor' },
    ])
    expect(checklist([{ id: 'bad', label: 'x', completed: false, origin: 'customer' }])).toMatchObject({ success: false })
  })

  it('normalizes dates and rejects invalid enum values', () => {
    expect(isoDateOrEmpty('2026-11-23T10:00:00-05:00', 'dueAt')).toBe('2026-11-23T15:00:00.000Z')
    expect(isoDateOrEmpty('not-a-date', 'dueAt')).toMatchObject({ success: false })
    expect(enumValue('critical', 'priority', ['low', 'medium', 'high', 'critical'] as const)).toBe('critical')
    expect(enumValue('urgent', 'priority', ['low', 'medium', 'high', 'critical'] as const)).toMatchObject({ success: false })
  })

  it('creates deterministic canonical command input for fingerprints', () => {
    expect(stableStringify({ z: 1, a: { d: false, c: true } })).toBe('{"a":{"c":true,"d":false},"z":1}')
  })

  it('enforces the product bounds for text and checklist items', () => {
    expect(textRange('abc', 'title', 5, 120)).toMatchObject({ success: false })
    expect(textRange('valid title', 'title', 5, 120)).toBe('valid title')
    expect(checklist(Array.from({ length: 9 }, (_, index) => ({ id: String(index), label: 'Item label', completed: false, origin: 'technician' })))).toMatchObject({ success: false })
  })
})
