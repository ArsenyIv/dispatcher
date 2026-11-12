import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ConnectionStatus } from '../helpers/connectionStatus'

export const useConnectionStore = defineStore('connection', () => {
  const status = ref<ConnectionStatus>('reconnecting')

  function setStatusMutator(next: ConnectionStatus): void {
    status.value = next
  }

  return { status, setStatusMutator }
})