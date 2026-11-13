import { describe, expect, it } from 'vitest'
import type { Vehicle } from '@/modules/contract'
import { VehicleRegistry } from '@/modules/fleet'
import { createProjection } from '../utils/projection'
import { findVehicleAt } from './vehicleHitTest'

// масштаб 1, поэтому экранные точки: x = x_m, y = 4000 - y_m
const proj = createProjection(6000, 4000, 0)

const vehicle = (id: string, x: number, y: number): Vehicle => ({
  vehicle_id: id,
  name: id,
  x_m: x,
  y_m: y,
  heading_deg: 0,
  speed_kmh: 0,
  state: 'idle',
  point_id: null,
  last_seen: '2026-10-01T04:12:09Z',
})

function registryOf(...vehicles: Vehicle[]): VehicleRegistry {
  const registry = new VehicleRegistry()
  registry.replaceAll(vehicles, 0)
  return registry
}

describe('поиск машины под курсором', () => {
  it('находит машину в пределах радиуса', () => {
    const registry = registryOf(vehicle('a', 1000, 3000))
    expect(findVehicleAt(registry, 0, proj, 1003, 1004, 10)).toBe('a')
  })

  it('вне радиуса возвращает null', () => {
    const registry = registryOf(vehicle('a', 1000, 3000))
    expect(findVehicleAt(registry, 0, proj, 1100, 1000, 10)).toBeNull()
  })

  it('из двух близких выбирает ближайшую', () => {
    const registry = registryOf(vehicle('a', 1000, 3000), vehicle('b', 1008, 3000))
    expect(findVehicleAt(registry, 0, proj, 1006, 1000, 10)).toBe('b')
  })

  it('на пустом реестре ничего не находит', () => {
    expect(findVehicleAt(new VehicleRegistry(), 0, proj, 10, 10, 10)).toBeNull()
  })
})