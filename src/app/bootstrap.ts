import type { Pinia } from 'pinia'
import { commandService, configureCommands, useCommandsStore } from '@/modules/commands'
import type { CommandState } from '@/modules/commands'
import type { Decision, Me, Point, PointMode, Vehicle } from '@/modules/contract'
import { useDecisionsStore } from '@/modules/decisions'
import { usePointsStore, vehicleRegistry } from '@/modules/fleet'
import { serverClock } from '@/modules/platform'
import { fetchMe, startSessionLoader, useSessionStore } from '@/modules/session'
import {
  DiagnosticsLog,
  browserScheduler,
  createSyncEngine,
  fetchSnapshot,
  openSocket,
  useConnectionStore,
} from '@/modules/sync'
import type { LoggedDiagnostic, SyncInfo } from '@/modules/sync'
import { createAppSink } from './syncSink'

// Отладочный доступ из консоли браузера, только в режиме разработки (его используют и e2e).
interface DebugApi {
  info(): SyncInfo
  log(): readonly LoggedDiagnostic[]
  vehicleCount(): number
  vehicles(): Vehicle[]
  points(): Point[]
  decisions(): Decision[]
  me(): Me | null
  serverNow(): number | null
  cancelDecision(id: string): boolean
  setMode(pointId: string, mode: PointMode): boolean
  commandStates(): CommandState[]
}

declare global {
  interface Window {
    __dispatcher?: DebugApi
  }
}

// Порядок запуска: /api/me, затем снимок, затем WebSocket. Возвращает функцию остановки.
export function bootstrap(pinia: Pinia): () => void {
  const session = useSessionStore(pinia)
  const connection = useConnectionStore(pinia)
  const points = usePointsStore(pinia)
  const decisions = useDecisionsStore(pinia)
  const commands = useCommandsStore(pinia)

  const diagnostics = new DiagnosticsLog(200)
  const sink = createAppSink({
    vehicles: vehicleRegistry,
    points,
    decisions,
    connection,
    clock: serverClock,
    perfNow: () => performance.now(),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
  })

  const engine = createSyncEngine({
    fetchSnapshot,
    openSocket,
    sink,
    scheduler: browserScheduler,
    diagnostic: (event) => diagnostics.add(event, performance.now()),
  })

  // Ответы на команды применяются в те же хранилища, что и поток, с защитой по версии.
  const stopCommands = configureCommands(pinia, {
    applyDecision: (decision) => decisions.mergeMutator([decision]),
    applyPoint: (point) => points.mergeMutator([point]),
    onSessionDenied: () => {
      // после 403 роль могла измениться: запрашиваем /api/me заново
      fetchMe(new AbortController().signal).then(
        (me) => session.setMeMutator(me),
        () => {},
      )
    },
  })

  const pruneTimer = setInterval(() => {
    const now = serverClock.now()
    if (now !== null) decisions.pruneMutator(now)
  }, 60000)

  const loader = startSessionLoader({
    fetchMe,
    onReady: (me) => {
      session.setMeMutator(me)
      engine.start()
    },
    onError: () => session.setLoadStatusMutator('error'),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
  })

  if (import.meta.env.DEV) {
    window.__dispatcher = {
      info: () => engine.info(),
      log: () => diagnostics.list(),
      vehicleCount: () => vehicleRegistry.size,
            vehicles: () => {
        const list: Vehicle[] = []
        for (let i = 0; i < vehicleRegistry.size; i++) {
          const entry = vehicleRegistry.at(i)
          if (entry) list.push(entry.data)
        }
        return list
      },
      points: () => Object.values(points.byId),
      decisions: () => decisions.items,
      me: () => session.me,
      serverNow: () => serverClock.now(),
      cancelDecision: (id) => {
        const decision = decisions.byId[id]
        return decision ? commandService.cancelDecision(decision) : false
      },
      setMode: (pointId, mode) => {
        const point = points.byId[pointId]
        return point ? commandService.setMode(point, mode) : false
      },
      commandStates: () => Object.values(commands.byTarget),
    }
  }

  return () => {
    loader.stop()
    engine.stop()
    stopCommands()
    sink.dispose()
    clearInterval(pruneTimer)
  }
}

