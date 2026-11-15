import type { Vehicle } from '@/modules/contract'

// Реестр машин. Намеренно НЕ реактивен: тысячи обновлений в секунду не должны будить Vue.
// Схема читает его в каждом кадре отрисовки.

export interface VehicleEntry {
  data: Vehicle // последнее сообщение сервера
  lastSeenMs: number // last_seen в миллисекундах, разобран один раз при приёме
  prevX: number // откуда плавно едем к (x, y)
  prevY: number
  x: number
  y: number
  changedAt: number // performance.now() получения последней позиции
}

export interface Position {
  x: number
  y: number
}

export const TRANSITION_MS = 900
export const JUMP_GAP_MS = 2000 // после такой паузы (например, фоновая вкладка) прыгаем сразу

// Позиция для отрисовки: плавный переход к последней сообщённой, без экстраполяции.
// Результат пишется в out, чтобы не создавать объекты в цикле кадра.
export function positionInto(
  entry: VehicleEntry,
  nowPerf: number,
  out: Position,
  durationMs: number = TRANSITION_MS,
): Position {
  const t = durationMs <= 0 ? 1 : Math.min(1, Math.max(0, (nowPerf - entry.changedAt) / durationMs))
  out.x = entry.prevX + (entry.x - entry.prevX) * t
  out.y = entry.prevY + (entry.y - entry.prevY) * t
  return out
}

export class VehicleRegistry {
  private entries: VehicleEntry[] = []
  private readonly index = new Map<string, number>()
  private readonly scratch: Position = { x: 0, y: 0 }

  get size(): number {
    return this.entries.length
  }

  at(i: number): VehicleEntry | undefined {
    return this.entries[i]
  }

  get(id: string): VehicleEntry | undefined {
    const i = this.index.get(id)
    return i === undefined ? undefined : this.entries[i]
  }

  nameOf(id: string): string {
    return this.get(id)?.data.name ?? id
  }

  upsert(vehicle: Vehicle, nowPerf: number): void {
    const lastSeenMs = Date.parse(vehicle.last_seen)
    const entry = this.get(vehicle.vehicle_id)
    if (entry === undefined) {
      this.index.set(vehicle.vehicle_id, this.entries.length)
      this.entries.push({
        data: vehicle,
        lastSeenMs,
        prevX: vehicle.x_m,
        prevY: vehicle.y_m,
        x: vehicle.x_m,
        y: vehicle.y_m,
        changedAt: nowPerf,
      })
      return
    }
    if (nowPerf - entry.changedAt > JUMP_GAP_MS) {
      entry.prevX = vehicle.x_m
      entry.prevY = vehicle.y_m
    } else {
      positionInto(entry, nowPerf, this.scratch)
      entry.prevX = this.scratch.x
      entry.prevY = this.scratch.y
    }
    entry.data = vehicle
    entry.lastSeenMs = lastSeenMs
    entry.x = vehicle.x_m
    entry.y = vehicle.y_m
    entry.changedAt = nowPerf
  }

  // Снимок: машины, которых на сервере больше нет, исчезают.
  replaceAll(vehicles: readonly Vehicle[], nowPerf: number): void {
    const keep = new Set<string>()
    for (const v of vehicles) {
      this.upsert(v, nowPerf)
      keep.add(v.vehicle_id)
    }
    if (keep.size === this.entries.length) return
    this.entries = this.entries.filter((e) => keep.has(e.data.vehicle_id))
    this.index.clear()
    this.entries.forEach((e, i) => {
      this.index.set(e.data.vehicle_id, i)
    })
  }

  clear(): void {
    this.entries = []
    this.index.clear()
  }
}

export const vehicleRegistry = new VehicleRegistry()

