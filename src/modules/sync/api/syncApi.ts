import { parseSnapshot } from '@/modules/contract'
import type { Snapshot } from '@/modules/contract'
import { http } from '@/modules/platform'
import type { SocketHandlers, SyncSocket } from '../helpers/syncEngine'

export async function fetchSnapshot(signal: AbortSignal): Promise<Snapshot> {
  const raw = await http.request('/api/snapshot', { signal })
  const snapshot = parseSnapshot(raw)
  if (!snapshot) throw new Error('Некорректный снимок')
  return snapshot
}

export function openSocket(since: number, handlers: SocketHandlers): SyncSocket {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${scheme}//${location.host}/ws?since=${since}`)
  ws.onopen = () => handlers.onOpen()
  ws.onmessage = (event) => {
    if (typeof event.data === 'string') handlers.onMessage(event.data)
  }
  ws.onclose = () => handlers.onClose()
  return { close: () => ws.close() }
}