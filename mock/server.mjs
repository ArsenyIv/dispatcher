// Заглушка сервера диспетчерской. Запуск: make mock
// Окружение: PORT (3001), LOAD (число машин, 150), FAULTS (drop,dup,reorder,reset,slow,stale),
// ROLE (dispatcher|observer), SLOW_MS (3000), FAULT_RATE (событий в секунду на каждый вид сбоя, 0.2)

import http from 'node:http'
import { WebSocketServer } from 'ws'

// ---------- настройки ----------
const PORT = Number(process.env.PORT ?? 3001)
const LOAD = Number(process.env.LOAD ?? 150)
const VEHICLE_COUNT = Number.isInteger(LOAD) && LOAD > 0 ? LOAD : 150
const FAULTS = new Set(
  (process.env.FAULTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const ROLE = process.env.ROLE === 'observer' ? 'observer' : 'dispatcher'
const SLOW_MS = Number(process.env.SLOW_MS ?? 3000)
const FAULT_RATE = Number(process.env.FAULT_RATE ?? 0.2)
// вероятность сбоя на одно сообщение: около FAULT_RATE сбоев в секунду при любой нагрузке
const P = Math.min(0.2, FAULT_RATE / VEHICLE_COUNT)
const has = (name) => FAULTS.has(name)

// ---------- вспомогательное ----------
const W = 6000
const H = 4000
const HOUR_MS = 3600000
const AVG_SERVICE_MS = 16000
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const round1 = (n) => Math.round(n * 10) / 10
const round5 = (ms) => Math.round(ms / 5000) * 5000
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const clone = (x) => JSON.parse(JSON.stringify(x))

// ---------- площадка ----------
const POINT_DEFS = [
  ['p-1', 'Пункт 1', 800, 700],
  ['p-2', 'Пункт 2', 3120, 900],
  ['p-3', 'Пункт 3', 5200, 800],
  ['p-4', 'Пункт 4', 900, 3000],
  ['p-5', 'Пункт 5', 3000, 3200],
  ['p-6', 'Пункт 6', 5100, 3100],
]
const CAPACITY = Math.max(1, Math.round(VEHICLE_COUNT / 150))

const points = new Map()
for (const [id, name, x, y] of POINT_DEFS) {
  points.set(id, {
    id,
    name,
    x,
    y,
    mode: 'auto',
    version: 1,
    queue: [],
    queueJson: '[]',
    line: [], // приехавшие и ждущие
    serving: new Set(), // обслуживаются сейчас
  })
}
const pointIds = [...points.keys()]

const startedAt = Date.now()
const vehicles = new Map()
for (let i = 1; i <= VEHICLE_COUNT; i++) {
  const cruise = rand(20, 35) / 3.6 // м/с
  vehicles.set(`v-${i}`, {
    id: `v-${i}`,
    name: `Т-${i}`,
    x: rand(0, W),
    y: rand(0, H),
    heading: 0,
    speed: cruise,
    cruise,
    state: 'moving_empty',
    phase: 'to_point',
    target: pick(pointIds),
    lastSeen: startedAt,
    lastTick: startedAt,
    phaseEnd: 0,
    arrivedAt: 0,
    serviceStart: 0,
    exit: null,
    frozen: has('stale') && i % 10 === 0, // не обновляются вообще
  })
}

const decisions = new Map()
const decisionMeta = new Map() // id -> { createdMs, dueMs }
const pendingIds = new Set()
const pendingVehicles = new Set()
let decisionCounter = 3380

// ---------- представления (ровно поля контракта) ----------
function vehicleView(v) {
  const atPoint = v.phase === 'to_point' || v.phase === 'queued' || v.phase === 'service'
  return {
    vehicle_id: v.id,
    name: v.name,
    x_m: round1(v.x),
    y_m: round1(v.y),
    heading_deg: Math.round(v.heading),
    speed_kmh: round1(v.speed * 3.6),
    state: v.state,
    point_id: atPoint ? v.target : null,
    last_seen: iso(v.lastSeen),
  }
}
function pointView(p) {
  return {
    point_id: p.id,
    name: p.name,
    x_m: p.x,
    y_m: p.y,
    mode: p.mode,
    version: p.version,
    queue: p.queue,
  }
}
const decisionView = (d) => ({ ...d })

// ---------- журнал сообщений и клиенты ----------
let seq = 50000
const log = [] // { seq, json }, seq идут подряд
const LOG_CAP = Math.max(5000, VEHICLE_COUNT * 30)
const clients = new Set()
let resetPending = false

function emit(type, data) {
  seq += 1
  const json = JSON.stringify({ seq, at: iso(Date.now()), type, data })
  log.push({ seq, json })
  if (log.length > LOG_CAP * 1.2) log.splice(0, log.length - LOG_CAP)
  for (const client of clients) deliver(client, json)
}

function sendRaw(client, text) {
  if (client.ws.readyState === 1) client.ws.send(text)
}

function flushHeld(client) {
  clearTimeout(client.heldTimer)
  const held = client.held
  client.held = null
  if (held) for (const text of held) sendRaw(client, text)
}

// сбои применяются только к живым сообщениям об изменениях
function deliver(client, json) {
  if (has('drop') && Math.random() < P) return
  const out = [json]
  if (has('dup') && Math.random() < P) out.push(json)
  if (has('reorder')) {
    if (client.held) {
      out.push(...client.held) // отложенное уходит после текущего
      client.held = null
      clearTimeout(client.heldTimer)
    } else if (Math.random() < P) {
      client.held = out
      client.heldTimer = setTimeout(() => flushHeld(client), 1500)
      return
    }
  }
  for (const text of out) sendRaw(client, text)
}

// ---------- симуляция ----------
function moveToward(v, tx, ty, dt) {
  const dx = tx - v.x
  const dy = ty - v.y
  const dist = Math.hypot(dx, dy)
  if (dist > 0.1) v.heading = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
  const step = v.cruise * dt
  if (dist <= step) {
    v.x = tx
    v.y = ty
    return true
  }
  v.x += (dx / dist) * step
  v.y += (dy / dist) * step
  return false
}

function updateVehicle(v, now) {
  const dt = Math.min(5, (now - v.lastTick) / 1000)
  v.lastTick = now
  switch (v.phase) {
    case 'to_point': {
      const p = points.get(v.target)
      if (moveToward(v, p.x, p.y, dt)) {
        v.phase = 'queued'
        v.state = 'queued'
        v.speed = 0
        v.arrivedAt = now
        p.line.push(v.id)
      }
      break
    }
    case 'service':
      if (now >= v.phaseEnd) {
        points.get(v.target).serving.delete(v.id)
        v.phase = 'to_exit'
        v.state = 'moving_loaded'
        v.speed = v.cruise
        v.exit = { x: rand(0, W), y: rand(0, H) }
      }
      break
    case 'to_exit':
      if (moveToward(v, v.exit.x, v.exit.y, dt)) {
        v.phase = 'idle'
        v.state = Math.random() < 0.15 ? 'offline' : 'idle'
        v.speed = 0
        v.phaseEnd = now + rand(3000, 8000)
      }
      break
    case 'idle':
      if (now >= v.phaseEnd) {
        v.phase = 'to_point'
        v.state = 'moving_empty'
        v.speed = v.cruise
        v.target = pick(pointIds)
      }
      break
    default:
      break // queued: ждёт, пока пункт начнёт обслуживание
  }
  v.lastSeen = now
}

let tickCounter = 0
function vehicleTick() {
  const now = Date.now()
  const slice = tickCounter++ % 10 // каждая машина обновляется раз в секунду, нагрузка размазана
  let i = 0
  for (const v of vehicles.values()) {
    if (i++ % 10 !== slice) continue
    if (v.frozen) continue
    updateVehicle(v, now)
    emit('vehicle', vehicleView(v))
  }
}

function startServices(now) {
  for (const p of points.values()) {
    while (p.serving.size < CAPACITY && p.line.length > 0) {
      const v = vehicles.get(p.line.shift())
      v.phase = 'service'
      v.state = 'service'
      v.speed = 0
      v.serviceStart = now
      v.phaseEnd = now + rand(12000, 20000)
      p.serving.add(v.id)
    }
  }
}

function queueEntry(vehicleId, etaMs, startMs) {
  const eta = round5(etaMs)
  const start = round5(startMs)
  return {
    vehicle_id: vehicleId,
    eta: iso(eta),
    service_start: iso(start),
    wait_s: Math.max(0, Math.round((start - eta) / 1000)),
  }
}

// Очередь считает сервер. Время округлено до 5 секунд, поэтому версия пункта растёт
// только при реальных изменениях состава или порядка.
function recomputeQueues(now) {
  const enroute = new Map(pointIds.map((id) => [id, []]))
  for (const v of vehicles.values()) {
    if (v.phase !== 'to_point' || v.frozen) continue
    const p = points.get(v.target)
    const eta = now + (Math.hypot(p.x - v.x, p.y - v.y) / v.cruise) * 1000
    if (eta - now <= 180000) enroute.get(v.target).push({ id: v.id, eta })
  }
  for (const p of points.values()) {
    const free = []
    const entries = []
    for (const id of p.serving) {
      const v = vehicles.get(id)
      free.push(v.phaseEnd)
      entries.push(queueEntry(v.id, v.arrivedAt, v.serviceStart))
    }
    while (free.length < CAPACITY) free.push(now)
    const place = (vehicleId, etaMs) => {
      let k = 0
      for (let j = 1; j < free.length; j++) if (free[j] < free[k]) k = j
      const start = Math.max(etaMs, free[k])
      free[k] = start + AVG_SERVICE_MS
      entries.push(queueEntry(vehicleId, etaMs, start))
    }
    for (const id of p.line) place(id, vehicles.get(id).arrivedAt)
    for (const item of enroute.get(p.id).sort((a, b) => a.eta - b.eta)) place(item.id, item.eta)

    const json = JSON.stringify(entries)
    if (json !== p.queueJson) {
      p.queueJson = json
      p.queue = entries
      p.version += 1
      emit('point', pointView(p))
    }
  }
}

function createDecision(now) {
  const candidates = []
  for (const v of vehicles.values()) {
    if (v.phase !== 'to_point' || v.frozen || pendingVehicles.has(v.id)) continue
    if (points.get(v.target).mode !== 'auto') continue
    candidates.push(v)
  }
  if (candidates.length === 0) return
  const v = pick(candidates)
  const from = points.get(v.target)
  const options = [...points.values()].filter((p) => p.id !== from.id && p.mode === 'auto')
  if (options.length === 0) return
  const to = options.reduce((a, b) => (a.queue.length <= b.queue.length ? a : b))
  let reason = `Очередь на ${from.name} — ${from.queue.length}, на ${to.name} — ${to.queue.length}`
  if (Math.random() < 0.2) reason += ' <b>жирный</b> & "кавычки" 😀 </script>'
  decisionCounter += 1
  const d = {
    decision_id: `d-${decisionCounter}`,
    vehicle_id: v.id,
    from_point: from.id,
    to_point: to.id,
    gain_s: Math.round(rand(30, 300)),
    reason,
    status: 'pending',
    created_at: iso(now),
    execute_at: iso(now + 60000),
    version: 1,
  }
  decisions.set(d.decision_id, d)
  decisionMeta.set(d.decision_id, { createdMs: now, dueMs: now + 60000 })
  pendingIds.add(d.decision_id)
  pendingVehicles.add(v.id)
  emit('decision', decisionView(d))
}

function executeDecision(d) {
  pendingIds.delete(d.decision_id)
  pendingVehicles.delete(d.vehicle_id)
  const v = vehicles.get(d.vehicle_id)
  const to = points.get(d.to_point)
  if (v && v.phase === 'to_point' && v.target === d.from_point && to.mode === 'auto') {
    v.target = d.to_point
    d.status = 'executed'
  } else {
    d.status = 'expired'
  }
  d.version += 1
  emit('decision', decisionView(d))
}

function checkDueDecisions() {
  const now = Date.now()
  for (const id of [...pendingIds]) {
    if (decisionMeta.get(id).dueMs <= now) executeDecision(decisions.get(id))
  }
}

function scheduleDecision() {
  setTimeout(() => {
    createDecision(Date.now())
    scheduleDecision()
  }, rand(5000, 15000))
}

function prune() {
  const border = Date.now() - 2 * HOUR_MS
  for (const [id, meta] of decisionMeta) {
    if (meta.createdMs < border && !pendingIds.has(id)) {
      decisionMeta.delete(id)
      decisions.delete(id)
    }
  }
}

// ---------- команды ----------
const commands = new Map() // Idempotency-Key -> запись
let newKeyCounter = 0

function applyCommand(kind, id, ifMatch, body) {
  if (!ifMatch) return { status: 400, body: { error: 'If-Match required' }, applied: false }
  if (kind === 'cancel') {
    const d = decisions.get(id)
    if (!d) return { status: 404, body: { error: 'not found' }, applied: false }
    if (d.status !== 'pending' || String(d.version) !== ifMatch) {
      return { status: 409, body: decisionView(d), applied: false }
    }
    d.status = 'cancelled'
    d.version += 1
    pendingIds.delete(d.decision_id)
    pendingVehicles.delete(d.vehicle_id)
    emit('decision', decisionView(d))
    return { status: 200, body: decisionView(d), applied: true }
  }
  const p = points.get(id)
  if (!p) return { status: 404, body: { error: 'not found' }, applied: false }
  if (body.mode !== 'auto' && body.mode !== 'manual') {
    return { status: 400, body: { error: 'mode must be auto or manual' }, applied: false }
  }
  if (String(p.version) !== ifMatch) {
    return { status: 409, body: pointView(p), applied: false }
  }
  p.mode = body.mode
  p.version += 1
  emit('point', pointView(p))
  return { status: 200, body: pointView(p), applied: true }
}

async function handleCommand(req, res, kind, targetId) {
  const body = await readBody(req)
  if (ROLE === 'observer') {
    await slowDown()
    return sendJson(res, 403, { error: 'forbidden' })
  }
  const key = req.headers['idempotency-key']
  if (typeof key !== 'string' || key === '') {
    return sendJson(res, 400, { error: 'Idempotency-Key required' })
  }
  if (body === null) return sendJson(res, 400, { error: 'invalid json' })
  const ifMatch = String(req.headers['if-match'] ?? '').replace(/"/g, '')

  let entry = commands.get(key)
  let first = false
  if (!entry) {
    first = true
    newKeyCounter += 1
    // FAULTS=slow: у каждой нечётной команды сервер выполняет её сразу,
    // но ответ первой попытки не отправляет, клиент получает таймаут
    const loseResponse = has('slow') && newKeyCounter % 2 === 1
    const created = {
      kind,
      target: targetId,
      requests: 0,
      executions: 0,
      status: null,
      body: null,
      loseResponse,
      promise: null,
    }
    commands.set(key, created)
    created.promise = (async () => {
      if (has('slow') && !loseResponse) await sleep(SLOW_MS)
      const result = applyCommand(kind, targetId, ifMatch, body)
      created.status = result.status
      created.body = clone(result.body) // повтор вернёт ровно тот же ответ
      created.executions = result.applied ? 1 : 0
    })()
    entry = created
  } else if (has('slow')) {
    await sleep(SLOW_MS)
  }
  entry.requests += 1
  await entry.promise
  if (first && entry.loseResponse) {
    setTimeout(() => res.destroy(), 30000)
    return
  }
  sendJson(res, entry.status, entry.body)
}

// ---------- HTTP ----------
function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve(null)
      }
    })
    req.on('error', () => resolve(null))
  })
}

const slowDown = () => (has('slow') ? sleep(SLOW_MS) : Promise.resolve())

function buildSnapshot() {
  const now = Date.now()
  return {
    seq,
    at: iso(now),
    vehicles: [...vehicles.values()].map(vehicleView),
    points: [...points.values()].map(pointView),
    decisions: [...decisions.values()]
      .filter((d) => decisionMeta.get(d.decision_id).createdMs > now - HOUR_MS)
      .map(decisionView),
  }
}

function debugState() {
  return {
    seq,
    at: iso(Date.now()),
    config: { vehicles: VEHICLE_COUNT, faults: [...FAULTS], role: ROLE, capacity: CAPACITY },
    vehicles: [...vehicles.values()].map(vehicleView),
    points: [...points.values()].map(pointView),
    decisions: [...decisions.values()].map(decisionView),
    commands: Object.fromEntries(
      [...commands].map(([key, e]) => [
        key,
        {
          kind: e.kind,
          target: e.target,
          requests: e.requests,
          executions: e.executions,
          status: e.status,
        },
      ]),
    ),
  }
}

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, If-Match',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    })
    return res.end()
  }
  if (req.method === 'GET' && path === '/api/me') {
    await slowDown()
    return sendJson(res, 200, {
      user_id: 'u-7',
      name: 'Иванова А. С.',
      role: ROLE,
      site: { name: 'Площадка 3', tz: 'Asia/Krasnoyarsk' },
    })
  }
  if (req.method === 'GET' && path === '/api/snapshot') {
    await slowDown()
    return sendJson(res, 200, buildSnapshot()) // собирается после задержки: seq согласован
  }
  let m = req.method === 'POST' ? path.match(/^\/api\/decisions\/([^/]+)\/cancel$/) : null
  if (m) return handleCommand(req, res, 'cancel', decodeURIComponent(m[1]))
  m = req.method === 'POST' ? path.match(/^\/api\/points\/([^/]+)\/mode$/) : null
  if (m) return handleCommand(req, res, 'mode', decodeURIComponent(m[1]))
  if (req.method === 'GET' && path === '/debug/state') return sendJson(res, 200, debugState())
  // для e2e: исполнить ожидающее решение немедленно
  m = req.method === 'POST' ? path.match(/^\/debug\/execute\/([^/]+)$/) : null
  if (m) {
    const d = decisions.get(decodeURIComponent(m[1]))
    if (!d || d.status !== 'pending') return sendJson(res, 409, { error: 'not pending' })
    executeDecision(d)
    return sendJson(res, 200, decisionView(d))
  }
  return sendJson(res, 404, { error: 'not found' })
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(error)
    if (!res.headersSent) sendJson(res, 500, { error: 'internal' })
  })
})

// ---------- WebSocket ----------
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname !== '/ws') {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, url))
})

function onConnection(ws, url) {
  ws.on('error', () => {})
  const sendReset = () => {
    ws.send(JSON.stringify({ type: 'reset' }))
    ws.close()
  }
  if (resetPending) {
    resetPending = false
    return sendReset()
  }
  const raw = url.searchParams.get('since')
  const since = raw === null ? seq : Number(raw)
  const first = log.length > 0 ? log[0].seq : seq + 1
  if (!Number.isInteger(since) || since > seq || since < first - 1) return sendReset()

  // повтор пропущенного идёт без сбоев и сразу переходит в живой поток (без пауз между ними)
  for (let i = since + 1 - first; i < log.length; i++) ws.send(log[i].json)
  const client = { ws, held: null, heldTimer: null }
  clients.add(client)
  ws.on('close', () => {
    clearTimeout(client.heldTimer)
    clients.delete(client)
  })
}

function heartbeat() {
  const text = JSON.stringify({ type: 'heartbeat', seq, at: iso(Date.now()) })
  for (const client of clients) sendRaw(client, text)
}

// ---------- запуск ----------
recomputeQueues(Date.now())
setInterval(vehicleTick, 100)
setInterval(() => {
  const now = Date.now()
  startServices(now)
  recomputeQueues(now)
}, 1000)
setInterval(checkDueDecisions, 250)
setInterval(heartbeat, 5000)
setInterval(prune, 60000)
scheduleDecision()
if (has('reset')) {
  setInterval(() => {
    resetPending = true
    for (const client of clients) client.ws.terminate()
  }, 120000)
}

server.listen(PORT, () => {
  console.log(
    `mock: http://localhost:${PORT}  машин=${VEHICLE_COUNT}  роль=${ROLE}  сбои=${[...FAULTS].join(',') || 'нет'}`,
  )
})