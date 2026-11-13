import { describe, expect, it } from 'vitest'
import type { QueueEntry } from '@/modules/contract'
import { buildQueueRows } from './queueRows'

const entry = (id: string, wait: number): QueueEntry => ({
  vehicle_id: id,
  eta: '2026-10-01T04:13:40Z',
  service_start: '2026-10-01T04:15:10Z',
  wait_s: wait,
})
const nameOf = (id: string): string => `Т-${id}`

describe('buildQueueRows', () => {
  it('показывает значения сервера: время в поясе площадки, ожидание как пришло', () => {
    expect(buildQueueRows([entry('v-09', 90)], nameOf, 'Asia/Krasnoyarsk')).toEqual([
      {
        key: 'v-09',
        vehicleName: 'Т-v-09',
        eta: '11:13:40',
        serviceStart: '11:15:10',
        wait: '1 мин 30 с',
      },
    ])
  })

  it('порядок очереди сохраняется как на сервере', () => {
    const rows = buildQueueRows([entry('v-3', 0), entry('v-1', 10), entry('v-2', 20)], nameOf, 'UTC')
    expect(rows.map((r) => r.key)).toEqual(['v-3', 'v-1', 'v-2'])
  })

  it('пока пояс неизвестен, время не показывается', () => {
    const [row] = buildQueueRows([entry('v-1', 5)], nameOf, null)
    expect(row?.eta).toBe('—')
    expect(row?.serviceStart).toBe('—')
  })
})