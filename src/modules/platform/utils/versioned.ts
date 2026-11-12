// Объект применяется, только если его version не меньше хранимой.
export interface Versioned {
  version: number
}

// Возвращает новый словарь, если что-то изменилось, иначе null: подписчиков зря не будим.
export function mergeByVersion<T extends Versioned>(
  current: Readonly<Record<string, T>>,
  incoming: readonly T[],
  idOf: (item: T) => string,
): Record<string, T> | null {
  let next: Record<string, T> | null = null
  for (const item of incoming) {
    const id = idOf(item)
    const existing = (next ?? current)[id]
    if (existing !== undefined && item.version < existing.version) continue
    if (existing === item) continue
    if (next === null) next = { ...current }
    next[id] = item
  }
  return next
}