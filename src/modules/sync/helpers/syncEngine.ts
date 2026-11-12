import { parseServerMessage } from '@/modules/contract'
import type { ChangeMessage, Snapshot } from '@/modules/contract'
import { deriveStatus } from './connectionStatus'
import type { ConnectionStatus } from './connectionStatus'
import { ReorderBuffer } from './reorderBuffer'

// ---------- что движок получает снаружи ----------
export interface Scheduler {
  now(): number // монотонное время, мс
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface SyncSocket {
  close(): void
}

export interface SocketHandlers {
  onOpen(): void
  onMessage(raw: string): void
  onClose(): void
}

export interface SyncSink {
  applySnapshot(snapshot: Snapshot): void
  applyChange(message: ChangeMessage): void
  setStatus(status: ConnectionStatus): void
  onServerTime(serverAtMs: number): void
}

export type DiagnosticKind =
  | 'dropped-message'
  | 'gap'
  | 'lag'
  | 'silence'
  | 'connect-timeout'
  | 'overflow'
  | 'reset'
  | 'closed'
  | 'snapshot-failed'
  | 'sink-error'

export interface SyncDiagnostic {
  kind: DiagnosticKind
  detail?: unknown
}

export interface SyncDeps {
  fetchSnapshot(signal: AbortSignal): Promise<Snapshot>
  openSocket(since: number, handlers: SocketHandlers): SyncSocket
  sink: SyncSink
  scheduler: Scheduler
  random?: () => number
  diagnostic?: (event: SyncDiagnostic) => void
}

export interface SyncConfig {
  gapTimeoutMs: number // сколько ждать недостающее сообщение
  lagTimeoutMs: number // сколько ждать, если heartbeat показал, что мы отстали
  silenceTimeoutMs: number // сокет открыт, но кадров нет: считаем мёртвым
  connectTimeoutMs: number
  staleAfterMs: number // после этого статус «данные устарели»
  tickMs: number
  maxBuffered: number
  backoffBaseMs: number
  backoffMaxMs: number
}

export const defaultSyncConfig: SyncConfig = {
  gapTimeoutMs: 2000,
  lagTimeoutMs: 2000,
  silenceTimeoutMs: 12000,
  connectTimeoutMs: 10000,
  staleAfterMs: 15000,
  tickMs: 500,
  maxBuffered: 200,
  backoffBaseMs: 1000,
  backoffMaxMs: 30000,
}

export type SyncPhase = 'stopped' | 'snapshot' | 'connecting' | 'open' | 'waiting'

export interface SyncInfo {
  phase: SyncPhase
  lastApplied: number | null
  buffered: number
  failures: number
  status: ConnectionStatus | null
}

export interface SyncEngine {
  start(): void
  stop(): void
  info(): SyncInfo
}

// ---------- движок ----------
export function createSyncEngine(
  deps: SyncDeps,
  overrides: Partial<SyncConfig> = {},
): SyncEngine {
  const cfg: SyncConfig = { ...defaultSyncConfig, ...overrides }
  const { scheduler, sink } = deps
  const random = deps.random ?? Math.random
  const buffer = new ReorderBuffer<ChangeMessage | null>() // null: сообщение с битым содержимым, но известным seq

  let phase: SyncPhase = 'stopped'
  let generation = 0 // номер соединения: колбэки закрытых соединений игнорируются
  let socket: SyncSocket | null = null
  let abort: AbortController | null = null
  let retryTimer: unknown = null
  let tickTimer: unknown = null
  let failures = 0 // подряд неудачных подключений без единого кадра
  let framesOnConnection = 0
  let startedAt = 0
  let lastFrameAt: number | null = null // последние свежие данные (для статуса)
  let connFrameAt = 0 // последний кадр на текущем соединении (для тишины)
  let phaseSince = 0
  let gapSince: number | null = null
  let lagSince: number | null = null
  let serverSeq = 0 // наибольший seq из heartbeat
  let status: ConnectionStatus | null = null

  function report(kind: DiagnosticKind, detail?: unknown): void {
    deps.diagnostic?.({ kind, detail })
  }

  function guarded(fn: () => void, what: string): void {
    try {
      fn()
    } catch (error) {
      report('sink-error', { what, error }) // ошибка приёмника не должна ломать синхронизацию
    }
  }

  function enter(next: SyncPhase): void {
    phase = next
    phaseSince = scheduler.now()
  }

  function updateStatus(): void {
    const next = deriveStatus({
      open: phase === 'open',
      lastFrameAt,
      startedAt,
      now: scheduler.now(),
      staleAfterMs: cfg.staleAfterMs,
    })
    if (next !== status) {
      status = next
      guarded(() => sink.setStatus(next), 'status')
    }
  }

  // Закрывает текущее соединение и всё, что с ним связано. lastApplied сохраняется.
  function teardown(): void {
    generation += 1
    const closing = socket
    socket = null
    try {
      closing?.close()
    } catch {
      // уже закрыт
    }
    abort?.abort()
    abort = null
    if (retryTimer !== null) {
      scheduler.clearTimeout(retryTimer)
      retryTimer = null
    }
    buffer.clearPending()
    gapSince = null
    lagSince = null
    serverSeq = 0
    framesOnConnection = 0
  }

  function backoffDelay(): number {
    if (failures === 0) return Math.floor(random() * 300) // небольшой разброс, чтобы клиенты не пришли разом
    const exp = Math.min(cfg.backoffMaxMs, cfg.backoffBaseMs * 2 ** (failures - 1))
    return Math.floor(exp * (0.5 + random() * 0.5))
  }

  function scheduleAfterBackoff(fn: () => void): void {
    enter('waiting')
    retryTimer = scheduler.setTimeout(() => {
      retryTimer = null
      fn()
    }, backoffDelay())
    updateStatus()
  }

  function loadSnapshot(): void {
    const g = generation
    enter('snapshot')
    const controller = new AbortController()
    abort = controller
    deps.fetchSnapshot(controller.signal).then(
      (snapshot) => {
        if (g === generation) onSnapshot(snapshot)
      },
      (error: unknown) => {
        if (g !== generation) return
        failures += 1
        report('snapshot-failed', error)
        scheduleAfterBackoff(loadSnapshot)
      },
    )
    updateStatus()
  }

  function onSnapshot(snapshot: Snapshot): void {
    abort = null
    failures = 0
    lastFrameAt = scheduler.now()
    guarded(() => sink.onServerTime(Date.parse(snapshot.at)), 'time')
    guarded(() => sink.applySnapshot(snapshot), 'snapshot') // новый снимок принимается всегда
    buffer.reset(snapshot.seq)
    connect()
  }

  function connect(): void {
    const since = buffer.lastApplied
    if (since === null) {
      loadSnapshot()
      return
    }
    const g = generation
    framesOnConnection = 0
    enter('connecting')
    try {
      socket = deps.openSocket(since, {
        onOpen: () => {
          if (g !== generation) return
          enter('open')
          connFrameAt = scheduler.now()
          updateStatus()
        },
        onMessage: (raw) => {
          if (g === generation) handleRaw(raw)
        },
        onClose: () => {
          if (g === generation) handleClosed()
        },
      })
    } catch (error) {
      report('closed', error)
      failures += 1
      scheduleAfterBackoff(connect)
      return
    }
    updateStatus()
  }

  function handleClosed(): void {
    report('closed')
    if (framesOnConnection === 0) failures += 1
    teardown()
    scheduleAfterBackoff(connect)
  }

  // Переподключение с последнего применённого seq, снимок не нужен.
  function resync(kind: DiagnosticKind): void {
    report(kind)
    if (framesOnConnection === 0) failures += 1
    teardown()
    scheduleAfterBackoff(connect)
  }

  // Сервер потерял историю: новый снимок и новый отсчёт.
  function handleReset(): void {
    report('reset')
    teardown()
    loadSnapshot()
  }

  function refreshLag(now: number): void {
    const last = buffer.lastApplied
    if (last !== null && serverSeq > last) {
      if (lagSince === null) lagSince = now
    } else {
      lagSince = null
    }
  }

  function ingest(seq: number, message: ChangeMessage | null): void {
    const now = scheduler.now()
    const result = buffer.accept(seq, message)
    if (result.kind === 'applied') {
      for (const item of result.items) {
        if (item !== null) guarded(() => sink.applyChange(item), 'change')
      }
      gapSince = buffer.hasGap ? now : null
    } else if (result.kind === 'buffered') {
      if (gapSince === null) gapSince = now
      if (buffer.size > cfg.maxBuffered) {
        resync('overflow')
        return
      }
    }
    refreshLag(now)
  }

  function handleRaw(raw: string): void {
    const now = scheduler.now()
    lastFrameAt = now
    connFrameAt = now
    framesOnConnection += 1
    failures = 0

    const parsed = parseServerMessage(raw)
    if (!parsed.ok) {
      report('dropped-message', parsed)
      // содержимое отброшено, но seq продвигается: иначе он застрял бы как «пропуск»
      if (parsed.seq !== null) ingest(parsed.seq, null)
      updateStatus()
      return
    }

    const message = parsed.message
    switch (message.type) {
      case 'reset':
        handleReset()
        return
      case 'heartbeat':
        guarded(() => sink.onServerTime(Date.parse(message.at)), 'time')
        serverSeq = Math.max(serverSeq, message.seq)
        refreshLag(now)
        break
      default:
        ingest(message.seq, message)
    }
    updateStatus()
  }

  function tick(): void {
    tickTimer = scheduler.setTimeout(tick, cfg.tickMs)
    const now = scheduler.now()
    if (phase === 'open') {
      if (gapSince !== null && now - gapSince >= cfg.gapTimeoutMs) return resync('gap')
      if (lagSince !== null && now - lagSince >= cfg.lagTimeoutMs) return resync('lag')
      if (now - connFrameAt >= cfg.silenceTimeoutMs) return resync('silence')
    } else if (phase === 'connecting' && now - phaseSince >= cfg.connectTimeoutMs) {
      return resync('connect-timeout')
    }
    updateStatus()
  }

  return {
    start() {
      if (phase !== 'stopped') return
      teardown()
      startedAt = scheduler.now()
      lastFrameAt = null
      failures = 0
      status = null
      buffer.reset(null)
      loadSnapshot()
      tickTimer = scheduler.setTimeout(tick, cfg.tickMs)
    },
    stop() {
      teardown()
      if (tickTimer !== null) {
        scheduler.clearTimeout(tickTimer)
        tickTimer = null
      }
      phase = 'stopped'
    },
    info() {
      return {
        phase,
        lastApplied: buffer.lastApplied,
        buffered: buffer.size,
        failures,
        status,
      }
    },
  }
}