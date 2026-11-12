import { describe, expect, it } from 'vitest'
import { parseServerMessage } from './parse'

const vehicle = {
  vehicle_id: 'v-17',
  name: 'Т-17',
  x_m: 2410.5,
  y_m: 1180,
  heading_deg: 72,
  speed_kmh: 24.5,
  state: 'moving_empty',
  point_id: 'p-2',
  last_seen: '2026-10-01T04:12:09Z',
}

describe('parseServerMessage', () => {
  it('разбирает сообщение об изменении машины', () => {
    const result = parseServerMessage(
      JSON.stringify({ seq: 5, at: '2026-10-01T04:12:09Z', type: 'vehicle', data: vehicle }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.message.type).toBe('vehicle')
  })

  it('разбирает heartbeat и reset', () => {
    const hb = parseServerMessage('{"type":"heartbeat","seq":9,"at":"2026-10-01T04:12:09Z"}')
    expect(hb).toEqual({
      ok: true,
      message: { type: 'heartbeat', seq: 9, at: '2026-10-01T04:12:09Z' },
    })
    expect(parseServerMessage('{"type":"reset"}')).toEqual({
      ok: true,
      message: { type: 'reset' },
    })
  })

  it('битые данные не теряют seq', () => {
    const result = parseServerMessage(
      JSON.stringify({ seq: 7, at: '2026-10-01T04:12:09Z', type: 'vehicle', data: { vehicle_id: 1 } }),
    )
    expect(result).toEqual({ ok: false, seq: 7, reason: expect.any(String) })
  })

  it('неизвестный тип с seq тоже сохраняет номер', () => {
    const result = parseServerMessage(
      JSON.stringify({ seq: 8, at: '2026-10-01T04:12:09Z', type: 'weather', data: {} }),
    )
    expect(result).toMatchObject({ ok: false, seq: 8 })
  })

  it('невалидный JSON даёт seq null', () => {
    expect(parseServerMessage('{oops')).toMatchObject({ ok: false, seq: null })
  })
})