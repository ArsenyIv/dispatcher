import { describe, expect, it } from 'vitest'
import { createProjection, toScreenX, toScreenY, toWorld } from './projection'

describe('проекция площадки', () => {
  it('без отступов масштаб равен отношению размеров', () => {
    const p = createProjection(1200, 800, 0)
    expect(p.scale).toBeCloseTo(0.2)
    expect(toScreenX(p, 6000)).toBeCloseTo(1200)
    expect(toScreenX(p, 0)).toBeCloseTo(0)
  })

  it('ось Y перевёрнута: север (большее y) наверху экрана', () => {
    const p = createProjection(1200, 800, 0)
    expect(toScreenY(p, 4000)).toBeCloseTo(0)
    expect(toScreenY(p, 0)).toBeCloseTo(800)
  })

  it('пропорции сохраняются, площадка центрируется', () => {
    const p = createProjection(1000, 1000, 0)
    expect(p.scale).toBeCloseTo(1000 / 6000)
    expect(toScreenY(p, 2000)).toBeCloseTo(500)
    expect(toScreenX(p, 3000)).toBeCloseTo(500)
  })

  it('обратное преобразование возвращает исходные метры', () => {
    const p = createProjection(900, 700)
    const world = toWorld(p, toScreenX(p, 1234), toScreenY(p, 2345))
    expect(world.x).toBeCloseTo(1234)
    expect(world.y).toBeCloseTo(2345)
  })

  it('нулевой размер не ломает масштаб', () => {
    expect(createProjection(0, 0).scale).toBeGreaterThan(0)
  })
})