import type { SyncDiagnostic } from './syncEngine'

export interface LoggedDiagnostic extends SyncDiagnostic {
  at: number
}

// Кольцевой журнал событий синхронизации: размер ограничен, память не растёт.
export class DiagnosticsLog {
  private readonly capacity: number
  private readonly items: LoggedDiagnostic[] = []

  constructor(capacity = 200) {
    this.capacity = capacity
  }

  add(event: SyncDiagnostic, at: number): void {
    this.items.push({ ...event, at })
    if (this.items.length > this.capacity) {
      this.items.splice(0, this.items.length - this.capacity)
    }
  }

  list(): readonly LoggedDiagnostic[] {
    return this.items
  }
}