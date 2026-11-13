import { positionInto } from '@/modules/fleet'
import type { Position, VehicleRegistry } from '@/modules/fleet'
import { toScreenX, toScreenY } from '../utils/projection'
import type { Projection } from '../utils/projection'

const scratch: Position = { x: 0, y: 0 }

// Ближайшая к точке (sx, sy) машина в пределах radiusPx по её отображаемой позиции.
// Линейный перебор: для 1000 машин это доли миллисекунды, индекс не нужен.
export function findVehicleAt(
  registry: VehicleRegistry,
  nowPerf: number,
  proj: Projection,
  sx: number,
  sy: number,
  radiusPx: number,
): string | null {
  let best: string | null = null
  let bestDist = radiusPx * radiusPx
  for (let i = 0; i < registry.size; i++) {
    const entry = registry.at(i)
    if (entry === undefined) continue
    positionInto(entry, nowPerf, scratch)
    const dx = toScreenX(proj, scratch.x) - sx
    const dy = toScreenY(proj, scratch.y) - sy
    const dist = dx * dx + dy * dy
    if (dist <= bestDist) {
      bestDist = dist
      best = entry.data.vehicle_id
    }
  }
  return best
}