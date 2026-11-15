<script setup lang="ts"></script>

<template>
  <div class="layout">
    <header class="layout__header">
      <slot name="header" />
    </header>
    <div class="layout__map">
      <slot name="map" />
    </div>
    <div class="layout__queues">
      <slot name="queues" />
    </div>
    <div class="layout__feed">
      <slot name="feed" />
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  gap: var(--gap);
  max-width: 1800px;
  margin: 0 auto;
  padding: var(--gap);
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'header'
    'map'
    'feed'
    'queues';
}
.layout__header {
  grid-area: header;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}
.layout__map {
  grid-area: map;
  min-width: 0;
}
.layout__queues {
  grid-area: queues;
  min-width: 0;
}
.layout__feed {
  grid-area: feed;
  min-width: 0;
}

@media (max-width: 480px) {
  .layout {
    padding: 0.5rem;
    gap: 0.5rem;
  }
}

@media (min-width: 760px) {
  .layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'header header'
      'map map'
      'queues feed';
  }
}

@media (min-width: 1200px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 26rem;
    grid-template-areas:
      'header header'
      'map feed'
      'queues feed';
  }
  .layout__feed {
    --feed-max: calc(100vh - 2 * var(--gap));
    position: sticky;
    top: var(--gap);
    align-self: start;
  }
}
</style>