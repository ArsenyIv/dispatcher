import type {
  Decision,
  Me,
  Point,
  QueueEntry,
  ServerMessage,
  Snapshot,
  Vehicle,
} from './types'

type Obj = Record<string, unknown>

const VEHICLE_STATES = [
  'moving_loaded',
  'moving_empty',
  'queued',
  'service',
  'idle',
  'offline',
] as const
const POINT_MODES = ['auto', 'manual'] as const
const DECISION_STATUSES = ['pending', 'executed', 'cancelled', 'expired'] as const
const USER_ROLES = ['dispatcher', 'observer'] as const

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isStr(v: unknown): v is string {
  return typeof v === 'string'
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v)
}
function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v)
}

function isQueueEntry(v: unknown): v is QueueEntry {
  return (
    isObj(v) &&
    isStr(v.vehicle_id) &&
    isStr(v.eta) &&
    isStr(v.service_start) &&
    isNum(v.wait_s)
  )
}

export function isVehicle(v: unknown): v is Vehicle {
  return (
    isObj(v) &&
    isStr(v.vehicle_id) &&
    isStr(v.name) &&
    isNum(v.x_m) &&
    isNum(v.y_m) &&
    isNum(v.heading_deg) &&
    isNum(v.speed_kmh) &&
    isOneOf(VEHICLE_STATES, v.state) &&
    (v.point_id === null || isStr(v.point_id)) &&
    isStr(v.last_seen)
  )
}

export function isPoint(v: unknown): v is Point {
  return (
    isObj(v) &&
    isStr(v.point_id) &&
    isStr(v.name) &&
    isNum(v.x_m) &&
    isNum(v.y_m) &&
    isOneOf(POINT_MODES, v.mode) &&
    isInt(v.version) &&
    Array.isArray(v.queue) &&
    v.queue.every(isQueueEntry)
  )
}

export function isDecision(v: unknown): v is Decision {
  return (
    isObj(v) &&
    isStr(v.decision_id) &&
    isStr(v.vehicle_id) &&
    isStr(v.from_point) &&
    isStr(v.to_point) &&
    isNum(v.gain_s) &&
    isStr(v.reason) &&
    isOneOf(DECISION_STATUSES, v.status) &&
    isStr(v.created_at) &&
    isStr(v.execute_at) &&
    isInt(v.version)
  )
}

export function parseMe(raw: unknown): Me | null {
  if (!isObj(raw)) return null
  if (!isStr(raw.user_id) || !isStr(raw.name) || !isOneOf(USER_ROLES, raw.role)) return null
  const site = raw.site
  if (!isObj(site) || !isStr(site.name) || !isStr(site.tz)) return null
  return {
    user_id: raw.user_id,
    name: raw.name,
    role: raw.role,
    site: { name: site.name, tz: site.tz },
  }
}

function pickValid<T>(list: unknown, guard: (v: unknown) => v is T): T[] | null {
  if (!Array.isArray(list)) return null
  return list.filter(guard)
}

// Некорректные элементы внутри снимка отбрасываются, сам снимок отвергается,
// только если нарушена его общая форма.
export function parseSnapshot(raw: unknown): Snapshot | null {
  if (!isObj(raw) || !isInt(raw.seq) || !isStr(raw.at)) return null
  const vehicles = pickValid(raw.vehicles, isVehicle)
  const points = pickValid(raw.points, isPoint)
  const decisions = pickValid(raw.decisions, isDecision)
  if (!vehicles || !points || !decisions) return null
  return { seq: raw.seq, at: raw.at, vehicles, points, decisions }
}

export type ParsedMessage =
  | { ok: true; message: ServerMessage }
  | { ok: false; seq: number | null; reason: string }

function bad(seq: number | null, reason: string): ParsedMessage {
  return { ok: false, seq, reason }
}

// Если у битого сообщения удалось прочитать seq, он возвращается:
// движок синхронизации продвигает счётчик и не застревает на «пропуске».
export function parseServerMessage(raw: unknown): ParsedMessage {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return bad(null, 'invalid json')
    }
  }
  if (!isObj(value)) return bad(null, 'not an object')

  const type = value.type
  if (type === 'reset') return { ok: true, message: { type: 'reset' } }

  if (type === 'heartbeat') {
    if (isInt(value.seq) && isStr(value.at)) {
      return { ok: true, message: { type: 'heartbeat', seq: value.seq, at: value.at } }
    }
    return bad(null, 'bad heartbeat')
  }

  if (!isInt(value.seq) || !isStr(value.at)) {
    return bad(isInt(value.seq) ? value.seq : null, 'no seq or at')
  }
  const seq = value.seq
  const at = value.at
  const data = value.data

  if (type === 'vehicle' && isVehicle(data)) {
    return { ok: true, message: { seq, at, type: 'vehicle', data } }
  }
  if (type === 'point' && isPoint(data)) {
    return { ok: true, message: { seq, at, type: 'point', data } }
  }
  if (type === 'decision' && isDecision(data)) {
    return { ok: true, message: { seq, at, type: 'decision', data } }
  }
  return bad(seq, `unknown type or bad data: ${String(type)}`)
}