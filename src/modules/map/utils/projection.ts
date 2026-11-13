// Перевод метров площадки в пиксели холста. Масштаб один для обеих осей, пропорции сохраняются.
// Ось Y в метрах направлена вверх, на экране вниз, поэтому она переворачивается.

export const WORLD_W_M = 6000
export const WORLD_H_M = 4000
export const PAD_PX = 16

export interface Projection {
  cssWidth: number
  cssHeight: number
  scale: number
  offsetX: number
  offsetY: number
  worldH: number
}

export function createProjection(
  cssWidth: number,
  cssHeight: number,
  padPx: number = PAD_PX,
  worldW: number = WORLD_W_M,
  worldH: number = WORLD_H_M,
): Projection {
  const availW = Math.max(1, cssWidth - 2 * padPx)
  const availH = Math.max(1, cssHeight - 2 * padPx)
  const scale = Math.min(availW / worldW, availH / worldH)
  return {
    cssWidth,
    cssHeight,
    scale,
    offsetX: (cssWidth - worldW * scale) / 2,
    offsetY: (cssHeight - worldH * scale) / 2,
    worldH,
  }
}

export function toScreenX(p: Projection, xMeters: number): number {
  return p.offsetX + xMeters * p.scale
}

export function toScreenY(p: Projection, yMeters: number): number {
  return p.offsetY + (p.worldH - yMeters) * p.scale
}

export function toWorld(p: Projection, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - p.offsetX) / p.scale, y: p.worldH - (sy - p.offsetY) / p.scale }
}