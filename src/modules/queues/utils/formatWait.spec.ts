import { describe, expect, it } from 'vitest'
import { formatWait } from './formatWait'

describe('formatWait', () => {
  it('секунды, минуты и их сочетание', () => {
    expect(formatWait(0)).toBe('0 с')
    expect(formatWait(45)).toBe('45 с')
    expect(formatWait(60)).toBe('1 мин')
    expect(formatWait(90)).toBe('1 мин 30 с')
    expect(formatWait(605)).toBe('10 мин 5 с')
  })

  it('некорректное значение не ломает экран', () => {
    expect(formatWait(NaN)).toBe('—')
    expect(formatWait(-5)).toBe('—')
  })
})