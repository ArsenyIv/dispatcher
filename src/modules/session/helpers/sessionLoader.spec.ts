import { describe, expect, it } from 'vitest'
import type { Me } from '@/modules/contract'
import { startSessionLoader } from './sessionLoader'

const me: Me = {
  user_id: 'u-7',
  name: 'Иванова А. С.',
  role: 'dispatcher',
  site: { name: 'Площадка 3', tz: 'Asia/Krasnoyarsk' },
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

function setup(results: Array<Me | Error>) {
  const delays: number[] = []
  const timers: Array<() => void> = []
  const ready: Me[] = []
  const errors: number[] = []
  let call = 0
  const loader = startSessionLoader({
    fetchMe: async () => {
      const result = results[Math.min(call, results.length - 1)]
      call += 1
      if (result === undefined || result instanceof Error) throw result ?? new Error('нет результата')
      return result
    },
    onReady: (value) => {
      ready.push(value)
    },
    onError: (_error, attempt) => {
      errors.push(attempt)
    },
    setTimeout: (fn, ms) => {
      delays.push(ms)
      timers.push(fn)
      return timers.length
    },
    clearTimeout: () => {},
  })
  return { loader, delays, timers, ready, errors }
}

describe('загрузка сессии', () => {
  it('успех с первой попытки', async () => {
    const t = setup([me])
    await flush()
    expect(t.ready).toEqual([me])
    expect(t.delays).toEqual([])
  })

  it('ошибки повторяются с нарастающей паузой', async () => {
    const t = setup([new Error('нет связи'), new Error('нет связи'), me])
    await flush()
    expect(t.errors).toEqual([1])
    expect(t.delays).toEqual([1000])
    t.timers.shift()?.()
    await flush()
    expect(t.errors).toEqual([1, 2])
    expect(t.delays).toEqual([1000, 2000])
    t.timers.shift()?.()
    await flush()
    expect(t.ready).toEqual([me])
  })

  it('пауза не превышает 15 секунд', async () => {
    const t = setup([new Error('нет связи')])
    await flush()
    for (let i = 0; i < 5; i++) {
      t.timers.shift()?.()
      await flush()
    }
    expect(t.delays).toEqual([1000, 2000, 4000, 8000, 15000, 15000])
  })

  it('после stop повторы не выполняются', async () => {
    const t = setup([new Error('нет связи'), me])
    await flush()
    t.loader.stop()
    t.timers.shift()?.()
    await flush()
    expect(t.ready).toEqual([])
  })
})