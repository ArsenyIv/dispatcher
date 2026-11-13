<script setup lang="ts"></script>

<template>
  <div class="layout">
    <header class="layout__header">
      <slot name="header" />
    </header>
    <div class="layout__map">
      <slot name="map" />
    </div>
    <div class="layout__panel">
      <slot name="queues" />
    </div>
    <div class="layout__panel">
      <slot name="feed" />
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
  gap: 1rem;
  align-items: start;
  padding: 1rem;
  font-family: system-ui, sans-serif;
}
.layout__header,
.layout__map {
  grid-column: 1 / -1;
}
.layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.layout__panel {
  min-width: 0;
}
</style>