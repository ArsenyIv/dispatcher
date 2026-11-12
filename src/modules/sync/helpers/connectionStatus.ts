export type ConnectionStatus = 'reconnecting' | 'live' | 'stale'

export interface StatusInput {
  open: boolean // сокет открыт
  lastFrameAt: number | null // монотонное время последних данных (сообщение, heartbeat, снимок)
  startedAt: number
  now: number
  staleAfterMs: number
}

// live: сокет открыт и данные свежие; stale: данных нет дольше staleAfterMs;
// reconnecting: идёт подключение или повторная загрузка снимка.
export function deriveStatus(input: StatusInput): ConnectionStatus {
  const baseline = input.lastFrameAt ?? input.startedAt
  if (input.now - baseline > input.staleAfterMs) return 'stale'
  if (input.open && input.lastFrameAt !== null) return 'live'
  return 'reconnecting'
}