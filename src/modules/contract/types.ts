// Контракт сервера. Источник истины: Frontend.md, раздел «Контракт».
// Время приходит строками ISO 8601 в UTC, координаты в метрах.

export type UserRole = 'dispatcher' | 'observer'

export interface Me {
  user_id: string
  name: string
  role: UserRole
  site: { name: string; tz: string }
}

export type VehicleState =
  | 'moving_loaded'
  | 'moving_empty'
  | 'queued'
  | 'service'
  | 'idle'
  | 'offline'

export interface Vehicle {
  vehicle_id: string
  name: string
  x_m: number
  y_m: number
  heading_deg: number
  speed_kmh: number
  state: VehicleState
  point_id: string | null
  last_seen: string
}

export interface QueueEntry {
  vehicle_id: string
  eta: string
  service_start: string
  wait_s: number
}

export type PointMode = 'auto' | 'manual'

export interface Point {
  point_id: string
  name: string
  x_m: number
  y_m: number
  mode: PointMode
  version: number
  queue: QueueEntry[]
}

export type DecisionStatus = 'pending' | 'executed' | 'cancelled' | 'expired'

export interface Decision {
  decision_id: string
  vehicle_id: string
  from_point: string
  to_point: string
  gain_s: number
  reason: string
  status: DecisionStatus
  created_at: string
  execute_at: string
  version: number
}

export interface Snapshot {
  seq: number
  at: string
  vehicles: Vehicle[]
  points: Point[]
  decisions: Decision[]
}

export interface VehicleMessage {
  seq: number
  at: string
  type: 'vehicle'
  data: Vehicle
}

export interface PointMessage {
  seq: number
  at: string
  type: 'point'
  data: Point
}

export interface DecisionMessage {
  seq: number
  at: string
  type: 'decision'
  data: Decision
}

export type ChangeMessage = VehicleMessage | PointMessage | DecisionMessage

export interface HeartbeatMessage {
  type: 'heartbeat'
  seq: number
  at: string
}

export interface ResetMessage {
  type: 'reset'
}

export type ServerMessage = ChangeMessage | HeartbeatMessage | ResetMessage

export interface SetModeRequest {
  mode: PointMode
}