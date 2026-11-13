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
}
.mode__btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid #57606a;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.mode__btn:first-child {
  border-radius: 6px 0 0 6px;
}
.mode__btn:last-child {
  border-left: 0;
  border-radius: 0 6px 6px 0;
}
.mode__btn--active {
  background: #1f2328;
  color: #fff;
  font-weight: 600;
}
.mode__btn:disabled:not(.mode__btn--active) {
  opacity: 0.5;
  cursor: progress;
}
</style>