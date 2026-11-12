import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Decision } from '@/modules/contract'
import { mergeByVersion } from '@/modules/platform'
import { DECISION_WINDOW_MS, pruneDecisions, sortDecisions } from '../helpers/decisionList'

export const useDecisionsStore = defineStore('decisions', () => {
  const byId = shallowRef<Readonly<Record<string, Decision>>>({})
  const items = computed(() => sortDecisions(Object.values(byId.value)))

  function replaceAllMutator(decisions: readonly Decision[]): void {
    const next: Record<string, Decision> = {}
    for (const d of decisions) next[d.decision_id] = d
    byId.value = next
  }

  function mergeMutator(decisions: readonly Decision[]): void {
    const next = mergeByVersion(byId.value, decisions, (d) => d.decision_id)
    if (next !== null) byId.value = next
  }

  // nowMs: время сервера; лента хранит решения за последний час
  function pruneMutator(nowMs: number): void {
    const next = pruneDecisions(byId.value, nowMs - DECISION_WINDOW_MS)
    if (next !== null) byId.value = next
  }

  return { byId, items, replaceAllMutator, mergeMutator, pruneMutator }
})