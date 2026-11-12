import { describe, expect, it } from 'vitest'
import { createServerClock } from './serverClock'

const base = Date.parse('2026-10-01T04:12:09Z')

describe('server clock', () => {
  it('до синхронизации времени нет', () => {
    expect(createServerClock(() => 0).now()).toBeNull()
  })

  it('время идёт по монотонным часам от точки синхронизации', () => {
    let t = 1000
    const clock = createServerClock(() => t)
    clock.sync(base)
    t = 3500
    expect(clock.now()).toBe(base + 2500)
  })

  it('повторная синхронизация подтягивает время вперёд', () => {
    let t = 0
    const clock = createServerClock(() => t)
    clock.sync(base)
    t = 5000
    clock.sync(base + 5200)
    expect(clock.now()).toBe(base + 5200)
  })

  it('время не идёт назад при более раннем замере', () => {
    let t = 0
    const clock = createServerClock(() => t)
    clock.sync(base)
    t = 10000
    expect(clock.now()).toBe(base + 10000)
    clock.sync(base + 9000)
    expect(clock.now()).toBe(base + 10000)
  })
})