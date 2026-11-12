import { describe, expect, it } from 'vitest'
import type { Decision } from '@/modules/contract'
import { pruneDecisions, sortDecisions } from './decisionList'

const decision = (id: string, created: string, status: Decision['status'] = 'executed'): Decision => ({
  decision_id: id,
  vehicle_id: 'v-1',
  from_point: 'p-1',
  to_point: 'p-2',
  gain_s: 10,
  reason: '',
  status,
  created_at: created,
  execute_at: created,
  version: 1,
})

describe('лента решений', () => {
  it('новые сверху, при равном времени порядок по номеру', () => {
    const sorted = sortDecisions([
      decision('d-1', '2026-10-01T04:00:00Z'),
      decision('d-2', '2026-10-01T04:00:10Z'),
      decision('d-3', '2026-10-01T04:00:10Z'),
    ])
    expect(sorted.map((d) => d.decision_id)).toEqual(['d-3', 'd-2', 'd-1'])
  })

  it('старые завершённые решения удаляются, ожидающие остаются', () => {
    const threshold = Date.parse('2026-10-01T04:00:00Z')
    const next = pruneDecisions(
      {
        'd-1': decision('d-1', '2026-10-01T03:00:00Z'),
        'd-2': decision('d-2', '2026-10-01T03:00:00Z', 'pending'),
        'd-3': decision('d-3', '2026-10-01T05:00:00Z'),
      },
      threshold,
    )
    expect(Object.keys(next ?? {})).toEqual(['d-2', 'd-3'])
  })

  it('если удалять нечего, возвращает null', () => {
    const threshold = Date.parse('2026-10-01T04:00:00Z')
    expect(pruneDecisions({ 'd-3': decision('d-3', '2026-10-01T05:00:00Z') }, threshold)).toBeNull()
  })
})