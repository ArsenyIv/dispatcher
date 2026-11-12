import type { Me } from '@/modules/contract'

export interface SessionLoaderDeps {
  fetchMe(signal: AbortSignal): Promise<Me>
  onReady(me: Me): void
  onError(error: unknown, attempt: number): void
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

const MAX_DELAY_MS = 15000

// Загружает /api/me; при ошибке повторяет с нарастающей паузой (1, 2, 4... до 15 секунд).
export function startSessionLoader(deps: SessionLoaderDeps): { stop(): void } {
  let stopped = false
  let attempt = 0
  let timer: unknown = null
  let controller: AbortController | null = null

  function run(): void {
    if (stopped) return
    timer = null
    controller = new AbortController()
    deps.fetchMe(controller.signal).then(
      (me) => {
        if (!stopped) deps.onReady(me)
      },
      (error: unknown) => {
        if (stopped) return
        attempt += 1
        deps.onError(error, attempt)
        timer = deps.setTimeout(run, Math.min(MAX_DELAY_MS, 1000 * 2 ** (attempt - 1)))
      },
    )
  }

  run()

  return {
    stop() {
      stopped = true
      controller?.abort()
      if (timer !== null) deps.clearTimeout(timer)
    },
  }
}