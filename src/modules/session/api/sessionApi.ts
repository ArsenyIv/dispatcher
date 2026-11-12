import { parseMe } from '@/modules/contract'
import type { Me } from '@/modules/contract'
import { http } from '@/modules/platform'

export async function fetchMe(signal: AbortSignal): Promise<Me> {
  const raw = await http.request('/api/me', { signal })
  const me = parseMe(raw)
  if (!me) throw new Error('Некорректный ответ /api/me')
  return me
}