<script setup lang="ts">
import type { CommandStatus } from '@/modules/commands'
import type { PointMode } from '@/modules/contract'
import type { QueueRow } from '../helpers/queueRows'
import ModeToggle from './ModeToggle.vue'

defineProps<{
  pointId: string
  name: string
  mode: PointMode
  version: number
  rows: QueueRow[]
  canAct: boolean
  commandStatus: CommandStatus | null
  commandMessage: string
}>()

defineEmits<{
  setMode: [pointId: string, mode: PointMode]
  retry: [pointId: string]
  dismiss: [pointId: string]
}>()
</script>

<template>
  <section class="point" :data-point-id="pointId" :data-mode="mode" :data-version="version">
    <header class="point__head">
      <h3 class="point__name">{{ name }}</h3>
      <ModeToggle
        v-if="canAct"
        :mode="mode"
        :busy="commandStatus === 'sending' || commandStatus === 'unknown'"
        @change="(next) => $emit('setMode', pointId, next)"
      />
      <span v-else class="point__badge" :class="`point__badge--${mode}`">
        {{ mode === 'auto' ? 'Авто' : 'Ручной' }}
      </span>
    </header>

    <div v-if="commandStatus === 'unknown' && canAct" class="point__actions">
      <button type="button" @click="$emit('retry', pointId)">Повторить</button>
      <button type="button" @click="$emit('dismiss', pointId)">Закрыть</button>
    </div>
    <p
      v-if="commandMessage"
      class="point__message"
      :class="commandStatus ? `point__message--${commandStatus}` : ''"
    >
      {{ commandMessage }}
    </p>

    <p v-if="rows.length === 0" class="point__empty muted">Очередь пуста</p>
    <div v-else class="point__scroll">
      <table class="point__queue">
        <thead>
          <tr>
            <th scope="col">Машина</th>
            <th scope="col">Приезд</th>
            <th scope="col">Начало</th>
            <th scope="col">Ожидание</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <td>{{ row.vehicleName }}</td>
            <td>{{ row.eta }}</td>
            <td>{{ row.serviceStart }}</td>
            <td>{{ row.wait }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.point {
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
}
.point__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.point__name {
  min-width: 0;
  overflow-wrap: anywhere;
}
.point__badge {
  padding: 0.125rem 0.625rem;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  font-size: 0.875rem;
}
.point__badge--manual {
  border-color: var(--text);
  font-weight: 600;
}
.point__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.point__message {
  margin-top: 0.5rem;
  font-size: 0.875rem;
}
.point__message--confirmed {
  color: var(--ok);
}
.point__message--conflict {
  color: var(--warn);
}
.point__message--forbidden,
.point__message--failed,
.point__message--unknown {
  color: var(--danger);
}
.point__empty {
  margin-top: 0.5rem;
}
.point__scroll {
  margin-top: 0.5rem;
  overflow-x: auto;
}
.point__queue {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.point__queue th {
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid var(--border-strong);
  color: var(--text-muted);
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}
.point__queue td {
  padding: 0.25rem 0.5rem;
  white-space: nowrap;
}
.point__queue tbody tr + tr td {
  border-top: 1px solid var(--border);
}
</style>