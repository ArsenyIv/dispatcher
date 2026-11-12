import { describe, expect, it } from 'vitest'
import { mergeByVersion } from './versioned'

interface Item {
  id: string
  version: number
  text: string
}
const item = (id: string, version: number, text = ''): Item => ({ id, version, text })
const idOf = (i: Item): string => i.id

describe('mergeByVersion', () => {
  it('добавляет новое и заменяет более новым', () => {
    const next = mergeByVersion({ a: item('a', 1) }, [item('a', 2, 'new'), item('b', 1)], idOf)
    expect(next).toEqual({ a: item('a', 2, 'new'), b: item('b', 1) })
  })

  it('игнорирует более старую версию', () => {
    expect(mergeByVersion({ a: item('a', 5) }, [item('a', 4)], idOf)).toBeNull()
  })

  it('равная версия заменяет объект', () => {
    const next = mergeByVersion({ a: item('a', 5, 'old') }, [item('a', 5, 'new')], idOf)
    expect(next?.a?.text).toBe('new')
  })

  it('возвращает null, если ничего не изменилось', () => {
    const same = item('a', 1)
    expect(mergeByVersion({ a: same }, [same], idOf)).toBeNull()
  })

  it('не изменяет исходный словарь', () => {
    const current = { a: item('a', 1) }
    mergeByVersion(current, [item('a', 2)], idOf)
    expect(current.a.version).toBe(1)
  })

  it('внутри одной пачки побеждает наибольшая версия', () => {
    const next = mergeByVersion({}, [item('a', 3), item('a', 2)], idOf)
    expect(next?.a?.version).toBe(3)
  })
})