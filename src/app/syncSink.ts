import type { ChangeMessage, Decision, Point, Snapshot, Vehicle } from '@/modules/contract'
import type { ConnectionStatus, SyncSink } from '@/modules/sync'

export interface SinkTargets {
  vehicles: {
    replaceAll(vehicles: readonly Vehicle[], nowPerf: number): void
    upsert(vehicle: Vehicle, nowPerf: number): void
  }
  points: {
    replaceAllMutator(points: readonly Point[]): void
    mergeMutator(points: readonly Point[]): void
  }
  decisions: {
    replaceAllMutator(decisions: readonly Decision[]): void
    mergeMutator(decisions: readonly Decision[]): void
  }
  connection: { setStatusMutator(status: ConnectionStatus): void }
  clock: { sync(serverAtMs: number): void }
  perfNow(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface AppSink extends SyncSink {
  flushNow(): void
  dispose(): void
}

function keepNewest<T extends { version: number }>(map: Map<string, T>, id: string, item: T): void {
  const existing = map.get(id)
  if (existing === undefined || item.version >= existing.version) map.set(id, item)
}

// Машины идут в реестр сразу (он не реактивен), пункты и решения копятся
// и записываются в Pinia одной пачкой раз в flushMs.
export function createAppSink(targets: SinkTargets, flushMs = 150): AppSink {
  const pendingPoints = new Map<string, Point>()
  const pendingDecisions = new Map<string, Decision>()
  let timer: unknown = null

  function cancelTimer(): void {
    if (timer !== null) {
      targets.clearTimeout(timer)
      timer = null
    }
  }

  function flushNow(): void {
    cancelTimer()
    if (pendingPoints.size > 0) {
      const items = [...pendingPoints.values()]
      pendingPoints.clear()
      targets.points.mergeMutator(items)
    }
    if (pendingDecisions.size > 0) {
      const items = [...pendingDecisions.values()]
      pendingDecisions.clear()
      targets.decisions.mergeMutator(items)
    }
  }

  function schedule(): void {
    if (timer !== null) return
    timer = targets.setTimeout(() => {
      timer = null
      flushNow()
    }, flushMs)
  }

  return {
    applySnapshot(snapshot: Snapshot) {
      cancelTimer()
      pendingPoints.clear() // снимок новее всего, что ждало записи
      pendingDecisions.clear()
      targets.vehicles.replaceAll(snapshot.vehicles, targets.perfNow())
      targets.points.replaceAllMutator(snapshot.points)
      targets.decisions.replaceAllMutator(snapshot.decisions)
    },
    applyChange(message: ChangeMessage) {
      switch (message.type) {
        case 'vehicle':
          targets.vehicles.upsert(message.data, targets.perfNow())
          break
        case 'point':
          keepNewest(pendingPoints, message.data.point_id, message.data)
          schedule()
          break
        case 'decision':
          keepNewest(pendingDecisions, message.data.decision_id, message.data)
          schedule()
          break
      }
    },
    setStatus(status: ConnectionStatus) {
      targets.connection.setStatusMutator(status)
    },
    onServerTime(serverAtMs: number) {
      targets.clock.sync(serverAtMs)
    },
    flushNow,
    dispose() {
      cancelTimer()
      pendingPoints.clear()
      pendingDecisions.clear()
    },
  }
}