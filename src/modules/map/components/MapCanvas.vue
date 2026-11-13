<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Point } from '@/modules/contract'
import type { VehicleRegistry } from '@/modules/fleet'
import {
  STATE_COLORS,
  STATE_LABELS,
  VEHICLE_STATES,
  drawStaticLayer,
  drawVehicles,
  pointsLayoutKey,
} from '../helpers/mapRenderer'
import type { SelectedVehicleInfo } from '../helpers/mapRenderer'
import { findVehicleAt } from '../helpers/vehicleHitTest'
import { createProjection } from '../utils/projection'
import type { Projection } from '../utils/projection'

const props = defineProps<{
  points: readonly Point[]
  registry: VehicleRegistry
  selectedId: string | null
  selectedInfo: SelectedVehicleInfo | null
  getStaleNow: () => number | null
}>()

const emit = defineEmits<{ select: [id: string | null] }>()

const frame = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

// Состояние рисования намеренно не реактивно: оно меняется в каждом кадре.
let ctx: CanvasRenderingContext2D | null = null
let staticLayer: HTMLCanvasElement | null = null
let proj: Projection | null = null
let dpr = 1
let rafId = 0
let observer: ResizeObserver | null = null

function redrawStatic(): void {
  if (staticLayer === null || proj === null) return
  const layerCtx = staticLayer.getContext('2d')
  if (layerCtx === null) return
  layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawStaticLayer(layerCtx, proj, props.points)
}

function resize(): void {
  const el = canvas.value
  const box = frame.value
  if (el === null || box === null) return
  const cssW = Math.floor(box.clientWidth)
  const cssH = Math.floor(box.clientHeight)
  if (cssW < 1 || cssH < 1) return
  dpr = Math.min(2, window.devicePixelRatio || 1)
  el.width = Math.round(cssW * dpr)
  el.height = Math.round(cssH * dpr)
  if (staticLayer === null) staticLayer = document.createElement('canvas')
  staticLayer.width = el.width
  staticLayer.height = el.height
  proj = createProjection(cssW, cssH)
  ctx = el.getContext('2d')
  redrawStatic()
}

function draw(): void {
  const c = ctx
  const layer = staticLayer
  const p = proj
  if (c === null || layer === null || p === null) return
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.drawImage(layer, 0, 0, p.cssWidth, p.cssHeight)
  drawVehicles(c, props.registry, performance.now(), p, props.getStaleNow(), props.selectedId)
}

function loop(): void {
  rafId = requestAnimationFrame(loop)
  draw()
}

function onClick(event: MouseEvent): void {
  if (proj === null) return
  emit('select', findVehicleAt(props.registry, performance.now(), proj, event.offsetX, event.offsetY, 10))
}

// Слой пунктов перерисовывается, только когда изменились их положение, имя или режим.
watch(() => pointsLayoutKey(props.points), redrawStatic)

onMounted(() => {
  resize()
  if (frame.value !== null) {
    observer = new ResizeObserver(resize)
    observer.observe(frame.value)
  }
  rafId = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  observer?.disconnect()
  observer = null
  ctx = null
  staticLayer = null
  proj = null
})
</script>

<template>
  <div class="map">
    <div ref="frame" class="map__frame">
      <canvas
        ref="canvas"
        class="map__canvas"
        role="img"
        aria-label="Схема площадки: пункты и машины"
        @click="onClick"
      ></canvas>
    </div>

    <ul class="legend" aria-label="Обозначения">
      <li v-for="state in VEHICLE_STATES" :key="state" class="legend__item">
        <span class="legend__dot" :style="{ background: STATE_COLORS[state] }"></span>
        {{ STATE_LABELS[state] }}
      </li>
      <li class="legend__item"><span class="legend__ring"></span>Данные устарели</li>
      <li class="legend__item"><span class="legend__square legend__square--auto"></span>Пункт, авто</li>
      <li class="legend__item"><span class="legend__square legend__square--manual"></span>Пункт, ручной</li>
      <li class="legend__item">Сетка: 1 км</li>
    </ul>

    <p v-if="selectedInfo" class="map__info">
      <strong>{{ selectedInfo.name }}</strong>
      · {{ selectedInfo.stateLabel }} · {{ selectedInfo.speedKmh }} км/ч · пункт: {{ selectedInfo.pointName }} ·
      данные от {{ selectedInfo.lastSeen }}
      <span v-if="selectedInfo.stale" class="map__stale">· данные устарели</span>
    </p>
    <p v-else class="map__hint">Нажмите на машину, чтобы увидеть подробности</p>
  </div>
</template>

<style scoped>
.map__frame {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  border: 1px solid #c9c9c9;
  border-radius: 6px;
  overflow: hidden;
}
.map__canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  padding: 0;
  margin: 0.5rem 0;
  list-style: none;
  font-size: 0.875rem;
}
.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}
.legend__dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
}
.legend__ring {
  width: 0.7rem;
  height: 0.7rem;
  border: 2px solid #57606a;
  border-radius: 50%;
}
.legend__square {
  width: 0.7rem;
  height: 0.7rem;
  box-sizing: border-box;
  border: 2px solid #1f2328;
}
.legend__square--auto {
  background: #1f2328;
}
.map__info,
.map__hint {
  margin: 0.25rem 0;
}
.map__hint {
  color: #57606a;
}
.map__stale {
  color: #cf222e;
}
</style>