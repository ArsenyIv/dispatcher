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
  <li
    class="decision"
    :class="`decision--${decision.status}`"
    :data-decision-id="decision.decision_id"
    :data-status="decision.status"
    :data-version="decision.version"
  >
    <div class="decision__row">
      <span class="decision__mark" aria-hidden="true"></span>
      <strong class="decision__vehicle">{{ vehicleName }}</strong>
      <span class="decision__route">{{ fromName }} → {{ toName }}</span>
      <time class="decision__time" :datetime="decision.created_at">{{ createdLabel }}</time>
    </div>

    <p class="decision__reason">{{ decision.reason }}</p>

    <p class="decision__meta">
      <span class="decision__status">{{ decisionStatusLabel(decision.status) }}</span>
      <span>Выигрыш: {{ decision.gain_s }} с</span>
      <span v-if="decision.status === 'pending'" class="decision__countdown">
        <template v-if="secondsLeft === null">До исполнения: —</template>
        <template v-else-if="secondsLeft === 0">Исполняется…</template>
        <template v-else>До исполнения: {{ secondsLeft }} с</template>
      </span>
    </p>

    <div v-if="decision.status === 'pending' && canAct" class="decision__actions">
      <button v-if="commandStatus === 'sending'" type="button" class="decision__btn" disabled>
        Отмена…
      </button>
      <template v-else-if="commandStatus === 'unknown'">
        <button type="button" class="decision__btn" @click="$emit('retry', decision.decision_id)">
          Повторить
        </button>
        <button type="button" class="decision__btn" @click="$emit('dismiss', decision.decision_id)">
          Закрыть
        </button>
      </template>
      <button
        v-else
        type="button"
        class="btn-accent decision__btn"
        @click="$emit('cancel', decision.decision_id)"
      >
        Отменить
      </button>
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
  --status: var(--text-muted);
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
}
.decision:first-child {
  padding-top: 0;
}
.decision:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}
.decision--pending {
  --status: var(--warn);
}
.decision--executed {
  --status: var(--ok);
}
.decision--cancelled {
  --status: var(--text-muted);
}
.decision--expired {
  --status: var(--expired);
}

.decision__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.decision__mark {
  flex: none;
  width: 0.7rem;
  height: 0.7rem;
  border: 2px solid var(--status);
}
.decision--pending .decision__mark {
  border-radius: 50%;
}
.decision--executed .decision__mark {
  background: var(--status);
}
.decision--cancelled .decision__mark {
  transform: rotate(45deg);
}
.decision--expired .decision__mark {
  border-style: dashed;
}
.decision__vehicle {
  flex: none;
}
.decision__route {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
.decision__time {
  flex: none;
  color: var(--text-muted);
}
.decision__reason {
  margin: 0.25rem 0;
  overflow-wrap: anywhere;
}
.decision__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 1rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}
.decision__status {
  color: var(--status);
  font-weight: 600;
}
.decision__countdown {
  display: inline-block;
  min-width: 10.5rem;
}
.decision__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.decision__btn {
  min-width: 7rem;
}
.decision__message {
  margin-top: 0.5rem;
  font-size: 0.875rem;
}
.decision__message--confirmed {
  color: var(--ok);
}
.decision__message--conflict {
  color: var(--warn);
}
.decision__message--forbidden,
.decision__message--failed,
.decision__message--unknown {
  color: var(--danger);
}
</style>