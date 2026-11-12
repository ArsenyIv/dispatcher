<script setup lang="ts">
import { computed } from 'vue'
import { commandService, decisionTargetKey, useCommandsStore } from '@/modules/commands'
import { usePointsStore, vehicleRegistry } from '@/modules/fleet'
import { formatSiteTime, parseIsoMs, useServerNow } from '@/modules/platform'
import { useSessionStore } from '@/modules/session'
import DecisionItem from '../components/DecisionItem.vue'
import { secondsLeft } from '../helpers/countdown'
import { useDecisionsStore } from '../store/decisionsStore'

const decisions = useDecisionsStore()
const points = usePointsStore()
const commands = useCommandsStore()
const session = useSessionStore()
const serverNow = useServerNow()

function pointName(id: string): string {
  return points.byId[id]?.name ?? id
}

// Все значения для карточки примитивы: раз в секунду меняется только счётчик в тех
// карточках, где он действительно изменился, остальные не перерисовываются.
const rows = computed(() => {
  const tz = session.timeZone
  const now = serverNow.value
  return decisions.items.map((d) => {
    const command = commands.byTarget[decisionTargetKey(d.decision_id)]
    return {
      decision: d,
      vehicleName: vehicleRegistry.nameOf(d.vehicle_id),
      fromName: pointName(d.from_point),
      toName: pointName(d.to_point),
      createdLabel: tz === null ? '—' : formatSiteTime(parseIsoMs(d.created_at), tz),
      secondsLeft: d.status === 'pending' ? secondsLeft(parseIsoMs(d.execute_at), now) : null,
      commandStatus: command?.status ?? null,
      commandMessage: command?.message ?? '',
    }
  })
})

function onCancel(id: string): void {
  const decision = decisions.byId[id] // версия берётся из хранилища в момент клика
  if (decision) commandService.cancelDecision(decision)
}
function onRetry(id: string): void {
  commandService.retry(decisionTargetKey(id))
}
function onDismiss(id: string): void {
  commandService.dismiss(decisionTargetKey(id))
}
</script>

<template>
  <section class="feed" aria-labelledby="feed-title">
    <h2 id="feed-title">Решения</h2>
    <p v-if="rows.length === 0">Решений пока нет</p>
    <ul v-else class="feed__list">
      <DecisionItem
        v-for="row in rows"
        :key="row.decision.decision_id"
        :decision="row.decision"
        :vehicle-name="row.vehicleName"
        :from-name="row.fromName"
        :to-name="row.toName"
        :created-label="row.createdLabel"
        :seconds-left="row.secondsLeft"
        :can-act="session.isDispatcher"
        :command-status="row.commandStatus"
        :command-message="row.commandMessage"
        @cancel="onCancel"
        @retry="onRetry"
        @dismiss="onDismiss"
      />
    </ul>
  </section>
</template>

<style scoped>
.feed__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0;
  margin: 0;
}
</style>