// Серверные часы: время сервера из heartbeat и снимка плюс прошедшее по performance.now.
// Часы компьютера диспетчера не используются, перевод времени на нём ничего не ломает.

export interface ServerClock {
  // Запомнить: в этот момент по часам сервера было serverAtMs
  sync(serverAtMs: number): void
  // Текущее время сервера в миллисекундах или null, пока синхронизации не было
  now(): number | null
}

export function createServerClock(perfNow: () => number = () => performance.now()): ServerClock {
  let anchorServer: number | null = null
  let anchorPerf = 0
  let last = 0 // время не идёт назад, даже если новый замер чуть меньше

  return {
    sync(serverAtMs) {
      if (!Number.isFinite(serverAtMs)) return
      anchorServer = serverAtMs
      anchorPerf = perfNow()
    },
    now() {
      if (anchorServer === null) return null
      const candidate = anchorServer + (perfNow() - anchorPerf)
      last = Math.max(last, candidate)
      return last
    },
  }
}

export const serverClock: ServerClock = createServerClock()