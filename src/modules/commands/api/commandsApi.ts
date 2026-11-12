import { http } from '@/modules/platform'
import type { CommandIntent } from '../helpers/commandMachine'

// Возвращает разобранный JSON ответа 2xx; остальное: HttpError (409 несёт актуальный объект в body).
export function sendCommand(intent: CommandIntent, signal: AbortSignal): Promise<unknown> {
  const headers = { 'Idempotency-Key': intent.key, 'If-Match': String(intent.ifMatch) }
  const id = encodeURIComponent(intent.targetId)
  if (intent.kind === 'cancel-decision') {
    return http.request(`/api/decisions/${id}/cancel`, { method: 'POST', headers, signal })
  }
  return http.request(`/api/points/${id}/mode`, {
    method: 'POST',
    headers,
    body: { mode: intent.mode },
    signal,
  })
}