import { describe, expect, it } from 'vitest'
import type { Point, Vehicle } from '@/modules/contract'
import { VehicleRegistry } from '@/modules/fleet'
import { createProjection } from '../utils/projection'
import {
  SELECTED_COLOR,
  STALE_AFTER_MS,
  STATE_COLORS,
  drawVehicles,
  isStale,
  pointsLayoutKey,
} from './mapRenderer'
import type { VehicleLayerCtx } from './mapRenderer'

interface PathLog {
  arcs: number
  kind: 'fill' | 'stroke' | null
  color: string
}

function fakeCtx() {
  const paths: PathLog[] = []
  const current = (): PathLog => {
    const last = paths[paths.length - 1]
    if (last === undefined) throw new Error('путь не начат')
    return last
  }
  const ctx: VehicleLayerCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath: () => {
      paths.push({ arcs: 0, kind: null, color: '' })
    },
    moveTo: () => {},
    arc: () => {
      current().arcs += 1
    },
    fill: () => {
      const path = current()
      path.kind = 'fill'
      path.color = String(ctx.fillStyle)
    },
    stroke: () => {
      const path = current()
      path.kind = 'stroke'
      path.color = String(ctx.strokeStyle)
    },
  }
  return { ctx, paths }
}

const LAST = '2026-10-01T04:12:09Z'
const lastMs = Date.parse(LAST)
const proj = createProjection(6000, 4000, 0)

const vehicle = (id: string, state: Vehicle['state'], lastSeen: string = LAST): Vehicle => ({
  vehicle_id: id,
  name: id,
  x_m: 1000,
  y_m: 1000,
  heading_deg: 0,
  speed_kmh: 0,
  state,
  point_id: null,
  last_seen: lastSeen,
})

function draw(vehicles: Vehicle[], staleNow: number | null, selected: string | null = null): PathLog[] {
  const registry = new VehicleRegistry()
  registry.replaceAll(vehicles, 0)
  const fake = fakeCtx()
  drawVehicles(fake.ctx, registry, 0, proj, staleNow, selected)
  return fake.paths
}

const filled = (paths: PathLog[]) =>
  paths.filter((p) => p.kind === 'fill' && p.arcs > 0).map((p) => [p.color, p.arcs])
const stroked = (paths: PathLog[]) =>
  paths.filter((p) => p.kind === 'stroke' && p.arcs > 0).map((p) => [p.color, p.arcs])

describe('слой машин', () => {
  it('свежие машины рисуются группами по состоянию, по одной заливке на состояние', () => {
    const paths = draw([vehicle('a', 'idle'), vehicle('b', 'idle'), vehicle('c', 'service')], lastMs)
    expect(filled(paths)).toHaveLength(2)
    expect(filled(paths)).toEqual(
      expect.arrayContaining([
        [STATE_COLORS.idle, 2],
        [STATE_COLORS.service, 1],
      ]),
    )
    expect(stroked(paths)).toEqual([])
    expect(paths.filter((p) => p.kind === 'fill')).toHaveLength(6)
  })

  it('устаревшая машина рисуется кольцом, а не заливкой', () => {
    const paths = draw(
      [vehicle('a', 'moving_empty'), vehicle('b', 'moving_empty', '2026-10-01T04:10:00Z')],
      lastMs,
    )
    expect(filled(paths)).toEqual([[STATE_COLORS.moving_empty, 1]])
    expect(stroked(paths)).toEqual([[STATE_COLORS.moving_empty, 1]])
  })

  it('пока время сервера неизвестно, устаревших нет', () => {
    const paths = draw(
      [vehicle('a', 'idle'), vehicle('b', 'idle', '2026-10-01T04:10:00Z')],
      null,
    )
    expect(filled(paths)).toEqual([[STATE_COLORS.idle, 2]])
    expect(stroked(paths)).toEqual([])
  })

  it('выбранная машина получает отдельное кольцо', () => {
    const paths = draw([vehicle('a', 'idle')], lastMs, 'a')
    expect(stroked(paths)).toEqual([[SELECTED_COLOR, 1]])
  })

  it('несуществующий выбранный id ничего не рисует', () => {
    const paths = draw([vehicle('a', 'idle')], lastMs, 'нет-такой')
    expect(stroked(paths)).toEqual([])
  })
})

describe('isStale', () => {
  it('граница ровно 30 секунд', () => {
    expect(isStale(0, STALE_AFTER_MS)).toBe(false)
    expect(isStale(0, STALE_AFTER_MS + 1)).toBe(true)
  })

  it('без времени сервера устаревшей не считается, с битой датой считается', () => {
    expect(isStale(0, null)).toBe(false)
    expect(isStale(NaN, 1000)).toBe(true)
  })
})

describe('pointsLayoutKey', () => {
  const point = (mode: Point['mode'], version: number): Point => ({
    point_id: 'p-1',
    name: 'Пункт 1',
    x_m: 100,
    y_m: 200,
    mode,
    version,
    queue: [],
  })

  it('не меняется при изменении версии и очереди, меняется при смене режима', () => {
    expect(pointsLayoutKey([point('auto', 1)])).toBe(pointsLayoutKey([point('auto', 7)]))
    expect(pointsLayoutKey([point('auto', 1)])).not.toBe(pointsLayoutKey([point('manual', 2)]))
  })
})