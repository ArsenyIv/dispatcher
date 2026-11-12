import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { CommandState } from '../helpers/commandMachine'

export const useCommandsStore = defineStore('commands', () => {
  const byTarget = shallowRef<Readonly<Record<string, CommandState>>>({})

  function setStateMutator(state: CommandState): void {
    byTarget.value = { ...byTarget.value, [state.targetKey]: state }
  }

  function removeMutator(targetKey: string): void {
    if (!(targetKey in byTarget.value)) return
    const next = { ...byTarget.value }
    delete next[targetKey]
    byTarget.value = next
  }

  return { byTarget, setStateMutator, removeMutator }
})