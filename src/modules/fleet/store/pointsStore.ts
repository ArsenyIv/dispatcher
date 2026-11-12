import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Point } from '@/modules/contract'
import { mergeByVersion } from '@/modules/platform'

export const usePointsStore = defineStore('points', () => {
  const byId = shallowRef<Readonly<Record<string, Point>>>({})
  const list = computed(() =>
    Object.values(byId.value).sort((a, b) =>
      a.point_id.localeCompare(b.point_id, 'en', { numeric: true }),
    ),
  )

  function replaceAllMutator(points: readonly Point[]): void {
    const next: Record<string, Point> = {}
    for (const p of points) next[p.point_id] = p
    byId.value = next
  }

  function mergeMutator(points: readonly Point[]): void {
    const next = mergeByVersion(byId.value, points, (p) => p.point_id)
    if (next !== null) byId.value = next
  }

  return { byId, list, replaceAllMutator, mergeMutator }
})