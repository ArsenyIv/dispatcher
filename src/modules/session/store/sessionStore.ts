import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Me } from '@/modules/contract'

export type SessionLoadStatus = 'loading' | 'ready' | 'error'

export const useSessionStore = defineStore('session', () => {
  const me = shallowRef<Me | null>(null)
  const loadStatus = ref<SessionLoadStatus>('loading')
  const isDispatcher = computed(() => me.value?.role === 'dispatcher')
  const timeZone = computed(() => me.value?.site.tz ?? null)

  function setMeMutator(value: Me): void {
    me.value = value
    loadStatus.value = 'ready'
  }

  function setLoadStatusMutator(status: SessionLoadStatus): void {
    loadStatus.value = status
  }

  return { me, loadStatus, isDispatcher, timeZone, setMeMutator, setLoadStatusMutator }
})