import { describe, expect, it } from 'vitest'
import { newIdempotencyKey } from './idempotencyKey'

describe('Idempotency-Key', () => {
  it('каждый раз новый и непустой', () => {
    const a = newIdempotencyKey()
    const b = newIdempotencyKey()
    expect(a.length).toBeGreaterThanOrEqual(16)
    expect(a).not.toBe(b)
  })
})