import { describe, expect, it } from 'vitest'
import type { Vehicle } from '@/modules/contract'
import { VehicleRegistry, positionInto } from './vehicleRegistry'
import type { Position, VehicleEntry } from './vehicleRegistry'

const vehicle = (id: string, x: number, y: number): Vehicle => ({
  vehicle_id: id,
  name: `Т-${id}`,
  x_m: x,
  y_m: y,
  heading_deg: 0,
  speed_kmh: 0,
  state: 'idle',
  point_id: null,
  last_seen: '2026-10-01T04:12:09Z',
})

const must = (registry: VehicleRegistry, id: string): VehicleEntry => {
  const entry = registry.get(id)
  if (!entry) throw new Error(`нет записи ${id}`)
  return entry
}
const at = (entry: VehicleEntry, now: number): Position =>
  positionInto(entry, now, { x: 0, y: 0 })

describe('VehicleRegistry', () => {
  it('новая машина сразу стоит на месте', () => {
    const registry = new VehicleRegistry()
    registry.upsert(vehicle('a', 100, 200), 0)
    expect(at(must(registry, 'a'), 0)).toEqual({ x: 100, y: 200 })
  })

  it('к новой позиции едет плавно', () => {
    const registry = new VehicleRegistry()
    registry.upsert(vehicle('a', 100, 0), 0)
    registry.upsert(vehicle('a', 200, 0), 100)
    const entry = must(registry, 'a')
    expect(at(entry, 100).x).toBeCloseTo(100)
    expect(at(entry, 550).x).toBeCloseTo(150)
    expect(at(entry, 5000).x).toBeCloseTo(200)
  })

  it('после долгой паузы позиция меняется сразу', () => {
    const registry = new VehicleRegistry()
    registry.upsert(vehicle('a', 100, 0), 0)
    registry.upsert(vehicle('a', 500, 0), 5000)
    expect(at(must(registry, 'a'), 5000).x).toBe(500)
  })

  it('снимок убирает исчезнувшие машины и сохраняет доступ по id', () => {
    const registry = new VehicleRegistry()
    registry.replaceAll([vehicle('a', 1, 1), vehicle('b', 2, 2), vehicle('c', 3, 3)], 0)
    registry.replaceAll([vehicle('a', 1, 1), vehicle('c', 3, 3)], 10)
    expect(registry.size).toBe(2)
    expect(registry.get('b')).toBeUndefined()
    expect(registry.at(0)?.data.vehicle_id).toBe('a')
    expect(registry.at(1)?.data.vehicle_id).toBe('c')
    expect(must(registry, 'c').data.vehicle_id).toBe('c')
  })

  it('имя берётся из реестра, а для неизвестной машины это её id', () => {
    const registry = new VehicleRegistry()
    registry.upsert(vehicle('a', 0, 0), 0)
    expect(registry.nameOf('a')).toBe('Т-a')
    expect(registry.nameOf('v-404')).toBe('v-404')
  })
})