import type { Scheduler } from '../helpers/syncEngine'

// Монотонные часы: перевод времени на компьютере не влияет на таймауты синхронизации.
export const browserScheduler: Scheduler = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
}