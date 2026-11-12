import type { DecisionStatus } from '@/modules/contract'

const LABELS: Record<DecisionStatus, string> = {
  pending: 'Ожидает',
  executed: 'Исполнено',
  cancelled: 'Отменено',
  expired: 'Истекло',
}

export function decisionStatusLabel(status: DecisionStatus): string {
  return LABELS[status]
}