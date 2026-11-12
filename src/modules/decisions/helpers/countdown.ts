// Секунд до исполнения по времени сервера. null, пока время сервера неизвестно.
export function secondsLeft(executeAtMs: number, serverNowMs: number | null): number | null {
  if (serverNowMs === null || !Number.isFinite(executeAtMs)) return null
  return Math.max(0, Math.ceil((executeAtMs - serverNowMs) / 1000))
}