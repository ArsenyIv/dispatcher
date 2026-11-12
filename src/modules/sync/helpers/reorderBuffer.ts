// Принимает сообщения в любом порядке и отдаёт их строго по возрастанию seq без пропусков.

export type AcceptResult<T> =
  | { kind: 'ignored' } // дубликат, уже применённое или нет точки отсчёта
  | { kind: 'buffered' } // пришло раньше времени, ждём недостающие
  | { kind: 'applied'; items: T[] } // это сообщение и все следующие по порядку

export class ReorderBuffer<T> {
  private last: number | null = null
  private readonly pending = new Map<number, T>()

  get lastApplied(): number | null {
    return this.last
  }

  get size(): number {
    return this.pending.size
  }

  get hasGap(): boolean {
    return this.pending.size > 0
  }

  // Новая точка отсчёта: снимок или null до первого снимка
  reset(lastApplied: number | null): void {
    this.last = lastApplied
    this.pending.clear()
  }

  clearPending(): void {
    this.pending.clear()
  }

  accept(seq: number, item: T): AcceptResult<T> {
    const current = this.last
    if (current === null || seq <= current) return { kind: 'ignored' }
    if (seq !== current + 1) {
      if (this.pending.has(seq)) return { kind: 'ignored' }
      this.pending.set(seq, item)
      return { kind: 'buffered' }
    }
    let last = seq
    const items: T[] = [item]
    while (this.pending.has(last + 1)) {
      last += 1
      items.push(this.pending.get(last) as T)
      this.pending.delete(last)
    }
    this.last = last
    return { kind: 'applied', items }
  }
}