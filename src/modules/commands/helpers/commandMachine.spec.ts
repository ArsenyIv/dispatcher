import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Decision, Point } from '@/modules/contract'
import { HttpError } from '@/modules/platform'
import { createCommandRunner, decisionTargetKey, pointTargetKey } from './commandMachine'
import type { CommandIntent, CommandState } from './commandMachine'

const AT = '2026-10-01T04:12:09Z'

const decision = (status: Decision['status'] = 'pending', version = 1): Decision => ({
  decision_id: 'd-1',
  vehicle_id: 'v-1',
  from_point: 'p-1',
  to_point: 'p-2',
  gain_s: 10,
  reason: '',
  status,
  created_at: AT,
  execute_at: AT,
  version,
})

const point = (mode: Point['mode'] = 'manual', version = 3): Point => ({
  point_id: 'p-1',
  name: 'Пункт 1',
  x_m: 0,
  y_m: 0,
  mode,
  version,
  queue: [],
})

type Kind = ConstructorParameters<typeof HttpError>[0]
type Step = () => Promise<unknown>
const ok = (body: unknown): Step => () => Promise.resolve(body)
const fail =
  (kind: Kind, status: number | null = null, body: unknown = null): Step =>
  () =>
    Promise.reject(new HttpError(kind, kind, status, body))
const hang: Step = () => new Promise(() => {})
const tick = (ms = 0): Promise<void> => vi.advanceTimersByTimeAsync(ms)

function setup(steps: Step[]) {
  const sent: CommandIntent[] = []
  const states: CommandState[] = []
  const decisionsApplied: Decision[] = []
  const pointsApplied: Point[] = []
  const cleared: string[] = []
  let denied = 0
  let call = 0
  let keyCounter = 0
  const runner = createCommandRunner({
    send: (intent) => {
      sent.push(intent)
      const step = steps[Math.min(call, steps.length - 1)] ?? hang
      call += 1
      return step()
    },
    applyDecision: (d) => {
      decisionsApplied.push(d)
    },
    applyPoint: (p) => {
      pointsApplied.push(p)
    },
    onSessionDenied: () => {
      denied += 1
    },
    onState: (s) => {
      states.push(s)
    },
    onClear: (key) => {
      cleared.push(key)
    },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    newKey: () => `key-${++keyCounter}`,
  })
  const last = (): CommandState | undefined => states[states.length - 1]
  return { runner, sent, decisionsApplied, pointsApplied, cleared, last, denied: () => denied }
}

describe('команды', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('успешная отмена применяет ответ сервера', async () => {
    const t = setup([ok(decision('cancelled', 2))])
    expect(t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })).toBe(true)
    await tick()
    expect(t.sent[0]).toEqual({ kind: 'cancel-decision', targetId: 'd-1', key: 'key-1', ifMatch: 1 })
    expect(t.decisionsApplied).toEqual([decision('cancelled', 2)])
    expect(t.last()).toMatchObject({ status: 'confirmed', message: 'Решение отменено' })
  })

  it('409: применяет актуальное решение и показывает причину', async () => {
    const t = setup([fail('conflict', 409, decision('executed', 3))])
    t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })
    await tick()
    expect(t.decisionsApplied).toEqual([decision('executed', 3)])
    expect(t.last()).toMatchObject({ status: 'conflict', message: 'Решение уже исполнено' })
    expect(t.sent).toHaveLength(1)
  })

  it('403: отказ без повторов и повторный запрос сессии', async () => {
    const t = setup([fail('forbidden', 403, {})])
    t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })
    await tick()
    expect(t.last()?.status).toBe('forbidden')
    expect(t.denied()).toBe(1)
    await tick(20000)
    expect(t.sent).toHaveLength(1)
  })

  it('ответ 400 не повторяется', async () => {
    const t = setup([fail('client', 400, {})])
    t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })
    await tick(20000)
    expect(t.last()?.status).toBe('failed')
    expect(t.sent).toHaveLength(1)
  })

  it('неожиданное тело успешного ответа не применяется', async () => {
    const t = setup([ok({ что: 'то' })])
    t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })
    await tick()
    expect(t.decisionsApplied).toEqual([])
    expect(t.last()?.status).toBe('failed')
  })

  it('при таймауте повторяет запрос с тем же ключом и той же версией', async () => {
    const t = setup([fail('timeout'), ok(decision('cancelled', 2))])
    t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })
    await tick()
    expect(t.last()?.status).toBe('sending')
    expect(t.sent).toHaveLength(1)
    await tick(1000)
    expect(t.sent).toHaveLength(2)
    expect(t.sent[1]).toEqual(t.sent[0])
    expect(t.last()?.status).toBe('confirmed')
  })

  it('после трёх автоповторов исход неизвестен, ручной повтор использует тот же ключ', async () => {
    const t = setup([fail('network'), fail('timeout'), fail('server', 503), fail('timeout'), ok(decision('cancelled', 2))])
    t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })
    await tick()
    await tick(1000)
    await tick(2000)
    await tick(4000)
    await tick()
    expect(t.sent).toHaveLength(4)
    expect(t.last()?.status).toBe('unknown')
    expect(t.runner.retry(decisionTargetKey('d-1'))).toBe(true)
    await tick()
    expect(t.sent).toHaveLength(5)
    expect(new Set(t.sent.map((s) => s.key)).size).toBe(1)
    expect(t.last()?.status).toBe('confirmed')
  })

  it('закрытие неизвестного исхода убирает состояние', async () => {
    const t = setup([fail('timeout')])
    t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })
    await tick(7000)
    await tick()
    expect(t.last()?.status).toBe('unknown')
    t.runner.dismiss(decisionTargetKey('d-1'))
    expect(t.cleared).toEqual([decisionTargetKey('d-1')])
  })

  it('на одну цель одна активная команда', async () => {
    const t = setup([hang])
    expect(t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })).toBe(true)
    expect(t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })).toBe(false)
    expect(t.runner.cancelDecision({ decision_id: 'd-2', version: 1 })).toBe(true)
    await tick()
    expect(t.sent).toHaveLength(2)
  })

  it('финальное состояние убирается через 10 секунд', async () => {
    const t = setup([ok(decision('cancelled', 2))])
    t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })
    await tick()
    expect(t.cleared).toEqual([])
    await tick(10000)
    expect(t.cleared).toEqual([decisionTargetKey('d-1')])
  })

  it('новая команда после завершения получает новый ключ', async () => {
    const t = setup([ok(decision('cancelled', 2)), ok(decision('cancelled', 3))])
    t.runner.cancelDecision({ decision_id: 'd-1', version: 1 })
    await tick()
    expect(t.runner.cancelDecision({ decision_id: 'd-1', version: 2 })).toBe(true)
    await tick()
    expect(t.sent.map((s) => s.key)).toEqual(['key-1', 'key-2'])
  })

  it('перевод пункта в ручной режим: версия и режим уходят на сервер, ответ применяется', async () => {
    const t = setup([ok(point('manual', 3))])
    expect(t.runner.setMode({ point_id: 'p-1', version: 2 }, 'manual')).toBe(true)
    await tick()
    expect(t.sent[0]).toEqual({ kind: 'set-mode', targetId: 'p-1', key: 'key-1', ifMatch: 2, mode: 'manual' })
    expect(t.pointsApplied).toEqual([point('manual', 3)])
    expect(t.last()).toMatchObject({ status: 'confirmed', message: 'Пункт переведён в ручной режим' })
    expect(t.last()?.targetKey).toBe(pointTargetKey('p-1'))
  })
})