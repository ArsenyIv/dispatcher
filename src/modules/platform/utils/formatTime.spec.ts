import { describe, expect, it } from 'vitest'
import { formatSiteTime, parseIsoMs } from './formatTime'

const ms = Date.parse('2026-10-01T04:12:09Z')

describe('время в поясе площадки', () => {
  it('показывает время в поясе площадки, а не браузера', () => {
    expect(formatSiteTime(ms, 'Asia/Krasnoyarsk')).toBe('11:12:09')
    expect(formatSiteTime(ms, 'America/New_York')).toBe('00:12:09')
    expect(formatSiteTime(ms, 'UTC')).toBe('04:12:09')
  })

  it('некорректное значение не ломает экран', () => {
    expect(formatSiteTime(NaN, 'UTC')).toBe('—')
  })

  it('разбирает ISO 8601', () => {
    expect(parseIsoMs('2026-10-01T04:12:09Z')).toBe(Date.UTC(2026, 9, 1, 4, 12, 9))
    expect(Number.isNaN(parseIsoMs('не время'))).toBe(true)
  })
})