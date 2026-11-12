import { describe, expect, it } from 'vitest'
import { secondsLeft } from './countdown'

const due = Date.parse('2026-10-01T04:13:05Z')

describe('secondsLeft', () => {
  it('округляет вверх и не уходит в минус', () => {
    expect(secondsLeft(due, due - 60000)).toBe(60)
    expect(secondsLeft(due, due - 999)).toBe(1)
    expect(secondsLeft(due, due)).toBe(0)
    expect(secondsLeft(due, due + 5000)).toBe(0)
  })

  it('пока время сервера неизвестно или дата некорректна, значения нет', () => {
    expect(secondsLeft(due, null)).toBeNull()
    expect(secondsLeft(NaN, due)).toBeNull()
  })
})