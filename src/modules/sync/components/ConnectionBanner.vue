<script setup lang="ts">
import type { ConnectionStatus } from '../helpers/connectionStatus'

defineProps<{ status: ConnectionStatus }>()

const LABELS: Record<ConnectionStatus, string> = {
  live: 'Подключено',
  reconnecting: 'Переподключение…',
  stale: 'Данные устарели',
}
</script>

<template>
  <div class="connection" :class="`connection--${status}`" role="status" aria-live="polite">
    <span class="connection__mark" aria-hidden="true"></span>
    {{ LABELS[status] }}
  </div>
</template>

<style scoped>
.connection {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 13rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.875rem;
  font-weight: 600;
}
.connection__mark {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  background: currentColor;
  border-radius: 50%;
}
.connection--live {
  color: var(--ok);
}
.connection--reconnecting {
  color: var(--warn);
}
.connection--reconnecting .connection__mark {
  border-radius: 0;
}
.connection--stale {
  color: var(--danger);
}
.connection--stale .connection__mark {
  border-radius: 0;
  transform: rotate(45deg);
}
</style>