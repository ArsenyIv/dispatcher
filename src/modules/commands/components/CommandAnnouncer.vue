<script setup lang="ts">
defineProps<{ text: string; version: number }>()
</script>

<template>
  <div class="announcer" role="status" aria-live="polite" aria-atomic="true">
    <p :key="version">{{ text }}</p>
  </div>
</template>

<style scoped>
.announcer {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>