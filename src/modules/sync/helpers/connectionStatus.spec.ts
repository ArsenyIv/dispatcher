import { describe, expect, it } from 'vitest'
import { deriveStatus } from './connectionStatus'

const base = { startedAt: 0, staleAfterMs: 15000 }

describe('deriveStatus', () => {
  it('открыт и данные свежие: подключено', () => {
    expect(deriveStatus({ ...base, open: true, lastFrameAt: 900, now: 1000 })).toBe('live')
  })

  it('не открыт, данные недавно были: переподключение', () => {
    expect(deriveStatus({ ...base, open: false, lastFrameAt: 900, now: 1000 })).toBe('reconnecting')
  })

  it('данных нет дольше порога: устарели, даже если сокет открыт', () => {
    expect(deriveStatus({ ...base, open: true, lastFrameAt: 0, now: 16000 })).toBe('stale')
  })

  it('данных ещё не было: сначала переподключение, потом устарели', () => {
    expect(deriveStatus({ ...base, open: false, lastFrameAt: null, now: 5000 })).toBe('reconnecting')
    expect(deriveStatus({ ...base, open: false, lastFrameAt: null, now: 16000 })).toBe('stale')
  })
})