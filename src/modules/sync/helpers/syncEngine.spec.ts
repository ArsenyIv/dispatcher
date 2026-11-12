import { describe, expect, it } from 'vitest'
import type { Snapshot } from '@/modules/contract'
import type { ConnectionStatus } from './connectionStatus'
import { createSyncEngine } from './syncEngine'
import type { SocketHandlers } from './syncEngine'

const AT = '2026-10-01T04:12:09Z'

const snapshot = (seq: number): Snapshot => ({
  seq,
  at: AT,
  vehicles: [],
  points: [],
  decisions: [],
})

const vehicleMsg = (seq: number) =>
  JSON.stringify({
    seq,
    at: AT,
    type: 'vehicle',
    data: {
      vehicle_id: `v-${seq}`,
      name: `Т-${seq}`,
      x_m: 1,
      y_m: 2,
      heading_deg: 0,
      speed_kmh: 0,
      state: 'idle',
      point_id: null,
      last_seen: AT,
    },
  })
const heartbeatMsg = (seq: number) => JSON.stringify({ type: 'heartbeat', seq, at: AT })
const resetMsg = () => JSON.stringify({ type: 'reset' })

interface FakeSocket {
  since: number
  handlers: SocketHandlers
  closed: boolean
}

interface SetupOptions {
  snapshots?: Snapshot[]
  snapshotFailures?: number
}

function setup(options: SetupOptions = {}) {
  let now = 0
  let nextId = 1
  const timers = new Map<number, { at: number; fn: () => void }>()
  const sockets: FakeSocket[] = []
  const applied: number[] = []
  const snapshotsApplied: number[] = []
  const statuses: ConnectionStatus[] = []
  const queue = [...(options.snapshots ?? [snapshot(100)])]
  let failuresLeft = options.snapshotFailures ?? 0

  const engine = createSyncEngine({
    fetchSnapshot: async () => {
      if (failuresLeft > 0) {
        failuresLeft -= 1
        throw new Error('нет связи')
      }
      return (queue.length > 1 ? queue.shift() : queue[0]) ?? snapshot(100)
    },
    openSocket: (since, handlers) => {
      const socket: FakeSocket = { since, handlers, closed: false }
      sockets.push(socket)
      return {
        close: () => {
          socket.closed = true
        },
      }
    },
    sink: {
      applySnapshot: (s) => {
        snapshotsApplied.push(s.seq)
      },
      applyChange: (m) => {
        applied.push(m.seq)
      },
      setStatus: (s) => {
        statuses.push(s)
      },
      onServerTime: () => {},
    },
    scheduler: {
      now: () => now,
      setTimeout: (fn, ms) => {
        const id = nextId++
        timers.set(id, { at: now + ms, fn })
        return id
      },
      clearTimeout: (handle) => {
        timers.delete(handle as number)
      },
    },
    random: () => 1, // задержки точные: 1000, 2000, 4000...
  })

  async function flush(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }

  async function advance(ms: number): Promise<void> {
    const end = now + ms
    for (;;) {
      let dueId: number | null = null
      let dueAt = Infinity
      for (const [id, timer] of timers) {
        if (timer.at <= end && timer.at < dueAt) {
          dueAt = timer.at
          dueId = id
        }
      }
      if (dueId === null) break
      const due = timers.get(dueId)
      timers.delete(dueId)
      now = Math.max(now, dueAt)
      due?.fn()
      await flush()
    }
    now = end
  }

  const pick = (index?: number) => (index === undefined ? sockets[sockets.length - 1] : sockets[index])
  const send = (raw: string, index?: number) => pick(index)?.handlers.onMessage(raw)
  const open = (index?: number) => pick(index)?.handlers.onOpen()

  return { engine, sockets, applied, snapshotsApplied, statuses, flush, advance, send, open, pick }
}

async function started(options: SetupOptions = {}) {
  const t = setup(options)
  t.engine.start()
  await t.flush()
  t.open()
  return t
}

describe('движок синхронизации', () => {
  it('применяет снимок и подключается с его seq', async () => {
    const t = await started()
    expect(t.snapshotsApplied).toEqual([100])
    expect(t.sockets).toHaveLength(1)
    expect(t.sockets[0]?.since).toBe(100)
    expect(t.statuses).toEqual(['reconnecting', 'live'])
  })

  it('применяет по порядку и отбрасывает повторы', async () => {
    const t = await started()
    for (const seq of [101, 102, 102, 101, 103]) t.send(vehicleMsg(seq))
    expect(t.applied).toEqual([101, 102, 103])
  })

  it('переставленные сообщения применяются по порядку', async () => {
    const t = await started()
    for (const seq of [101, 103, 102]) t.send(vehicleMsg(seq))
    expect(t.applied).toEqual([101, 102, 103])
  })

  it('пропуск восстанавливается, если сообщение пришло вовремя', async () => {
    const t = await started()
    t.send(vehicleMsg(101))
    t.send(vehicleMsg(103))
    await t.advance(1000)
    t.send(vehicleMsg(102))
    await t.advance(5000)
    expect(t.applied).toEqual([101, 102, 103])
    expect(t.sockets).toHaveLength(1)
  })

  it('пропуск дольше 2 секунд ведёт к переподключению с последнего применённого', async () => {
    const t = await started()
    t.send(vehicleMsg(101))
    t.send(vehicleMsg(103))
    await t.advance(3000)
    expect(t.sockets).toHaveLength(2)
    expect(t.sockets[0]?.closed).toBe(true)
    expect(t.sockets[1]?.since).toBe(101)
    t.open()
    t.send(vehicleMsg(102))
    t.send(vehicleMsg(103))
    expect(t.applied).toEqual([101, 102, 103])
  })

  it('сообщения закрытого сокета игнорируются', async () => {
    const t = await started()
    t.send(vehicleMsg(101))
    t.send(vehicleMsg(103))
    await t.advance(3000)
    t.send(vehicleMsg(102), 0)
    expect(t.applied).toEqual([101])
    t.open(1)
    t.send(vehicleMsg(102), 1)
    expect(t.applied).toEqual([101, 102])
  })

  it('потерю последнего сообщения замечает heartbeat', async () => {
    const t = await started()
    t.send(vehicleMsg(101))
    t.send(heartbeatMsg(102))
    await t.advance(3000)
    expect(t.sockets).toHaveLength(2)
    expect(t.sockets[1]?.since).toBe(101)
  })

  it('heartbeat с совпадающим seq переподключения не вызывает', async () => {
    const t = await started()
    t.send(vehicleMsg(101))
    t.send(heartbeatMsg(101))
    await t.advance(5000)
    expect(t.sockets).toHaveLength(1)
  })

  it('reset ведёт к новому снимку и новому отсчёту', async () => {
    const t = await started({ snapshots: [snapshot(100), snapshot(500)] })
    t.send(vehicleMsg(101))
    t.send(resetMsg())
    await t.flush()
    expect(t.sockets[0]?.closed).toBe(true)
    expect(t.snapshotsApplied).toEqual([100, 500])
    expect(t.sockets[1]?.since).toBe(500)
  })

  it('сообщение с битым содержимым продвигает seq и не создаёт пропуск', async () => {
    const t = await started()
    t.send(JSON.stringify({ seq: 101, at: AT, type: 'vehicle', data: {} }))
    t.send(vehicleMsg(102))
    await t.advance(5000)
    expect(t.applied).toEqual([102])
    expect(t.sockets).toHaveLength(1)
  })

  it('открытый сокет без кадров дольше 12 секунд считается мёртвым', async () => {
    const t = await started()
    t.send(vehicleMsg(101))
    await t.advance(13000)
    expect(t.sockets).toHaveLength(2)
    expect(t.sockets[1]?.since).toBe(101)
  })

  it('пауза между подключениями растёт: 1, 2 секунды', async () => {
    const t = await started()
    t.pick(0)?.handlers.onClose()
    await t.advance(999)
    expect(t.sockets).toHaveLength(1)
    await t.advance(1)
    expect(t.sockets).toHaveLength(2)
    t.pick(1)?.handlers.onClose()
    await t.advance(1999)
    expect(t.sockets).toHaveLength(2)
    await t.advance(1)
    expect(t.sockets).toHaveLength(3)
  })

  it('неудачный снимок повторяется с нарастающей паузой', async () => {
    const t = setup({ snapshotFailures: 2 })
    t.engine.start()
    await t.flush()
    expect(t.snapshotsApplied).toEqual([])
    await t.advance(3000)
    expect(t.snapshotsApplied).toEqual([100])
    expect(t.sockets).toHaveLength(1)
    expect(t.sockets[0]?.since).toBe(100)
  })

  it('связь теряется надолго: переподключение, затем данные устарели', async () => {
    const t = await started()
    t.send(heartbeatMsg(100))
    t.pick(0)?.handlers.onClose()
    await t.advance(16000)
    expect(t.statuses).toContain('reconnecting')
    expect(t.statuses[t.statuses.length - 1]).toBe('stale')
  })

  it('после stop сообщения игнорируются и таймеры не работают', async () => {
    const t = await started()
    t.engine.stop()
    t.send(vehicleMsg(101))
    await t.advance(60000)
    expect(t.applied).toEqual([])
    expect(t.sockets).toHaveLength(1)
    expect(t.sockets[0]?.closed).toBe(true)
  })
})