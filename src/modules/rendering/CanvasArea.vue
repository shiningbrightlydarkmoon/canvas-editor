<template>
  <div class="canvas-wrapper">
    <canvas ref="canvasRef" class="pixi-canvas"></canvas>
    <TextEditOverlay
      v-if="editingElement"
      :element="editingElement"
      :zoom="zoom"
      :panX="panX"
      :panY="panY"
      @commit="handleTextCommit"
      @cancel="editingElement = null"
    />
    <div class="viewport-indicator">
      <span class="zoom-label">{{ Math.round(displayZoom * 100) }}%</span>
      <button class="reset-btn" @click="resetView" title="重置视图">⊡</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import * as PIXI from 'pixi.js'
import type { CanvasElement } from '@/core/types'
import { useCanvasStore } from '@/core/store/canvas'
import TextEditOverlay from '@/modules/ui/components/TextEditOverlay.vue'

// === 属性与事件 ===

interface Props {
  elements: CanvasElement[]
  selectedIds: string[]
}

const props = withDefaults(defineProps<Props>(), {
  selectedIds: () => [],
})

const emit = defineEmits<{
  'selection-change': [elements: CanvasElement[]]
}>()

// === PIXI 引用 ===

const canvasRef = ref<HTMLCanvasElement>()
let app: PIXI.Application | null = null
const elementContainers = new Map<string, PIXI.Container>()
const editingElement = ref<CanvasElement | null>(null)

// === 视口状态 ===

let zoom = 1
let panX = 0
let panY = 0
const displayZoom = ref(1)

const HANDLE_SIZE = 8

// === 坐标变换 ===

const screenToCanvas = (sx: number, sy: number) => ({
  x: (sx - panX) / zoom,
  y: (sy - panY) / zoom,
})

const canvasToScreen = (cx: number, cy: number) => ({
  x: cx * zoom + panX,
  y: cy * zoom + panY,
})

// === PIXI 初始化 ===

const initPixi = async () => {
  await nextTick()
  const canvas = canvasRef.value
  if (!canvas) return

  const parent = canvas.parentElement
  if (!parent) return
  const w = parent.clientWidth
  const h = parent.clientHeight

  try {
    const pixiApp = new PIXI.Application()
    await pixiApp.init({
      canvas,
      width: w,
      height: h,
      background: '#ffffff',
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    app = pixiApp

    setupCanvasInteraction()
    renderAllElements()

    const resizeObserver = new ResizeObserver(() => {
      if (app && app.renderer && parent) {
        app.renderer.resize(parent.clientWidth, parent.clientHeight)
        app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height)
      }
    })
    resizeObserver.observe(parent)
  } catch (error) {
    console.error('[PIXI] 初始化失败:', error)
  }
}

// === 渲染 ===

const hexToNumber = (hex: string): number => parseInt(hex.replace('#', '0x'))

const drawShape = (g: PIXI.Graphics, el: CanvasElement) => {
  const r = el.style.cornerRadius ?? 0

  switch (el.type) {
    case 'rect':
      if (r > 0) g.roundRect(0, 0, el.width, el.height, r)
      else g.rect(0, 0, el.width, el.height)
      break
    case 'circle':
      g.circle(el.width / 2, el.height / 2, Math.min(el.width, el.height) / 2)
      break
    case 'triangle':
      g.moveTo(el.width / 2, 0).lineTo(el.width, el.height).lineTo(0, el.height).closePath()
      break
    case 'image':
      g.rect(0, 0, el.width, el.height)
      break
  }
}

const drawSelectionHandles = (container: PIXI.Container, el: CanvasElement) => {
  const hs = HANDLE_SIZE / zoom
  const positions = [
    { x: 0, y: 0 }, { x: el.width / 2, y: 0 }, { x: el.width, y: 0 },
    { x: 0, y: el.height / 2 }, { x: el.width, y: el.height / 2 },
    { x: 0, y: el.height }, { x: el.width / 2, y: el.height }, { x: el.width, y: el.height },
  ]

  positions.forEach((pos) => {
    const handle = new PIXI.Graphics()
    handle.rect(pos.x - hs / 2, pos.y - hs / 2, hs, hs)
    handle.fill({ color: 0xffffff, alpha: 1 })
    handle.stroke({ width: 1.5 / zoom, color: 0x3498db })
    container.addChild(handle)
  })

  const rh = new PIXI.Graphics()
  const rx = el.width / 2
  const ry = -24 / zoom
  const line = new PIXI.Graphics()
  line.moveTo(rx, 0).lineTo(rx, ry)
  line.stroke({ width: 1.5 / zoom, color: 0x3498db })
  container.addChild(line)
  rh.circle(rx, ry, hs / 2 + 1)
  rh.fill({ color: 0x3498db, alpha: 1 })
  container.addChild(rh)
}

const renderElement = (el: CanvasElement, isSelected: boolean): PIXI.Container => {
  const container = new PIXI.Container()
  // pivot 设到中心，使旋转/缩放绕元素中心进行
  container.pivot.set(el.width / 2, el.height / 2)
  container.x = el.x + el.width / 2
  container.y = el.y + el.height / 2

  const graphics = new PIXI.Graphics()
  const fillColor = hexToNumber(el.style.fill || '#ffffff')
  const strokeColor = hexToNumber(el.style.stroke || '#000000')
  const strokeWidth = el.style.strokeWidth ?? 1
  const isTransparent = el.style.fill === 'transparent'
  const alpha = el.opacity ?? 1

  if (el.type === 'text') {
    const textStyle = new PIXI.TextStyle({
      fontSize: el.style.fontSize ?? 16,
      fontFamily: el.style.fontFamily ?? 'Arial',
      fill: el.style.color ?? '#2c3e50',
      fontWeight: (el.style.fontWeight as any) ?? 'normal',
      fontStyle: (el.style.fontStyle as any) ?? 'normal',
      wordWrap: true,
      wordWrapWidth: el.width,
    })

    const text = new PIXI.Text({ text: el.content || '文本', style: textStyle })
    container.addChild(text)
    graphics.rect(0, 0, el.width, el.height)
    graphics.fill({ color: isTransparent ? 0xffffff : fillColor, alpha: isTransparent ? 0.01 : alpha })

    const decor = el.style.textDecoration
    if (decor === 'underline' || decor === 'line-through') {
      const lineY = decor === 'underline' ? text.height + 2 : text.height / 2
      const line = new PIXI.Graphics()
      line.moveTo(0, lineY).lineTo(el.width, lineY)
      line.stroke({ width: 1.5, color: hexToNumber(el.style.color || '#2c3e50') })
      container.addChild(line)
    }
  } else if (el.type === 'image') {
    drawShape(graphics, el)
    graphics.fill({ color: 0xcccccc, alpha: 0.5 })

    if (el.imageUrl) {
      try {
        // 通过 Image 对象加载，PIXI v8 的 Assets 系统对 data URL 支持不稳定
        const img = new Image()
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE)
        sprite.width = el.width
        sprite.height = el.height

        const onLoad = () => {
          sprite.texture = PIXI.Texture.from(img)
        }
        img.onload = onLoad
        img.onerror = onLoad
        img.src = el.imageUrl
        if (img.complete) onLoad()  // data URL 可能已同步加载完成

        if (el.filters && el.filters.length > 0) {
          const pixiFilters: PIXI.Filter[] = []
          el.filters.forEach((f) => {
            if (f.type === 'grayscale') {
              const cf = new PIXI.ColorMatrixFilter()
              const s = f.value
              cf.matrix = [
                0.299 * s + (1 - s), 0.587 * s, 0.114 * s, 0, 0,
                0.299 * s, 0.587 * s + (1 - s), 0.114 * s, 0, 0,
                0.299 * s, 0.587 * s, 0.114 * s + (1 - s), 0, 0,
                0, 0, 0, 1, 0,
              ]
              pixiFilters.push(cf)
            } else if (f.type === 'blur') {
              const bf = new PIXI.BlurFilter()
              bf.blur = f.value * 10
              pixiFilters.push(bf)
            } else if (f.type === 'brightness') {
              const cf = new PIXI.ColorMatrixFilter()
              const b = f.value
              cf.matrix = [b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0]
              pixiFilters.push(cf)
            }
          })
          sprite.filters = pixiFilters
        }
        container.addChildAt(sprite, 0)
      } catch (_) {}
    }
  } else {
    drawShape(graphics, el)
    if (!isTransparent) graphics.fill({ color: fillColor, alpha })
    if (strokeWidth > 0 && el.style.stroke !== 'transparent') graphics.stroke({ width: strokeWidth, color: strokeColor })
  }

  container.addChildAt(graphics, 0)
  if (el.rotation) container.rotation = (el.rotation * Math.PI) / 180

  if (isSelected) {
    const border = new PIXI.Graphics()
    border.rect(-2 / zoom, -2 / zoom, el.width + 4 / zoom, el.height + 4 / zoom)
    border.stroke({ width: 2 / zoom, color: 0x3498db })
    container.addChild(border)
    drawSelectionHandles(container, el)
  }

  container.eventMode = 'static'
  container.cursor = 'pointer'

  return container
}

const renderAllElements = () => {
  if ((dragState.active && dragState.moved) || resizeState.active || rotateState.active) return

  const pixiApp = app
  if (!pixiApp || !pixiApp.renderer) return

  const currentIds = new Set(props.elements.map((e) => e.id))

  for (const [id, container] of elementContainers) {
    if (!currentIds.has(id)) {
      pixiApp.stage.removeChild(container)
      container.destroy({ children: true })
      elementContainers.delete(id)
    }
  }

  props.elements.forEach((el) => {
    const existing = elementContainers.get(el.id)
    if (existing) {
      pixiApp.stage.removeChild(existing)
      existing.destroy({ children: true })
    }
    const container = renderElement(el, props.selectedIds.includes(el.id))
    elementContainers.set(el.id, container)

    const sorted = [...props.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    const insertIndex = sorted.findIndex((e) => e.id === el.id)
    const children = pixiApp.stage.children
    if (insertIndex < children.length) {
      pixiApp.stage.addChildAt(container, insertIndex)
    } else {
      pixiApp.stage.addChild(container)
    }
  })

  setupElementInteraction()
}

// === 手柄命中检测 ===

type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

const getHandleAt = (el: CanvasElement, localX: number, localY: number): HandleType | null => {
  const hs = HANDLE_SIZE / zoom

  const checks: [HandleType, number, number][] = [
    ['nw', 0, 0], ['n', el.width / 2, 0], ['ne', el.width, 0],
    ['w', 0, el.height / 2], ['e', el.width, el.height / 2],
    ['sw', 0, el.height], ['s', el.width / 2, el.height], ['se', el.width, el.height],
  ]

  for (const [type, hx, hy] of checks) {
    if (Math.abs(localX - hx) < hs && Math.abs(localY - hy) < hs) return type
  }

  if (Math.abs(localX - el.width / 2) < hs + 2 && Math.abs(localY - (-24 / zoom)) < hs + 2) return 'rotate'

  return null
}

// === 交互状态 ===

let spaceHeld = false
let isPanning = false
let panStart = { x: 0, y: 0 }
let panStartOffset = { x: 0, y: 0 }

interface DragTarget { id: string; startX: number; startY: number }

const dragState = {
  active: false, moved: false, elementId: '', startCanvasX: 0, startCanvasY: 0,
  elementStartX: 0, elementStartY: 0, isMulti: false, targets: [] as DragTarget[],
}

const resizeState = {
  active: false, elementId: '', handle: null as HandleType | null,
  startCanvasX: 0, startCanvasY: 0, startX: 0, startY: 0, startW: 0, startH: 0,
}

const rotateState = {
  active: false, elementId: '', startAngle: 0, centerX: 0, centerY: 0,
}

const boxSelectState = {
  active: false, startX: 0, startY: 0, graphics: null as PIXI.Graphics | null,
}

// 对齐辅助线
const ALIGN_THRESHOLD = 5
let guideGraphics: PIXI.Graphics | null = null
let currentGuides: { orientation: 'v' | 'h'; position: number }[] = []

const syncDisplayZoom = () => { displayZoom.value = zoom }

const updateStageTransform = () => {
  if (!app) return
  app.stage.scale.set(zoom, zoom)
  app.stage.position.set(panX, panY)
}

const resetView = () => {
  zoom = 1; panX = 0; panY = 0
  updateStageTransform()
  syncDisplayZoom()
}

// === 对齐辅助线 ===

const drawGuides = (guides: { orientation: 'v' | 'h'; position: number }[]) => {
  if (!app) return
  if (!guideGraphics) { guideGraphics = new PIXI.Graphics(); app.stage.addChild(guideGraphics) }
  guideGraphics.clear()
  guides.forEach((g) => {
    if (g.orientation === 'v') {
      guideGraphics!.moveTo(g.position, -panY / zoom)
      guideGraphics!.lineTo(g.position, (-panY + app!.screen.height) / zoom)
    } else {
      guideGraphics!.moveTo(-panX / zoom, g.position)
      guideGraphics!.lineTo((-panX + app!.screen.width) / zoom, g.position)
    }
  })
  guideGraphics.stroke({ width: 1 / zoom, color: 0xe74c3c })
}

const clearGuides = () => { if (guideGraphics) guideGraphics.clear(); currentGuides = [] }

const applyAlignSnap = (nx: number, ny: number, dragEl: CanvasElement, draggedIds: Set<string>): { x: number; y: number } => {
  const guides: { orientation: 'v' | 'h'; position: number }[] = []
  let snappedX = nx; let snappedY = ny

  const others = props.elements.filter((e) => !draggedIds.has(e.id))
  if (others.length === 0) return { x: nx, y: ny }

  const dLeft = nx; const dRight = nx + dragEl.width; const dTop = ny; const dBottom = ny + dragEl.height
  const dCX = nx + dragEl.width / 2; const dCY = ny + dragEl.height / 2
  let bestDX = ALIGN_THRESHOLD + 1; let bestDY = ALIGN_THRESHOLD + 1

  others.forEach((o) => {
    const oLeft = o.x; const oRight = o.x + o.width; const oTop = o.y; const oBottom = o.y + o.height
    const oCX = o.x + o.width / 2; const oCY = o.y + o.height / 2

    const xChecks = [
      { dv: dLeft, ov: oLeft, gp: oLeft }, { dv: dRight, ov: oRight, gp: oRight },
      { dv: dCX, ov: oCX, gp: oCX }, { dv: dLeft, ov: oRight, gp: oRight }, { dv: dRight, ov: oLeft, gp: oLeft },
    ]
    xChecks.forEach((c) => {
      const diff = Math.abs(c.dv - c.ov)
      if (diff < bestDX) { bestDX = diff; snappedX = nx + (c.ov - c.dv); guides.push({ orientation: 'v', position: c.gp }) }
    })

    const yChecks = [
      { dv: dTop, ov: oTop, gp: oTop }, { dv: dBottom, ov: oBottom, gp: oBottom },
      { dv: dCY, ov: oCY, gp: oCY }, { dv: dTop, ov: oBottom, gp: oBottom }, { dv: dBottom, ov: oTop, gp: oTop },
    ]
    yChecks.forEach((c) => {
      const diff = Math.abs(c.dv - c.ov)
      if (diff < bestDY) { bestDY = diff; snappedY = ny + (c.ov - c.dv); guides.push({ orientation: 'h', position: c.gp }) }
    })
  })

  if (guides.length > 0) { currentGuides = guides; drawGuides(guides) } else { clearGuides() }
  return { x: snappedX, y: snappedY }
}

// === 交互提交 ===

const commitInteraction = () => {
  const store = useCanvasStore()

  if (dragState.active) {
    if (dragState.isMulti) {
      dragState.targets.forEach((t) => {
        const c = elementContainers.get(t.id)
        const el = props.elements.find((e) => e.id === t.id)
        if (c && el) store.updateElement(t.id, { x: c.x - el.width / 2, y: c.y - el.height / 2 })
      })
    } else {
      const c = elementContainers.get(dragState.elementId)
      const el = props.elements.find((e) => e.id === dragState.elementId)
      if (c && el) store.updateElement(dragState.elementId, { x: c.x - el.width / 2, y: c.y - el.height / 2 })
    }
    dragState.active = false
    dragState.moved = false
  }

  if (resizeState.active) {
    const c = elementContainers.get(resizeState.elementId)
    if (c) {
      const newW = resizeState.startW * c.scale.x
      const newH = resizeState.startH * c.scale.y
      store.updateElement(resizeState.elementId, {
        x: c.x - newW / 2, y: c.y - newH / 2,
        width: newW, height: newH,
      })
    }
    resizeState.active = false
  }

  if (rotateState.active) {
    const c = elementContainers.get(rotateState.elementId)
    if (c) {
      const deg = (c.rotation * 180) / Math.PI
      store.updateElement(rotateState.elementId, { rotation: deg })
    }
    rotateState.active = false
  }

  clearGuides()
}

// === 画布交互 ===

const setupCanvasInteraction = () => {
  if (!app) return

  app.stage.eventMode = 'static'
  app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height)

  const view = app.renderer.canvas

  view.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault()
    const rect = view.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const worldBefore = screenToCanvas(mouseX, mouseY)
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    zoom = Math.max(0.1, Math.min(10, zoom * delta))
    const worldAfter = screenToCanvas(mouseX, mouseY)

    panX += (worldAfter.x - worldBefore.x) * zoom
    panY += (worldAfter.y - worldBefore.y) * zoom
    updateStageTransform()
    syncDisplayZoom()
  }, { passive: false })

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Space' && !spaceHeld) {
      e.preventDefault()
      spaceHeld = true
      if (app) app.renderer.canvas.style.cursor = 'grab'
    }
  })

  document.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      spaceHeld = false
      if (!isPanning && app) app.renderer.canvas.style.cursor = ''
    }
  })

  app.stage.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
    const isMiddleButton = event.button === 1

    if (isMiddleButton || spaceHeld) {
      isPanning = true
      panStart = { x: event.globalX, y: event.globalY }
      panStartOffset = { x: panX, y: panY }
      if (app) app.renderer.canvas.style.cursor = 'grabbing'
      event.stopPropagation()
      return
    }

    if (event.target === app!.stage) {
      const canvasPos = screenToCanvas(event.globalX, event.globalY)
      boxSelectState.active = true
      boxSelectState.startX = canvasPos.x
      boxSelectState.startY = canvasPos.y
      const rubber = new PIXI.Graphics()
      app!.stage.addChild(rubber)
      boxSelectState.graphics = rubber
    }
  })

  app.stage.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
    if (isPanning) {
      panX = panStartOffset.x + (event.globalX - panStart.x)
      panY = panStartOffset.y + (event.globalY - panStart.y)
      updateStageTransform()
      return
    }

    const current = screenToCanvas(event.globalX, event.globalY)

    if (dragState.active) {
      dragState.moved = true
      const deltaX = current.x - dragState.startCanvasX
      const deltaY = current.y - dragState.startCanvasY

      if (dragState.isMulti) {
        dragState.targets.forEach((t) => {
          const c = elementContainers.get(t.id)
          const el = props.elements.find((e) => e.id === t.id)
          if (c && el) { c.x = t.startX + deltaX + el.width / 2; c.y = t.startY + deltaY + el.height / 2 }
        })
      } else {
        const c = elementContainers.get(dragState.elementId)
        const dragEl = props.elements.find((e) => e.id === dragState.elementId)
        if (c && dragEl) {
          let nx = dragState.elementStartX + deltaX
          let ny = dragState.elementStartY + deltaY
          if (event.shiftKey) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) ny = dragState.elementStartY
            else nx = dragState.elementStartX
          }
          if (!event.shiftKey) {
            const snapped = applyAlignSnap(nx, ny, dragEl, new Set([dragState.elementId]))
            nx = snapped.x; ny = snapped.y
          }
          c.x = nx + dragEl.width / 2; c.y = ny + dragEl.height / 2
        }
      }
    }

    if (resizeState.active) {
      const dx = current.x - resizeState.startCanvasX
      const dy = current.y - resizeState.startCanvasY
      let { x, y, w, h } = { x: resizeState.startX, y: resizeState.startY, w: resizeState.startW, h: resizeState.startH }
      const hType = resizeState.handle

      if (hType === 'nw' || hType === 'w' || hType === 'sw') { x += dx; w -= dx }
      if (hType === 'ne' || hType === 'e' || hType === 'se') { w += dx }
      if (hType === 'nw' || hType === 'n' || hType === 'ne') { y += dy; h -= dy }
      if (hType === 'sw' || hType === 's' || hType === 'se') { h += dy }

      if (event.shiftKey && resizeState.startW > 0 && resizeState.startH > 0) {
        const ratio = resizeState.startW / resizeState.startH
        if (hType === 'nw' || hType === 'ne' || hType === 'sw' || hType === 'se') h = w / ratio
      }

      w = Math.max(20, w); h = Math.max(20, h)
      const c = elementContainers.get(resizeState.elementId)
      if (c) {
        c.x = x + w / 2; c.y = y + h / 2
        c.scale.x = w / resizeState.startW
        c.scale.y = h / resizeState.startH
      }
    }

    if (rotateState.active) {
      const angle = Math.atan2(current.y - rotateState.centerY, current.x - rotateState.centerX)
      let deg = ((angle - rotateState.startAngle) * 180) / Math.PI
      if (event.shiftKey) deg = Math.round(deg / 15) * 15
      const c = elementContainers.get(rotateState.elementId)
      if (c) c.rotation = (deg * Math.PI) / 180
    }

    if (boxSelectState.active) {
      const x = Math.min(boxSelectState.startX, current.x)
      const y = Math.min(boxSelectState.startY, current.y)
      const w = Math.abs(current.x - boxSelectState.startX)
      const h = Math.abs(current.y - boxSelectState.startY)
      if (boxSelectState.graphics) {
        boxSelectState.graphics.clear()
        boxSelectState.graphics.rect(x, y, w, h)
        boxSelectState.graphics.stroke({ width: 1 / zoom, color: 0x3498db })
        boxSelectState.graphics.fill({ color: 0x3498db, alpha: 0.1 })
      }
    }
  })

  app.stage.on('pointerup', (event: PIXI.FederatedPointerEvent) => {
    if (isPanning) { isPanning = false; if (app) app.renderer.canvas.style.cursor = spaceHeld ? 'grab' : ''; return }
    commitInteraction()

    if (boxSelectState.active) {
      const rubber = boxSelectState.graphics
      if (rubber) { app?.stage.removeChild(rubber); rubber.destroy() }
      const current = screenToCanvas(event.globalX, event.globalY)
      const sx = Math.min(boxSelectState.startX, current.x)
      const sy = Math.min(boxSelectState.startY, current.y)
      const sw = Math.abs(current.x - boxSelectState.startX)
      const sh = Math.abs(current.y - boxSelectState.startY)
      if (sw > 3 || sh > 3) {
        const selected = props.elements.filter((el) =>
          el.x < sx + sw && el.x + el.width > sx && el.y < sy + sh && el.y + el.height > sy)
        emit('selection-change', selected)
      } else { emit('selection-change', []) }
      boxSelectState.active = false
    }
  })

  app.stage.on('pointerupoutside', () => {
    if (isPanning) { isPanning = false; if (app) app.renderer.canvas.style.cursor = spaceHeld ? 'grab' : '' }
    if (dragState.active || resizeState.active || rotateState.active) commitInteraction()
    if (boxSelectState.active) {
      const rubber = boxSelectState.graphics
      if (rubber) { app?.stage.removeChild(rubber); rubber.destroy() }
      boxSelectState.active = false
    }
  })
}

// === 元素级交互 ===

const setupElementInteraction = () => {
  if (!app) return

  elementContainers.forEach((container, id) => {
    const el = props.elements.find((e) => e.id === id)
    if (!el) return

    container.removeAllListeners('pointerdown')
    container.removeAllListeners('pointerdblclick')
    container.removeAllListeners('pointermove')

    container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      if (event.button === 1 || spaceHeld) return
      event.stopPropagation()

      const isSelected = props.selectedIds.includes(id)
      const localPos = container.toLocal(event.global)

      if (isSelected) {
        const handle = getHandleAt(el, localPos.x, localPos.y)
        if (handle === 'rotate') {
          const canvasPos = screenToCanvas(event.globalX, event.globalY)
          const cx = el.x + el.width / 2; const cy = el.y + el.height / 2
          rotateState.active = true; rotateState.elementId = id
          rotateState.centerX = cx; rotateState.centerY = cy
          rotateState.startAngle = Math.atan2(canvasPos.y - cy, canvasPos.x - cx) - (el.rotation || 0) * Math.PI / 180
          return
        }
        if (handle) {
          const canvasPos = screenToCanvas(event.globalX, event.globalY)
          resizeState.active = true; resizeState.elementId = id; resizeState.handle = handle
          resizeState.startCanvasX = canvasPos.x; resizeState.startCanvasY = canvasPos.y
          resizeState.startX = el.x; resizeState.startY = el.y
          resizeState.startW = el.width; resizeState.startH = el.height
          return
        }
      }

      if (!isSelected && !event.shiftKey) {
        emit('selection-change', [el])
        const canvasPos = screenToCanvas(event.globalX, event.globalY)
        dragState.active = true; dragState.elementId = id; dragState.isMulti = false
        dragState.startCanvasX = canvasPos.x; dragState.startCanvasY = canvasPos.y
        dragState.elementStartX = el.x; dragState.elementStartY = el.y
        return
      }

      if (event.shiftKey && !isSelected) {
        const selection = [...props.elements.filter((e) => props.selectedIds.includes(e.id)), el]
        emit('selection-change', selection)
        return
      }

      const canvasPos = screenToCanvas(event.globalX, event.globalY)
      const selectedEls = props.elements.filter((e) => props.selectedIds.includes(e.id))
      if (selectedEls.length === 0) selectedEls.push(el)

      dragState.active = true; dragState.elementId = id
      dragState.startCanvasX = canvasPos.x; dragState.startCanvasY = canvasPos.y
      if (selectedEls.length > 1 && props.selectedIds.includes(id)) {
        dragState.isMulti = true
        dragState.targets = selectedEls.map((sel) => ({ id: sel.id, startX: sel.x, startY: sel.y }))
      } else {
        dragState.isMulti = false; dragState.elementStartX = el.x; dragState.elementStartY = el.y
      }
    })

    container.on('pointerdblclick', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation()
      if (el.type === 'text') editingElement.value = el
    })

    container.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
      if (!props.selectedIds.includes(id)) return
      const localPos = container.toLocal(event.global)
      const h = getHandleAt(el, localPos.x, localPos.y)
      const cursors: Record<string, string> = {
        nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
        n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', rotate: 'grab',
      }
      container.cursor = h ? cursors[h] : 'pointer'
    })
  })
}

// === 文本编辑 ===

const handleTextCommit = (content: string) => {
  if (editingElement.value) {
    useCanvasStore().updateElement(editingElement.value.id, { content })
    editingElement.value = null
  }
}

// === 监听器 ===

watch(
  () => [props.elements, props.selectedIds] as const,
  () => { renderAllElements() },
  { deep: true },
)

// === 生命周期 ===

onMounted(() => { initPixi() })

onUnmounted(() => {
  if (app) { app.destroy(true, { children: true, texture: true }); app = null }
  elementContainers.clear()
})
</script>

<style scoped>
.canvas-wrapper {
  width: 100%;
  height: 100%;
  background: #f8f9fa;
  overflow: hidden;
  position: relative;
}

.pixi-canvas {
  display: block;
}

.viewport-indicator {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  z-index: 50;
}

.zoom-label {
  color: #495057;
  font-weight: 500;
  min-width: 40px;
  text-align: center;
}

.reset-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid #dee2e6;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px;
  color: #495057;
}
.reset-btn:hover { background: #f8f9fa; }
</style>
