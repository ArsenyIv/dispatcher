import WebSocket from 'ws'

const url = process.argv[2] ?? 'ws://localhost:3001/ws'
const ws = new WebSocket(url)
let last = null
let count = 0
ws.on('message', (data) => {
  const m = JSON.parse(String(data))
  if (m.type === 'heartbeat') return console.log('heartbeat seq=' + m.seq)
  if (m.type === 'reset') return console.log('reset')
  count += 1
  if (last !== null && m.seq !== last + 1) console.log(`seq: ${last} -> ${m.seq}`)
  last = m.seq
})
ws.on('close', () => console.log('соединение закрыто'))
setInterval(() => console.log('сообщений:', count), 5000)