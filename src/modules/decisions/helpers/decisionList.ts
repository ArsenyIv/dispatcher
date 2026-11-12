import type { Decision } from '@/modules/contract'

export const DECISION_WINDOW_MS = 60 * 60 * 1000

// Новые сверху; при равном времени порядок по номеру решения, чтобы он не «прыгал».
export function sortDecisions(list: readonly Decision[]): Decision[] {
  return list
    .map((decision) => ({ decision, time: Date.parse(decision.created_at) }))
    .sort(
      (a, b) =>
        b.time - a.time ||
        b.decision.decision_id.localeCompare(a.decision.decision_id, 'en', { numeric: true }),
    )
    .map((entry) => entry.decision)
}

// Убирает завершённые решения старше порога. Ожидающие не удаляются никогда.
// Возвращает null, если удалять нечего.
export function pruneDecisions(
  byId: Readonly<Record<string, Decision>>,
  thresholdMs: number,
): Record<string, Decision> | null {
  const next: Record<string, Decision> = {}
  let removed = false
  for (const [id, decision] of Object.entries(byId)) {
    if (decision.status !== 'pending' && Date.parse(decision.created_at) < thresholdMs) {
      removed = true
    } else {
      next[id] = decision
    }
  }
  return removed ? next : null
}