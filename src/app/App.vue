<script setup lang="ts">
import { computed } from 'vue'
import { CommandAnnouncerContainer } from '@/modules/commands'
import { DecisionFeedContainer } from '@/modules/decisions'
import { MapContainer } from '@/modules/map'
import { QueuesContainer } from '@/modules/queues'
import { useSessionStore } from '@/modules/session'
import { ConnectionBannerContainer } from '@/modules/sync'
import ScreenLayout from './components/ScreenLayout.vue'

const session = useSessionStore()
const siteName = computed(() => session.me?.site.name ?? '')
</script>

<template>
  <p v-if="session.loadStatus === 'loading'" class="status" role="status">Загрузка…</p>
  <p v-else-if="session.loadStatus === 'error'" class="status" role="alert">
    Не удалось получить данные пользователя. Повторяем…
  </p>
  <ScreenLayout v-else>
    <template #header>
      <h1>Диспетчерская · {{ siteName }}</h1>
      <ConnectionBannerContainer />
    </template>
    <template #map>
      <MapContainer />
    </template>
    <template #queues>
      <QueuesContainer />
    </template>
    <template #feed>
      <DecisionFeedContainer />
    </template>
  </ScreenLayout>
  <CommandAnnouncerContainer />
</template>

<style scoped>
.status {
  padding: 1rem;
  font-family: system-ui, sans-serif;
}
</style>