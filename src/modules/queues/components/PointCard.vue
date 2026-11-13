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
  <section
    class="point"
    :data-point-id="pointId"
    :data-mode="mode"
    :data-version="version"
  >
    <header class="point__head">
      <h3 class="point__name">{{ name }}</h3>
      <span class="point__mode">{{ mode === 'auto' ? 'Автоматический режим' : 'Ручной режим' }}</span>
      <ModeToggle
        v-if="canAct"
        :mode="mode"
        :busy="commandStatus === 'sending' || commandStatus === 'unknown'"
        @change="(next) => $emit('setMode', pointId, next)"
      />
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

    <p v-if="rows.length === 0" class="point__empty">Очередь пуста</p>
    <table v-else class="point__queue">
      <thead>
        <tr>
          <th scope="col">Машина</th>
          <th scope="col">Приезд</th>
          <th scope="col">Начало обслуживания</th>
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
  </section>
</template>

<style scoped>
.point {
  padding: 0.5rem 0.75rem;
  border: 1px solid #c9c9c9;
  border-radius: 6px;
}
.point__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.point__name {
  margin: 0;
}
.point__mode {
  color: #57606a;
}
.point__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.point__message {
  margin: 0.25rem 0;
}
.point__message--forbidden,
.point__message--failed,
.point__message--unknown {
  color: #cf222e;
}
.point__empty {
  margin: 0.5rem 0 0;
  color: #57606a;
}
.point__queue {
  width: 100%;
  margin-top: 0.5rem;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.point__queue th,
.point__queue td {
  padding: 0.125rem 0.5rem;
  text-align: left;
}
</style>