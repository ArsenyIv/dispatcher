import { describe, expect, it } from 'vitest'
import type { Decision, Point, Snapshot, Vehicle } from '@/modules/contract'
import { createAppSink } from './syncSink'

const AT = '2026-10-01T04:12:09Z'

const point = (id: string, version: number): Point => ({
  point_id: id,
  name: id,
  x_m: 0,
  y_m: 0,
  mode: 'auto',
  version,
  queue: [],
})
const decision = (id: string, version: number): Decision => ({
  decision_id: id,
  vehicle_id: 'v-1',
  from_point: 'p-1',
  to_point: 'p-2',
  gain_s: 10,
  reason: '',
  status: 'pending',
  created_at: AT,
  execute_at: AT,
  version,
})
const vehicle = (id: string): Vehicle => ({
  vehicle_id: id,
  name: id,
  x_m: 0,
  y_m: 0,
  heading_deg: 0,
  speed_kmh: 0,
  state: 'idle',
  point_id: null,
  last_seen: AT,
})
const snapshot = (): Snapshot => ({
  seq: 10,
  at: AT,
  vehicles: [vehicle('v-1')],
  points: [point('p-1', 5)],
  decisions: [decision('d-1', 1)],
})

function setup() {
  const log: string[] = []
  const mergedPoints: Point[][] = []
  const mergedDecisions: Decision[][] = []
  const statuses: string[] = []
  const times: number[] = []
  const timer = { fn: null as (() => void) | null }
  const sink = createAppSink(
    {
      vehicles: {
        replaceAll: (v) => {
          log.push(`vehicles.replaceAll:${v.length}`)
        },
        upsert: (v) => {
          log.push(`vehicles.upsert:${v.vehicle_id}`)
        },
      },
      points: {
        replaceAllMutator: (p) => {
          log.push(`points.replaceAll:${p.length}`)
        },
        mergeMutator: (p) => {
          mergedPoints.push([...p])
        },
      },
      decisions: {
        replaceAllMutator: (d) => {
          log.push(`decisions.replaceAll:${d.length}`)
        },
        mergeMutator: (d) => {
          mergedDecisions.push([...d])
        },
      },
      connection: {
        setStatusMutator: (s) => {
          statuses.push(s)
        },
      },
      clock: {
        sync: (ms) => {
          times.push(ms)
        },
      },
      perfNow: () => 0,
      setTimeout: (fn) => {
        timer.fn = fn
        return 1
      },
      clearTimeout: () => {
        timer.fn = null
      },
    },
    150,
  )
  const fire = (): void => {
    const fn = timer.fn
    timer.fn = null
    fn?.()
  }
  return { sink, log, mergedPoints, mergedDecisions, statuses, times, fire }
}

describe('приёмник синхронизации', () => {
  it('машины применяются сразу', () => {
    const t = setup()
    t.sink.applyChange({ seq: 1, at: AT, type: 'vehicle', data: vehicle('v-1') })
    expect(t.log).toEqual(['vehicles.upsert:v-1'])
  })

  it('пункты и решения копятся и записываются одной пачкой', () => {
    const t = setup()
    t.sink.applyChange({ seq: 1, at: AT, type: 'point', data: point('p-1', 1) })
    t.sink.applyChange({ seq: 2, at: AT, type: 'point', data: point('p-1', 2) })
    t.sink.applyChange({ seq: 3, at: AT, type: 'decision', data: decision('d-1', 1) })
    expect(t.mergedPoints).toEqual([])
    t.fire()
    expect(t.mergedPoints).toEqual([[point('p-1', 2)]])
    expect(t.mergedDecisions).toEqual([[decision('d-1', 1)]])
  })

  it('в пачке остаётся наибольшая версия', () => {
    const t = setup()
    t.sink.applyChange({ seq: 1, at: AT, type: 'point', data: point('p-1', 3) })
    t.sink.applyChange({ seq: 2, at: AT, type: 'point', data: point('p-1', 2) })
    t.fire()
    expect(t.mergedPoints[0]?.[0]?.version).toBe(3)
  })

  it('снимок заменяет всё и сбрасывает ожидающие изменения', () => {
    const t = setup()
    t.sink.applyChange({ seq: 1, at: AT, type: 'point', data: point('p-1', 1) })
    t.sink.applySnapshot(snapshot())
    t.fire()
    expect(t.mergedPoints).toEqual([])
    expect(t.log).toEqual(['vehicles.replaceAll:1', 'points.replaceAll:1', 'decisions.replaceAll:1'])
  })

  it('статус и время сервера передаются сразу', () => {
    const t = setup()
    t.sink.setStatus('live')
    t.sink.onServerTime(123)
    expect(t.statuses).toEqual(['live'])
    expect(t.times).toEqual([123])
  })
})