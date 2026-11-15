<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePointsStore, vehicleRegistry } from '@/modules/fleet'
import { formatSiteTime, serverClock, useServerNow } from '@/modules/platform'
import { useSessionStore } from '@/modules/session'
import { useConnectionStore } from '@/modules/sync'
import MapCanvas from '../components/MapCanvas.vue'
import { STATE_LABELS, isStale } from '../helpers/mapRenderer'
import type { SelectedVehicleInfo } from '../helpers/mapRenderer'

const points = usePointsStore()
const session = useSessionStore()
const connection = useConnectionStore()
const serverNow = useServerNow()
const selectedId = ref<string | null>(null)

// Время для проверки «устарела» идёт по часам сервера, но только пока связь живая.
// При потере связи оно замораживается: иначе через 30 секунд всё поле стало бы устаревшим.
let frozenNow: number | null = null
function getStaleNow(): number | null {
  if (connection.status === 'live') frozenNow = serverClock.now()
  return frozenNow
}

const selectedInfo = computed<SelectedVehicleInfo | null>(() => {
  void serverNow.value // реестр не реактивен: обновляем сведения раз в секунду
  const id = selectedId.value
  if (id === null) return null
  const entry = vehicleRegistry.get(id)
  if (entry === undefined) return null
  const tz = session.timeZone
  const data = entry.data
  return {
    name: data.name,
    stateLabel: STATE_LABELS[data.state],
    speedKmh: data.speed_kmh,
    pointName: data.point_id === null ? '—' : (points.byId[data.point_id]?.name ?? data.point_id),
    lastSeen: tz === null ? '—' : formatSiteTime(entry.lastSeenMs, tz),
    stale: isStale(entry.lastSeenMs, getStaleNow()),
  }
})

function onSelect(id: string | null): void {
  selectedId.value = id
}
</script>

<template>
  <section class="panel" aria-labelledby="map-title">
    <h2 id="map-title">Схема площадки</h2>
    <MapCanvas
      :points="points.list"
      :registry="vehicleRegistry"
      :selected-id="selectedId"
      :selected-info="selectedInfo"
      :get-stale-now="getStaleNow"
      @select="onSelect"
    />
  </section>
</template>