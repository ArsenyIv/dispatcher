import type { QueueEntry } from '@/modules/contract'
import { formatSiteTime, parseIsoMs } from '@/modules/platform'
import { formatWait } from '../utils/formatWait'

export interface QueueRow {
  key: string
  vehicleName: string
  eta: string
  serviceStart: string
  wait: string
}

// Строки очереди в том порядке, в котором их прислал сервер.
export function buildQueueRows(
  queue: readonly QueueEntry[],
  nameOf: (vehicleId: string) => string,
  tz: string | null,
): QueueRow[] {
  const time = (iso: string): string => (tz === null ? '—' : formatSiteTime(parseIsoMs(iso), tz))
  return queue.map((entry) => ({
    key: entry.vehicle_id,
    vehicleName: nameOf(entry.vehicle_id),
    eta: time(entry.eta),
    serviceStart: time(entry.service_start),
    wait: formatWait(entry.wait_s),
  }))
}