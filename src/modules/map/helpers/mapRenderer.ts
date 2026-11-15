import type { Point, VehicleState } from '@/modules/contract'
import { positionInto } from '@/modules/fleet'
import type { Position, VehicleRegistry } from '@/modules/fleet'
import { WORLD_H_M, WORLD_W_M, toScreenX, toScreenY } from '../utils/projection'
import type { Projection } from '../utils/projection'

export const STALE_AFTER_MS = 30000
export const VEHICLE_RADIUS_PX = 4
export const STALE_RING_WIDTH_PX = 1.5
export const SELECT_RADIUS_PX = 9
export const POINT_HALF_PX = 7
export const GRID_STEP_M = 1000
export const SELECTED_COLOR = '#141413'

export const VEHICLE_STATES: readonly VehicleState[] = [
  'moving_loaded',
  'moving_empty',
  'queued',
  'service',
  'idle',
  'offline',
]

export const STATE_COLORS: Record<VehicleState, string> = {
  moving_loaded: '#788c5d',
  moving_empty: '#4f85b8',
  queued: '#b7791f',
  service: '#8566a8',
  idle: '#87867f',
  offline: '#b3372d',
}

export const STATE_LABELS: Record<VehicleState, string> = {
  moving_loaded: 'Едет гружёная',
  moving_empty: 'Едет порожняя',
  queued: 'В очереди',
  service: 'Обслуживается',
  idle: 'Простаивает',
  offline: 'Не в сети',
}

export interface SelectedVehicleInfo {
  name: string
  stateLabel: string
  speedKmh: number
  pointName: string
  lastSeen: string
  stale: boolean
}

// Всё, что нужно слою машин от контекста рисования: так его можно проверять без браузера.
export type VehicleLayerCtx = Pick<
  CanvasRenderingContext2D,
  'beginPath' | 'moveTo' | 'arc' | 'fill' | 'stroke' | 'fillStyle' | 'strokeStyle' | 'lineWidth'
>

const TAU = Math.PI * 2
const scratch: Position = { x: 0, y: 0 }

// Машина без данных дольше 30 секунд по времени сервера. Если время неизвестно, устаревшей
// не считается; если дату нельзя разобрать, свежесть неизвестна и машина показывается устаревшей.
export function isStale(lastSeenMs: number, nowMs: number | null): boolean {
  return nowMs !== null && !(nowMs - lastSeenMs <= STALE_AFTER_MS)
}

// Статический слой нужно перерисовать, только когда меняется этот ключ.
export function pointsLayoutKey(points: readonly Point[]): string {
  return points.map((p) => `${p.point_id}|${p.name}|${p.x_m}|${p.y_m}|${p.mode}`).join(';')
}

// Слой машин. Один проход на состояние: путь из кружков свежих машин заливается одним fill,
// путь из колец устаревших рисуется одним stroke. Объекты в кадре не создаются.
export function drawVehicles(
  ctx: VehicleLayerCtx,
  registry: VehicleRegistry,
  nowPerf: number,
  proj: Projection,
  staleNowMs: number | null,
  selectedId: string | null,
): void {
  const count = registry.size
  const r = VEHICLE_RADIUS_PX

  for (const state of VEHICLE_STATES) {
    const color = STATE_COLORS[state]

    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < count; i++) {
      const entry = registry.at(i)
      if (entry === undefined || entry.data.state !== state) continue
      if (isStale(entry.lastSeenMs, staleNowMs)) continue
      positionInto(entry, nowPerf, scratch)
      const sx = toScreenX(proj, scratch.x)
      const sy = toScreenY(proj, scratch.y)
      ctx.moveTo(sx + r, sy)
      ctx.arc(sx, sy, r, 0, TAU)
    }
    ctx.fill()

    ctx.strokeStyle = color
    ctx.lineWidth = STALE_RING_WIDTH_PX
    ctx.beginPath()
    for (let i = 0; i < count; i++) {
      const entry = registry.at(i)
      if (entry === undefined || entry.data.state !== state) continue
      if (!isStale(entry.lastSeenMs, staleNowMs)) continue
      positionInto(entry, nowPerf, scratch)
      const sx = toScreenX(proj, scratch.x)
      const sy = toScreenY(proj, scratch.y)
      ctx.moveTo(sx + r + 1, sy)
      ctx.arc(sx, sy, r + 1, 0, TAU)
    }
    ctx.stroke()
  }

  if (selectedId !== null) {
    const entry = registry.get(selectedId)
    if (entry !== undefined) {
      positionInto(entry, nowPerf, scratch)
      const sx = toScreenX(proj, scratch.x)
      const sy = toScreenY(proj, scratch.y)
      ctx.strokeStyle = SELECTED_COLOR
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(sx + SELECT_RADIUS_PX, sy)
      ctx.arc(sx, sy, SELECT_RADIUS_PX, 0, TAU)
      ctx.stroke()
    }
  }
}

// Статический слой: фон, сетка в 1 км, рамка площадки, пункты и их подписи.
// Автоматический пункт: закрашенный квадрат, ручной: пустой квадрат и пометка в подписи.
export function drawStaticLayer(
  ctx: CanvasRenderingContext2D,
  proj: Projection,
  points: readonly Point[],
): void {
  const left = toScreenX(proj, 0)
  const right = toScreenX(proj, WORLD_W_M)
  const top = toScreenY(proj, WORLD_H_M)
  const bottom = toScreenY(proj, 0)

  ctx.clearRect(0, 0, proj.cssWidth, proj.cssHeight)
  ctx.fillStyle = '#f0eee6'
  ctx.fillRect(0, 0, proj.cssWidth, proj.cssHeight)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(left, top, right - left, bottom - top)

  ctx.strokeStyle = '#e8e6dc'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = GRID_STEP_M; x < WORLD_W_M; x += GRID_STEP_M) {
    const sx = toScreenX(proj, x)
    ctx.moveTo(sx, top)
    ctx.lineTo(sx, bottom)
  }
  for (let y = GRID_STEP_M; y < WORLD_H_M; y += GRID_STEP_M) {
    const sy = toScreenY(proj, y)
    ctx.moveTo(left, sy)
    ctx.lineTo(right, sy)
  }
  ctx.stroke()

  ctx.strokeStyle = '#b0aea5'
  ctx.strokeRect(left, top, right - left, bottom - top)

  ctx.font = '12px "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.lineJoin = 'round'
  const half = POINT_HALF_PX
  for (const p of points) {
    const sx = toScreenX(proj, p.x_m)
    const sy = toScreenY(proj, p.y_m)
    if (p.mode === 'auto') {
      ctx.fillStyle = '#141413'
      ctx.fillRect(sx - half, sy - half, half * 2, half * 2)
    } else {
      ctx.strokeStyle = '#141413'
      ctx.lineWidth = 3
      ctx.strokeRect(sx - half + 1.5, sy - half + 1.5, half * 2 - 3, half * 2 - 3)
    }
    const label = p.mode === 'manual' ? `${p.name} · ручной` : p.name
    const ty = sy - half - 4
    ctx.lineWidth = 3
    ctx.strokeStyle = '#ffffff'
    ctx.strokeText(label, sx, ty)
    ctx.fillStyle = '#141413'
    ctx.fillText(label, sx, ty)
  }
}