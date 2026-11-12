import type { Pinia } from 'pinia'
import type { Decision, Point, PointMode } from '@/modules/contract'
import { sendCommand } from '../api/commandsApi'
import { useCommandsStore } from '../store/commandsStore'
import { createCommandRunner } from './commandMachine'
import type { CommandRunner } from './commandMachine'

// Куда применять ответы сервера, сообщает слой app: так модуль не зависит от decisions и fleet.
export interface CommandTargets {
  applyDecision(decision: Decision): void
  applyPoint(point: Point): void
  onSessionDenied(): void
}

let runner: CommandRunner | null = null

export function configureCommands(pinia: Pinia, targets: CommandTargets): () => void {
  const store = useCommandsStore(pinia)
  runner?.stop()
  const created = createCommandRunner({
    send: sendCommand,
    applyDecision: targets.applyDecision,
    applyPoint: targets.applyPoint,
    onSessionDenied: targets.onSessionDenied,
    onState: (state) => store.setStateMutator(state),
    onClear: (targetKey) => store.removeMutator(targetKey),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
  })
  runner = created
  return () => {
    created.stop()
    if (runner === created) runner = null
  }
}

export const commandService = {
  cancelDecision(decision: Pick<Decision, 'decision_id' | 'version'>): boolean {
    return runner?.cancelDecision(decision) ?? false
  },
  setMode(point: Pick<Point, 'point_id' | 'version'>, mode: PointMode): boolean {
    return runner?.setMode(point, mode) ?? false
  },
  retry(targetKey: string): boolean {
    return runner?.retry(targetKey) ?? false
  },
  dismiss(targetKey: string): void {
    runner?.dismiss(targetKey)
  },
}