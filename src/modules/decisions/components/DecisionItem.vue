<script setup lang="ts">
import type { CommandStatus } from '@/modules/commands'
import type { Decision } from '@/modules/contract'
import { decisionStatusLabel } from '../helpers/decisionLabels'

defineProps<{
  decision: Decision
  vehicleName: string
  fromName: string
  toName: string
  createdLabel: string
  secondsLeft: number | null
  canAct: boolean
  commandStatus: CommandStatus | null
  commandMessage: string
}>()

defineEmits<{
  cancel: [id: string]
  retry: [id: string]
  dismiss: [id: string]
}>()
</script>

<template>
  <li class="decision" :class="`decision--${decision.status}`">
    <div class="decision__head">
      <span class="decision__mark" aria-hidden="true"></span>
      <strong>{{ vehicleName }}</strong>
      <span>{{ fromName }} → {{ toName }}</span>
      <span class="decision__status">{{ decisionStatusLabel(decision.status) }}</span>
      <time class="decision__time" :datetime="decision.created_at">{{ createdLabel }}</time>
    </div>
    <p class="decision__reason">{{ decision.reason }}</p>
    <p class="decision__gain">Выигрыш: {{ decision.gain_s }} с</p>

    <div v-if="decision.status === 'pending'" class="decision__pending">
      <p class="decision__countdown">
        <template v-if="secondsLeft === null">До исполнения: —</template>
        <template v-else-if="secondsLeft === 0">Исполняется…</template>
        <template v-else>До исполнения: {{ secondsLeft }} с</template>
      </p>
      <div v-if="canAct" class="decision__actions">
        <button v-if="commandStatus === 'sending'" type="button" disabled>Отмена…</button>
        <template v-else-if="commandStatus === 'unknown'">
          <button type="button" @click="$emit('retry', decision.decision_id)">Повторить</button>
          <button type="button" @click="$emit('dismiss', decision.decision_id)">Закрыть</button>
        </template>
        <button v-else type="button" @click="$emit('cancel', decision.decision_id)">Отменить</button>
      </div>
    </div>

    <p
      v-if="commandMessage"
      class="decision__message"
      :class="commandStatus ? `decision__message--${commandStatus}` : ''"
    >
      {{ commandMessage }}
    </p>
  </li>
</template>

<style scoped>
.decision {
  padding: 0.5rem 0.75rem;
  border: 1px solid #c9c9c9;
  border-radius: 6px;
  list-style: none;
}
.decision__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.decision__time {
  margin-left: auto;
  color: #666;
  font-variant-numeric: tabular-nums;
}
.decision__reason,
.decision__gain,
.decision__countdown,
.decision__message {
  margin: 0.25rem 0;
}
.decision__mark {
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  border: 2px solid currentColor;
}
.decision--pending {
  color: #9a6700;
}
.decision--pending .decision__mark {
  border-radius: 50%;
}
.decision--executed {
  color: #1a7f37;
}
.decision--executed .decision__mark {
  background: currentColor;
}
.decision--cancelled {
  color: #57606a;
}
.decision--cancelled .decision__mark {
  transform: rotate(45deg);
}
.decision--expired {
  color: #8250df;
}
.decision--expired .decision__mark {
  border-style: dashed;
}
.decision__reason,
.decision__gain,
.decision__countdown,
.decision__actions,
.decision__message {
  color: #1f2328;
}
.decision__actions {
  display: flex;
  gap: 0.5rem;
}
.decision__message--forbidden,
.decision__message--failed,
.decision__message--unknown {
  color: #cf222e;
}
</style>