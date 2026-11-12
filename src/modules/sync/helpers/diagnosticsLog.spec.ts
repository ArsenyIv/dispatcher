import { describe, expect, it } from 'vitest'
import { DiagnosticsLog } from './diagnosticsLog'

describe('DiagnosticsLog', () => {
  it('хранит не больше заданного числа последних записей', () => {
    const log = new DiagnosticsLog(3)
    for (let i = 1; i <= 5; i++) log.add({ kind: 'gap', detail: i }, i)
    expect(log.list().map((e) => e.detail)).toEqual([3, 4, 5])
  })

  it('запоминает время записи', () => {
    const log = new DiagnosticsLog()
    log.add({ kind: 'reset' }, 42)
    expect(log.list()[0]).toEqual({ kind: 'reset', at: 42 })
  })
})