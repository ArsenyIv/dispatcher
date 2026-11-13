<script setup lang="ts">
import { ref, watch } from 'vue'
import CommandAnnouncer from '../components/CommandAnnouncer.vue'
import { useCommandsStore } from '../store/commandsStore'

const commands = useCommandsStore()
const text = ref('')
const version = ref(0)

// Объявляется каждый новый итог команды ровно один раз. Состояние «отправляется» молчит.
let announced = new Set<string>()

watch(
  () => commands.byTarget,
  (byTarget) => {
    const fresh: string[] = []
    const current = new Set<string>()
    for (const state of Object.values(byTarget)) {
      if (state.status === 'sending') continue
      const key = `${state.targetKey}|${state.status}`
      current.add(key)
      if (!announced.has(key) && state.message !== '') fresh.push(state.message)
    }
    announced = current
    if (fresh.length > 0) {
      text.value = fresh.join('. ')
      version.value += 1
    }
  },
)
</script>

<template>
  <CommandAnnouncer :text="text" :version="version" />
</template>