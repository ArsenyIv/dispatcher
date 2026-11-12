<script setup lang="ts">
import { computed } from 'vue'
import { DecisionFeedContainer } from '@/modules/decisions'
import { useSessionStore } from '@/modules/session'
import { ConnectionBannerContainer } from '@/modules/sync'

const session = useSessionStore()
const siteName = computed(() => session.me?.site.name ?? '')
</script>

<template>
  <main class="screen">
    <p v-if="session.loadStatus === 'loading'" role="status">Загрузка…</p>
    <p v-else-if="session.loadStatus === 'error'" role="alert">
      Не удалось получить данные пользователя. Повторяем…
    </p>
    <template v-else>
      <header class="screen__header">
        <h1>Диспетчерская · {{ siteName }}</h1>
        <ConnectionBannerContainer />
      </header>
      <DecisionFeedContainer />
    </template>
  </main>
</template>

<style scoped>
.screen {
  padding: 1rem;
  font-family: system-ui, sans-serif;
}
.screen__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
</style>