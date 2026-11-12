import { isDecision, isPoint } from '@/modules/contract'
import type { Decision, Point, PointMode } from '@/modules/contract'
import { HttpError, newIdempotencyKey } from '@/modules/platform'

export type CommandStatus = 'sending' | 'confirmed' | 'conflict' | 'forbidden' | 'unknown' | 'failed'
export type CommandKind = 'cancel-decision' | 'set-mode'

// Намерение создаётся один раз по клику: ключ и версия не меняются при повторах.
export type CommandIntent =
  | { kind: 'cancel-decision'; targetId: string; key: string; ifMatch: number }
  | { kind: 'set-mode'; targetId: string; key: string; ifMatch: number; mode: PointMode }

export interface CommandState {
  targetKey: string
  kind: CommandKind
  targetId: string
  status: CommandStatus
  message: string
  attempt: number
}

export const decisionTargetKey = (decisionId: string): string => `cancel-decision:${decisionId}`
export const pointTargetKey = (pointId: string): string => `set-mode:${pointId}`

export const AUTO_RETRIES = 3
export const RETRY_BASE_MS = 1000
export const CLEAR_AFTER_MS = 10000

export interface CommandDeps {
  send(intent: CommandIntent, signal: AbortSignal): Promise<unknown>
  applyDecision(decision: Decision): void
  applyPoint(point: Point): void
  onSessionDenied(): void
  onState(state: CommandState): void
  onClear(targetKey: string): void
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
  newKey?: () => string
}

export interface CommandRunner {
  cancelDecision(decision: Pick<Decision, 'decision_id' | 'version'>): boolean
  setMode(point: Pick<Point, 'point_id' | 'version'>, mode: PointMode): boolean
  retry(targetKey: string): boolean
  dismiss(targetKey: string): void
  stop(): void
}

interface Active {
  intent: CommandIntent
  state: CommandState
  controller: AbortController | null
  autoLeft: number
  retryTimer: unknown
  clearTimer: unknown
}

const WAITING = 'Нет ответа от сервера, повторяем запрос…'
const UNKNOWN = 'Исход неизвестен: сервер не ответил. Повтор безопасен, команда не выполнится дважды.'

function decisionMessage(status: Decision['status']): string {
  switch (status) {
    case 'executed':
      return 'Решение уже исполнено'
    case 'expired':
      return 'Срок решения истёк'
    case 'cancelled':
      return 'Решение уже отменено'
    case 'pending':
      return 'Решение изменилось, показано актуальное состояние'
  }
}

export function createCommandRunner(deps: CommandDeps): CommandRunner {
  const active = new Map<string, Active>()
  const newKey = deps.newKey ?? newIdempotencyKey

  function publish(a: Active, status: CommandStatus, message: string): void {
    a.state = { ...a.state, status, message }
    deps.onState(a.state)
  }

  function cancelRetry(a: Active): void {
    if (a.retryTimer !== null) {
      deps.clearTimeout(a.retryTimer)
      a.retryTimer = null
    }
  }

  function cancelClear(a: Active): void {
    if (a.clearTimer !== null) {
      deps.clearTimeout(a.clearTimer)
      a.clearTimer = null
    }
  }

  // Итог получен: показываем его, через 10 секунд убираем из хранилища.
  function finish(a: Active, status: CommandStatus, message: string): void {
    a.controller = null
    cancelRetry(a)
    publish(a, status, message)
    a.clearTimer = deps.setTimeout(() => {
      a.clearTimer = null
      if (active.get(a.state.targetKey) === a) {
        active.delete(a.state.targetKey)
        deps.onClear(a.state.targetKey)
      }
    }, CLEAR_AFTER_MS)
  }

  function attempt(a: Active): void {
    const controller = new AbortController()
    a.controller = controller
    a.state = { ...a.state, attempt: a.state.attempt + 1 }
    let promise: Promise<unknown>
    try {
      promise = deps.send(a.intent, controller.signal)
    } catch (error) {
      promise = Promise.reject(error)
    }
    promise.then(
      (body) => {
        if (a.controller === controller) onSuccess(a, body)
      },
      (error: unknown) => {
        if (a.controller === controller) onFailure(a, error)
      },
    )
  }

  function onSuccess(a: Active, body: unknown): void {
    const intent = a.intent
    if (intent.kind === 'cancel-decision' && isDecision(body)) {
      deps.applyDecision(body) // на экране состояние из ответа сервера
      finish(a, 'confirmed', body.status === 'cancelled' ? 'Решение отменено' : decisionMessage(body.status))
      return
    }
    if (intent.kind === 'set-mode' && isPoint(body)) {
      deps.applyPoint(body)
      finish(
        a,
        'confirmed',
        body.mode === 'manual' ? 'Пункт переведён в ручной режим' : 'Пункт переведён в автоматический режим',
      )
      return
    }
    finish(a, 'failed', 'Сервер вернул неожиданный ответ. Состояние обновится из потока.')
  }

  function retryOrGiveUp(a: Active): void {
    a.controller = null
    if (a.autoLeft > 0) {
      const delay = RETRY_BASE_MS * 2 ** (AUTO_RETRIES - a.autoLeft) // 1, 2, 4 секунды
      a.autoLeft -= 1
      publish(a, 'sending', WAITING)
      a.retryTimer = deps.setTimeout(() => {
        a.retryTimer = null
        attempt(a)
      }, delay)
      return
    }
    publish(a, 'unknown', UNKNOWN)
  }

  function onFailure(a: Active, error: unknown): void {
    if (!(error instanceof HttpError)) {
      finish(a, 'failed', 'Непредвиденная ошибка при отправке команды')
      return
    }
    switch (error.kind) {
      case 'conflict': {
        const body = error.body
        if (a.intent.kind === 'cancel-decision' && isDecision(body)) {
          deps.applyDecision(body)
          finish(a, 'conflict', decisionMessage(body.status))
        } else if (a.intent.kind === 'set-mode' && isPoint(body)) {
          deps.applyPoint(body)
          finish(a, 'conflict', 'Пункт уже изменён, показано актуальное состояние')
        } else {
          finish(a, 'conflict', 'Конфликт: состояние обновится с сервера')
        }
        return
      }
      case 'forbidden':
        deps.onSessionDenied()
        finish(a, 'forbidden', 'Нет прав на это действие')
        return
      case 'not_found':
        finish(a, 'failed', 'Объект не найден на сервере')
        return
      case 'aborted':
        return
      default:
        if (error.retryable) {
          retryOrGiveUp(a)
        } else {
          finish(a, 'failed', `Команда отклонена сервером (HTTP ${error.status ?? '—'})`)
        }
    }
  }

  function isBusy(targetKey: string): boolean {
    const existing = active.get(targetKey)
    return existing !== undefined && (existing.state.status === 'sending' || existing.state.status === 'unknown')
  }

  function start(targetKey: string, intent: CommandIntent): boolean {
    const previous = active.get(targetKey)
    if (previous) {
      cancelRetry(previous)
      cancelClear(previous)
    }
    const a: Active = {
      intent,
      state: { targetKey, kind: intent.kind, targetId: intent.targetId, status: 'sending', message: '', attempt: 0 },
      controller: null,
      autoLeft: AUTO_RETRIES,
      retryTimer: null,
      clearTimer: null,
    }
    active.set(targetKey, a)
    deps.onState(a.state)
    attempt(a)
    return true
  }

  return {
    cancelDecision(decision) {
      const targetKey = decisionTargetKey(decision.decision_id)
      if (isBusy(targetKey)) return false
      return start(targetKey, {
        kind: 'cancel-decision',
        targetId: decision.decision_id,
        key: newKey(),
        ifMatch: decision.version,
      })
    },
    setMode(point, mode) {
      const targetKey = pointTargetKey(point.point_id)
      if (isBusy(targetKey)) return false
      return start(targetKey, {
        kind: 'set-mode',
        targetId: point.point_id,
        key: newKey(),
        ifMatch: point.version,
        mode,
      })
    },
    retry(targetKey) {
      const a = active.get(targetKey)
      if (!a || a.state.status !== 'unknown') return false
      a.autoLeft = 0 // ручной повтор: одна попытка с тем же ключом и той же версией
      publish(a, 'sending', 'Повторяем запрос…')
      attempt(a)
      return true
    },
    dismiss(targetKey) {
      const a = active.get(targetKey)
      if (!a || a.state.status === 'sending') return
      a.controller = null
      cancelRetry(a)
      cancelClear(a)
      active.delete(targetKey)
      deps.onClear(targetKey)
    },
    stop() {
      for (const a of active.values()) {
        a.controller?.abort()
        a.controller = null
        cancelRetry(a)
        cancelClear(a)
      }
      active.clear()
    },
  }
}