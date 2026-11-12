import { describe, expect, it } from 'vitest'
import { ReorderBuffer } from './reorderBuffer'

const make = () => {
  const buffer = new ReorderBuffer<number>()
  buffer.reset(10)
  return buffer
}

describe('ReorderBuffer', () => {
  it('применяет по порядку', () => {
    const buffer = make()
    expect(buffer.accept(11, 11)).toEqual({ kind: 'applied', items: [11] })
    expect(buffer.accept(12, 12)).toEqual({ kind: 'applied', items: [12] })
    expect(buffer.lastApplied).toBe(12)
  })

  it('отбрасывает дубликаты и уже применённое', () => {
    const buffer = make()
    buffer.accept(11, 11)
    expect(buffer.accept(11, 11)).toEqual({ kind: 'ignored' })
    expect(buffer.accept(5, 5)).toEqual({ kind: 'ignored' })
  })

  it('держит опередившие сообщения и отдаёт цепочку после недостающего', () => {
    const buffer = make()
    expect(buffer.accept(13, 13)).toEqual({ kind: 'buffered' })
    expect(buffer.accept(12, 12)).toEqual({ kind: 'buffered' })
    expect(buffer.hasGap).toBe(true)
    expect(buffer.accept(11, 11)).toEqual({ kind: 'applied', items: [11, 12, 13] })
    expect(buffer.hasGap).toBe(false)
    expect(buffer.lastApplied).toBe(13)
  })

  it('повтор ожидающего сообщения игнорируется', () => {
    const buffer = make()
    buffer.accept(13, 13)
    expect(buffer.accept(13, 13)).toEqual({ kind: 'ignored' })
    expect(buffer.size).toBe(1)
  })

  it('до снимка сообщения игнорируются, reset очищает ожидающие', () => {
    const buffer = new ReorderBuffer<number>()
    expect(buffer.accept(1, 1)).toEqual({ kind: 'ignored' })
    buffer.reset(10)
    buffer.accept(13, 13)
    buffer.reset(20)
    expect(buffer.size).toBe(0)
    expect(buffer.lastApplied).toBe(20)
  })
})