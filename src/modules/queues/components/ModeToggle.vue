<script setup lang="ts">
import type { PointMode } from '@/modules/contract'

defineProps<{ mode: PointMode; busy: boolean }>()
defineEmits<{ change: [mode: PointMode] }>()
</script>

<template>
  <div class="mode" role="group" aria-label="Режим пункта">
    <button
      type="button"
      class="mode__btn"
      :class="{ 'mode__btn--active': mode === 'auto' }"
      :aria-pressed="mode === 'auto'"
      :disabled="busy || mode === 'auto'"
      @click="$emit('change', 'auto')"
    >
      Авто
    </button>
    <button
      type="button"
      class="mode__btn"
      :class="{ 'mode__btn--active': mode === 'manual' }"
      :aria-pressed="mode === 'manual'"
      :disabled="busy || mode === 'manual'"
      @click="$emit('change', 'manual')"
    >
      Ручной
    </button>
  </div>
</template>

<style scoped>
.mode {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
}
.mode__btn {
  min-width: 4.75rem;
  border: 0;
  border-radius: 0;
}
.mode__btn + .mode__btn {
  border-left: 1px solid var(--border-strong);
}
.mode__btn--active {
  background: var(--text);
  color: var(--bg);
  font-weight: 600;
  opacity: 1;
}
.mode__btn:disabled:not(.mode__btn--active) {
  opacity: 0.55;
}
</style>