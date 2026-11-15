<script setup lang="ts">
import { computed } from 'vue'
import { commandService, pointTargetKey, useCommandsStore } from '@/modules/commands'
import type { PointMode } from '@/modules/contract'
import { usePointsStore, vehicleRegistry } from '@/modules/fleet'
import { useSessionStore } from '@/modules/session'
import PointCard from '../components/PointCard.vue'
import { buildQueueRows } from '../helpers/queueRows'

const points = usePointsStore()
const commands = useCommandsStore()
const session = useSessionStore()

// Все значения для карточек готовятся здесь: компонент получает только примитивы и массивы строк.
const cards = computed(() => {
  const tz = session.timeZone
  return points.list.map((point) => {
    const command = commands.byTarget[pointTargetKey(point.point_id)]
    return {
      point,
      rows: buildQueueRows(point.queue, (id) => vehicleRegistry.nameOf(id), tz),
      commandStatus: command?.status ?? null,
      commandMessage: command?.message ?? '',
    }
  })
})

function onSetMode(pointId: string, mode: PointMode): void {
  const point = points.byId[pointId] // версия берётся из хранилища в момент клика
  if (point) commandService.setMode(point, mode)
}
function onRetry(pointId: string): void {
  commandService.retry(pointTargetKey(pointId))
}
function onDismiss(pointId: string): void {
  commandService.dismiss(pointTargetKey(pointId))
}
</script>

<template>
  <section class="panel" aria-labelledby="queues-title">
    <h2 id="queues-title">Очереди</h2>
    <p v-if="cards.length === 0" class="muted">Пунктов пока нет</p>
    <div v-else class="queues__list">
      <PointCard
        v-for="card in cards"
        :key="card.point.point_id"
        :point-id="card.point.point_id"
        :name="card.point.name"
        :mode="card.point.mode"
        :version="card.point.version"
        :rows="card.rows"
        :can-act="session.isDispatcher"
        :command-status="card.commandStatus"
        :command-message="card.commandMessage"
        @set-mode="onSetMode"
        @retry="onRetry"
        @dismiss="onDismiss"
      />
    </div>
  </section>
</template>

<style scoped>
.queues__list {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
}
</style>