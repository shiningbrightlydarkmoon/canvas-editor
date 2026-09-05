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

// 属性与事件

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
const elementContainers = new Map<string, PIXI.Container>()      // 存储每个元素的PIXI容器，key为元素ID
const editingElement = ref<CanvasElement | null>(null)           // 当前正在编辑的文本元素

// === 视口状态 ===

let zoom = 1
let panX = 0
let panY = 0
const displayZoom = ref(1)

const HANDLE_SIZE = 8

// 坐标变换
// 将屏幕坐标转换为画布坐标（世界坐标）
const screenToCanvas = (sx: number, sy: number) => ({
  x: (sx - panX) / zoom,
  y: (sy - panY) / zoom,
})
// 将画布坐标转换为屏幕坐标
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

// 渲染
// 工具函数，将色号转为PIXI可用的数字
const hexToNumber = (hex: string): number => parseInt(hex.replace('#', '0x'))

// 绘制形状
const drawShape = (g: PIXI.Graphics, el: CanvasElement) => {
  const r = el.style.cornerRadius ?? 0
  // const r = (el.style.cornerRadius !== null && el.style.cornerRadius !== undefined)
  // ? el.style.cornerRadius
  // : 0

  switch (el.type) {
    case 'rect':
      if (r > 0) g.roundRect(0, 0, el.width, el.height, r)
      else g.rect(0, 0, el.width, el.height)
      break
    case 'circle':
      g.ellipse(el.width / 2, el.height / 2, el.width / 2, el.height / 2)
      break
    case 'triangle':
      g.moveTo(el.width / 2, 0).lineTo(el.width, el.height).lineTo(0, el.height).closePath()
      break
    case 'image':
      g.rect(0, 0, el.width, el.height)
      break
  }
}

// 绘制选中元素的手柄
const drawSelectionHandles = (container: PIXI.Container, el: CanvasElement) => {
  const hs = HANDLE_SIZE / zoom
  // 绘制八个角和边的手柄，左上nw，上中n，右上ne，左中w，右中e，左下sw，下中s，右下se
  const positions = [
    { x: 0, y: 0 },
    { x: el.width / 2, y: 0 },
    { x: el.width, y: 0 },
    { x: 0, y: el.height / 2 },
    { x: el.width, y: el.height / 2 },
    { x: 0, y: el.height },
    { x: el.width / 2, y: el.height },
    { x: el.width, y: el.height },
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

// 渲染单个元素
const renderElement = (el: CanvasElement, isSelected: boolean): PIXI.Container => {
  // 创建容器
  const container = new PIXI.Container()
  // pivot 设到中心，使旋转/缩放绕元素中心进行
  container.pivot.set(el.width / 2, el.height / 2)
  container.x = el.x + el.width / 2
  container.y = el.y + el.height / 2

  const graphics = new PIXI.Graphics() // 可绘制文本框的背景框
  const fillColor = hexToNumber(el.style.fill || '#ffffff')
  const strokeColor = hexToNumber(el.style.stroke || '#000000')
  const strokeWidth = el.style.strokeWidth ?? 1
  const isTransparent = el.style.fill === 'transparent'
  const alpha = el.opacity ?? 1

  // 根据元素类型渲染

  if (el.type === 'text') {
    const textStyle = new PIXI.TextStyle({
      fontSize: el.style.fontSize ?? 16,
      fontFamily: el.style.fontFamily ?? 'Arial',
      fill: el.style.color ?? '#2c3e50',
      fontWeight: (el.style.fontWeight as any) ?? 'normal',
      fontStyle: (el.style.fontStyle as any) ?? 'normal',
      wordWrap: true,
      wordWrapWidth: el.width,
      breakWords: true,
    })

    const text = new PIXI.Text({ text: el.content || '文本框', style: textStyle })
    container.addChild(text)

    graphics.rect(0, 0, el.width, el.height)
    graphics.fill({
      color: isTransparent ? 0xffffff : fillColor,
      alpha: isTransparent ? 0.01 : alpha
    })

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
          sprite.texture = PIXI.Texture.from(img)  // v8: 从 Image 创建纹理
        }
        img.onload = onLoad
        img.onerror = onLoad
        img.src = el.imageUrl
        if (img.complete) onLoad()  // data URL 可能已同步加载完成


        // 滤镜（灰度/模糊/亮度），暂未在UI界面使用，但是代码有设定默认值
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
                0, 0, 0, 1, 0
              ]
              pixiFilters.push(cf)
            } else if (f.type === 'blur') {
              const bf = new PIXI.BlurFilter()
              bf.blur = f.value * 10
              pixiFilters.push(bf)
            } else if (f.type === 'brightness') {
              const cf = new PIXI.ColorMatrixFilter()
              const b = f.value
              cf.matrix = [
                b, 0, 0, 0, 0,
                0, b, 0, 0, 0,
                0, 0, b, 0, 0,
                0, 0, 0, 1, 0
              ]
              pixiFilters.push(cf)
            }
          })
          sprite.filters = pixiFilters
        }
        container.addChildAt(sprite, 0)
      } catch (error) {
        console.warn('图片加载失败:', error)
      }
    }
  } else {
    drawShape(graphics, el)
    if (!isTransparent) graphics.fill({ color: fillColor, alpha })
    if (strokeWidth > 0 && el.style.stroke !== 'transparent') graphics.stroke({ width: strokeWidth, color: strokeColor })
  }

  container.addChildAt(graphics, 0)
  if (el.rotation) container.rotation = (el.rotation * Math.PI) / 180

  // 选中状态
  if (isSelected) {
    const border = new PIXI.Graphics()
    border.rect(-2 / zoom, -2 / zoom, el.width + 4 / zoom, el.height + 4 / zoom)
    border.stroke({ width: 2 / zoom, color: 0x3498db })
    container.addChild(border)
    drawSelectionHandles(container, el)
  }

  // 交互设置
  container.eventMode = 'static'  // 响应事件
  container.cursor = 'pointer'    // 鼠标样式

  return container
}


// 渲染所有元素
const renderAllElements = () => {
  // 交互中不渲染，防止冲突
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

  // /渲染/更新现有元素
  props.elements.forEach((el) => {
    // 移除旧容器
    const existing = elementContainers.get(el.id)
    if (existing) {
      pixiApp.stage.removeChild(existing)
      existing.destroy({ children: true })
    }
    // 创建新容器
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

// 手柄命中检测

type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

// 检测鼠标是否点击了手柄，返回手柄类型或 null
const getHandleAt = (el: CanvasElement, localX: number, localY: number): HandleType | null => {
  const hs = HANDLE_SIZE / zoom
  // 八个手柄的中心点坐标
  const checks: [HandleType, number, number][] = [
    ['nw', 0, 0], ['n', el.width / 2, 0], ['ne', el.width, 0],
    ['w', 0, el.height / 2], ['e', el.width, el.height / 2],
    ['sw', 0, el.height], ['s', el.width / 2, el.height], ['se', el.width, el.height],
  ]

  for (const [type, hx, hy] of checks) {
    if (Math.abs(localX - hx) < hs && Math.abs(localY - hy) < hs) return type
  }

  if (Math.abs(localX - el.width / 2) < hs + 2 / zoom && Math.abs(localY - (-24 / zoom)) < hs + 2 / zoom) return 'rotate'

  return null
}

// 交互状态

// 拖拽状态
let spaceHeld = false                  // 空格键是否被按住
let isPanning = false                  // 是否正在平移画布
let panStart = { x: 0, y: 0 }          // 平移鼠标起始点
let panStartOffset = { x: 0, y: 0 }    // 平移起始画布的偏移量

interface DragTarget { id: string; startX: number; startY: number }

const dragState = {
  active: false,                       // 是否正在拖动
  moved: false,                        // 是否移动过（区分“点击”和“拖拽”）
  elementId: '',                       // 当前拖拽的元素ID
  // 鼠标起始位置（世界坐标）
  startCanvasX: 0,
  startCanvasY: 0,
  // 元素起始位置（世界坐标）
  elementStartX: 0,
  elementStartY: 0,
  isMulti: false,                      // 是否多选拖拽
  targets: [] as DragTarget[],         // 多选时所有目标
}

// 缩放状态
const resizeState = {
  active: false,                       // 是否正在缩放
  elementId: '',                       // 当前缩放的元素ID
  handle: null as HandleType | null,   // 当前缩放手柄类型
  // 鼠标起始位置（世界坐标）
  startCanvasX: 0,
  startCanvasY: 0,
  // 元素起始位置和大小（世界坐标）
  startX: 0,
  startY: 0,
  startW: 0,
  startH: 0,
}

// 旋转状态
const rotateState = {
  active: false,                        // 是否正在旋转
  elementId: '',                        // 当前旋转的元素ID
  startAngle: 0,                        // 鼠标起始角度（弧度）
  // 元素中心（世界坐标）
  centerX: 0,
  centerY: 0,
}

// 框选状态
const boxSelectState = {
  active: false,                          // 是否正在框选
  // 鼠标起始位置（世界坐标）
  startX: 0,
  startY: 0,
  graphics: null as PIXI.Graphics | null, // 框选矩形的图形对象
}




// 吸附阈值：距离小于5px时吸附
const ALIGN_THRESHOLD = 5
// 辅助线图形对象
let guideGraphics: PIXI.Graphics | null = null
// let currentGuides: { orientation: 'v' | 'h'; position: number }[] = []

// 手动双击检测—— PixiJS 的 pointerdblclick 在容器重建时不可靠
let lastDblClickTime = 0
// 同步显示最新缩放百分比
const syncDisplayZoom = () => {
  displayZoom.value = zoom
}

const updateStageTransform = () => {
  if (!app) return // 安全检查
  app.stage.scale.set(zoom, zoom)              // 设置缩放
  app.stage.position.set(panX, panY)           // 设置平移
  // 更新点击区域，确保点击事件在缩放和平移后仍然正确
  app.stage.hitArea = new PIXI.Rectangle(
    -panX / zoom,
    -panY / zoom,
    app.screen.width / zoom,
    app.screen.height / zoom
  )
}

// 重置视口
const resetView = () => {
  zoom = 1; panX = 0; panY = 0
  updateStageTransform()
  syncDisplayZoom()
}

// 对齐辅助线
// 画辅助线
const drawGuides = (guides: { orientation: 'v' | 'h'; position: number }[]) => {
  if (!app) return
  if (!guideGraphics) { // 首次创建懒加载
    guideGraphics = new PIXI.Graphics();
    app.stage.addChild(guideGraphics);
  }
  guideGraphics.clear()     // 清空旧线条
  guides.forEach((g) => {
    if (g.orientation === 'v') {
      // 垂直线：从顶部画到底部
      guideGraphics!.moveTo(g.position, -panY / zoom)
      guideGraphics!.lineTo(g.position, (-panY + app!.screen.height) / zoom)
    } else {
      // 水平线：从左边画到右边
      guideGraphics!.moveTo(-panX / zoom, g.position)
      guideGraphics!.lineTo((-panX + app!.screen.width) / zoom, g.position)
    }
  })
  guideGraphics.stroke({ width: 1 / zoom, color: 0xe74c3c })  // 红色线条
}

// 清除辅助线
const clearGuides = () => {
  if (guideGraphics) guideGraphics.clear()
}

const applyAlignSnap = (nx: number, ny: number, dragEl: CanvasElement, draggedIds: Set<string>): { x: number; y: number } => {

  const guides: { orientation: 'v' | 'h'; position: number }[] = []
  let snappedX = nx
  let snappedY = ny

  const others = props.elements.filter((e) => !draggedIds.has(e.id))
  if (others.length === 0) return { x: nx, y: ny }

  const dLeft = nx
  const dRight = nx + dragEl.width
  const dTop = ny
  const dBottom = ny + dragEl.height

  const dCX = nx + dragEl.width / 2
  const dCY = ny + dragEl.height / 2

  let bestDX = ALIGN_THRESHOLD + 1
  let bestDY = ALIGN_THRESHOLD + 1

  others.forEach((o) => {
    const oLeft = o.x                       // 左边缘
    const oRight = o.x + o.width            // 右边缘
    const oTop = o.y                        // 上边缘
    const oBottom = o.y + o.height          // 下边缘
    const oCX = o.x + o.width / 2           // 中心X
    const oCY = o.y + o.height / 2          // 中心Y

    // dv:drag 元素的value（被拖拽元素的值）
    // ov:other 元素的value（其他元素的值）
    // gp:guide position（辅助线位置）
    const xChecks = [
      { dv: dLeft, ov: oLeft, gp: oLeft },          // 左↔左
      { dv: dRight, ov: oRight, gp: oRight },       // 右↔右
      { dv: dCX, ov: oCX, gp: oCX },                // 中↔中
      { dv: dLeft, ov: oRight, gp: oRight },        // 左↔右
      { dv: dRight, ov: oLeft, gp: oLeft },         // 右↔左
    ]
    xChecks.forEach((c) => {
      const diff = Math.abs(c.dv - c.ov)
      if (diff < bestDX) {
        bestDX = diff
        snappedX = nx + (c.ov - c.dv)
        guides.push({ orientation: 'v', position: c.gp })
      }
    })

    const yChecks = [
      { dv: dTop, ov: oTop, gp: oTop },
      { dv: dBottom, ov: oBottom, gp: oBottom },
      { dv: dCY, ov: oCY, gp: oCY },
      { dv: dTop, ov: oBottom, gp: oBottom },
      { dv: dBottom, ov: oTop, gp: oTop },
    ]
    yChecks.forEach((c) => {
      const diff = Math.abs(c.dv - c.ov)
      if (diff < bestDY) {
        bestDY = diff
        snappedY = ny + (c.ov - c.dv)
        guides.push({ orientation: 'h', position: c.gp })
      }
    })
  })

  if (guides.length > 0) {
    drawGuides(guides)
  } else { clearGuides() }

  return { x: snappedX, y: snappedY }
}

// 用户松开鼠标时提交拖拽/缩放/旋转的最终状态到 store

const commitInteraction = () => {
  const store = useCanvasStore()
  // 拖拽提交
  if (dragState.active) {
    // 多选拖拽
    if (dragState.isMulti) {
      dragState.targets.forEach((t) => {
        const c = elementContainers.get(t.id) // 获取PIXI容器
        const el = props.elements.find((e) => e.id === t.id) // 获取元素数据
        if (c && el) {
          store.updateElement(t.id,
          {
            x: c.x - el.width / 2,
            y: c.y - el.height / 2
          }
        )
        }
      })
    } else {
      const c = elementContainers.get(dragState.elementId)
      const el = props.elements.find((e) => e.id === dragState.elementId)
      if (c && el) {
        store.updateElement(dragState.elementId,
        { x: c.x - el.width / 2,
          y: c.y - el.height / 2
        }
      )
      }
    }
    dragState.active = false
    dragState.moved = false
  }
  // 缩放提交
  if (resizeState.active) {
    const c = elementContainers.get(resizeState.elementId)
    if (c) {
      const newW = resizeState.startW * c.scale.x           // 计算新的宽度
      const newH = resizeState.startH * c.scale.y           // 计算新的高度
      store.updateElement(resizeState.elementId, {
        x: c.x - newW / 2,
        y: c.y - newH / 2,
        width: newW,
        height: newH,
      })
    }
    resizeState.active = false
  }
  // 旋转提交
  if (rotateState.active) {
    const c = elementContainers.get(rotateState.elementId)
    if (c) {
      const deg = (c.rotation * 180) / Math.PI       // 弧度 -> 角度
      store.updateElement(rotateState.elementId, { rotation: deg })
    }
    rotateState.active = false
  }
  // 清除辅助线
  clearGuides()
}

// 画布交互

const setupCanvasInteraction = () => {
  if (!app) return

  // 设置画布事件模式
  app.stage.eventMode = 'static'                // 响应事件
  app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height)   // 点击区域

  const view = app.renderer.canvas

  // 滚轮缩放
  view.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault()                                        // 阻止默认滚动行为
    const rect = view.getBoundingClientRect()                 // 获取画布在页面中的位置和大小
    // 计算鼠标在画布上的位置（相对于画布左上角）
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const worldBefore = screenToCanvas(mouseX, mouseY)        // 缩放前鼠标对应的世界坐标
    const delta = e.deltaY > 0 ? 0.9 : 1.1                    // 滚轮向下缩小，向上放大，计算缩放倍率
    zoom = Math.max(0.1, Math.min(10, zoom * delta))          // 限制缩放范围在0.1到10之间

    const worldAfter = screenToCanvas(mouseX, mouseY)         // 缩放后鼠标对应的世界坐标
    // 调整平移量，保持鼠标位置不变
    panX += (worldAfter.x - worldBefore.x) * zoom
    panY += (worldAfter.y - worldBefore.y) * zoom
    updateStageTransform()
    syncDisplayZoom()
  }, { passive: false })

  // 空格键控制平移
  // 按下
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    // 如果焦点在输入框/文本框中，不处 理
    if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
      return
    }
    if (e.code === 'Space' && !spaceHeld) {
      e.preventDefault()
      spaceHeld = true
      // 设置鼠标指针样式为手型
      if (app) app.renderer.canvas.style.cursor = 'grab'
    }
  })
  // 松开
  document.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      spaceHeld = false
      // 恢复鼠标指针样式
      if (!isPanning && app) app.renderer.canvas.style.cursor = ''
    }
  })

  // 鼠标按下事件
  app.stage.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
    // 0: 左键，1: 中键，2: 右键
    const isMiddleButton = event.button === 1
    // 如果是中键按下或空格键被按住，则进入平移模式
    if (isMiddleButton || spaceHeld) {
      isPanning = true
      panStart = { x: event.globalX, y: event.globalY }                  // 鼠标按下的位置
      panStartOffset = { x: panX, y: panY }                              // 当前平移偏移量
      if (app) app.renderer.canvas.style.cursor = 'grabbing'
      event.stopPropagation()
      return
    }

    // 如果点击的是舞台空白区域，开始框选，判断是否进入框选模式
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

  // 鼠标移动事件
  app.stage.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
    // 平移模式
    if (isPanning) {
      // 计算新的画布平移偏移量
      panX = panStartOffset.x + (event.globalX - panStart.x)
      panY = panStartOffset.y + (event.globalY - panStart.y)
      updateStageTransform()
      return
    }

    // 记录鼠标在画布上的位置（世界坐标）
    const current = screenToCanvas(event.globalX, event.globalY)

    // 拖拽模式
    if (dragState.active) {
      dragState.moved = true
      // 计算拖拽的偏移量
      const deltaX = current.x - dragState.startCanvasX
      const deltaY = current.y - dragState.startCanvasY
      // 多选拖拽
      if (dragState.isMulti) {
        dragState.targets.forEach((t) => {
          const c = elementContainers.get(t.id)
          const el = props.elements.find((e) => e.id === t.id)
          if (c && el) {
            c.x = t.startX + deltaX + el.width / 2;
            c.y = t.startY + deltaY + el.height / 2
          }
        })
      } else {
        const c = elementContainers.get(dragState.elementId)
        const dragEl = props.elements.find((e) => e.id === dragState.elementId)
        if (c && dragEl) {
          let nx = dragState.elementStartX + deltaX
          let ny = dragState.elementStartY + deltaY
          // 如果按住 Shift 键，则锁定水平或垂直方向
          if (event.shiftKey) {
            // 注意需要加入锁轴相关代码，此处有bug，暂时注释掉
            // if (Math.abs(deltaX) > Math.abs(deltaY)) ny = dragState.elementStartY
            // else nx = dragState.elementStartX
          }
          // 如果没有按住 Shift 键，则进行对齐吸附
          if (!event.shiftKey) {
            const snapped = applyAlignSnap(nx, ny, dragEl, new Set([dragState.elementId]))
            nx = snapped.x
            ny = snapped.y
          }
          c.x = nx + dragEl.width / 2
          c.y = ny + dragEl.height / 2
        }
      }
    }

    // 缩放模式
    if (resizeState.active) {
      // 计算鼠标移动的偏移量
      const dx = current.x - resizeState.startCanvasX
      const dy = current.y - resizeState.startCanvasY
      // 计算新的位置和大小
      let { x, y, w, h } = { x: resizeState.startX, y: resizeState.startY, w: resizeState.startW, h: resizeState.startH }
      const hType = resizeState.handle

      if (hType === 'nw' || hType === 'w' || hType === 'sw') { x += dx; w -= dx }
      if (hType === 'ne' || hType === 'e' || hType === 'se') { w += dx }
      if (hType === 'nw' || hType === 'n' || hType === 'ne') { y += dy; h -= dy }
      if (hType === 'sw' || hType === 's' || hType === 'se') { h += dy }

      // 如果按住 Shift 键，则保持宽高比
      if (event.shiftKey && resizeState.startW > 0 && resizeState.startH > 0) {
        const ratio = resizeState.startW / resizeState.startH
        if (hType === 'nw' || hType === 'ne' || hType === 'sw' || hType === 'se') h = w / ratio
      }

      // 限制最小宽高为 20px
      w = Math.max(20, w); h = Math.max(20, h)
      // 更新容器位置和缩放
      const c = elementContainers.get(resizeState.elementId)
      if (c) {
        c.x = x + w / 2; c.y = y + h / 2
        c.scale.x = w / resizeState.startW
        c.scale.y = h / resizeState.startH
      }
    }

    // 旋转模式
    if (rotateState.active) {
      // 计算当前鼠标相对于旋转中心的角度
      const angle = Math.atan2(
        current.y - rotateState.centerY,
        current.x - rotateState.centerX
      )
      // 计算旋转角度（弧度 -> 角度）
      let deg = ((angle - rotateState.startAngle) * 180) / Math.PI
      // 如果按住 Shift 键，则角度吸附到 15 度的倍数
      if (event.shiftKey) deg = Math.round(deg / 15) * 15
      const c = elementContainers.get(rotateState.elementId)
      if (c) c.rotation = (deg * Math.PI) / 180
    }

    // 框选模式
    if (boxSelectState.active) {
      const x = Math.min(boxSelectState.startX, current.x)
      const y = Math.min(boxSelectState.startY, current.y)
      const w = Math.abs(current.x - boxSelectState.startX)
      const h = Math.abs(current.y - boxSelectState.startY)
      if (boxSelectState.graphics) {
        boxSelectState.graphics.clear()                                // 清空旧的矩形
        boxSelectState.graphics.rect(x, y, w, h)
        boxSelectState.graphics.stroke({ width: 1 / zoom, color: 0x3498db })
        boxSelectState.graphics.fill({ color: 0x3498db, alpha: 0.1 })
      }
    }
  })

  // 鼠标松开事件
  app.stage.on('pointerup', (event: PIXI.FederatedPointerEvent) => {
    // 如果正在平移画布，则结束平移模式
    if (isPanning) {
      isPanning = false
      if (app) app.renderer.canvas.style.cursor = spaceHeld ? 'grab' : ''
      return
    }
    // 如果正在拖拽、缩放或旋转，则提交交互结果
    commitInteraction()

    // 如果正在框选，则计算选中的元素
    if (boxSelectState.active) {
      // 移除框选矩形
      const rubber = boxSelectState.graphics
      if (rubber) {
        app?.stage.removeChild(rubber)
        rubber.destroy()
      }
      // 计算框选区域
      const current = screenToCanvas(event.globalX, event.globalY)
      const sx = Math.min(boxSelectState.startX, current.x)
      const sy = Math.min(boxSelectState.startY, current.y)
      const sw = Math.abs(current.x - boxSelectState.startX)
      const sh = Math.abs(current.y - boxSelectState.startY)
      if (sw > 3 || sh > 3) {
        let selected: CanvasElement[] = []  // 提前声明
        if (!event.shiftKey) {
          // 部分重叠模式（默认）
          selected = props.elements.filter(el =>
            el.x < sx + sw && el.x + el.width > sx &&
            el.y < sy + sh && el.y + el.height > sy
          )
        } else {
          // 完全包含模式（按住 Shift）
          selected = props.elements.filter(el =>
            el.x >= sx && el.x + el.width <= sx + sw &&
            el.y >= sy && el.y + el.height <= sy + sh
          )
        }
        emit('selection-change', selected)  // 统一发送
      } else { emit('selection-change', []) }
      // 清除框选状态
      boxSelectState.active = false
    }
  })

  // 鼠标在画布外松开事件
  app.stage.on('pointerupoutside', () => {
    if (isPanning) {
      isPanning = false
      if (app) app.renderer.canvas.style.cursor = spaceHeld ? 'grab' : ''
    }
    if (dragState.active || resizeState.active || rotateState.active) commitInteraction()
    if (boxSelectState.active) {
      const rubber = boxSelectState.graphics
      if (rubber) {
        app?.stage.removeChild(rubber)
        rubber.destroy()
      }
      boxSelectState.active = false
    }
  })
}

// 元素级交互

const setupElementInteraction = () => {
  if (!app) return

  elementContainers.forEach((container, id) => {
    const el = props.elements.find((e) => e.id === id)
    if (!el) return

    // 移除旧的事件监听器，防止重复绑定
    container.removeAllListeners('pointerdown')
    container.removeAllListeners('pointerdblclick')
    container.removeAllListeners('pointermove')

    // 鼠标按下事件
    container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      // 手动双击检测：PixiJS pointerdblclick 在容器重建后不可靠，改用时间戳
      const now = Date.now()
      if (now - lastDblClickTime < 300) {
        console.log('触发双击事件', event)
        lastDblClickTime = 0
        if (el.type === 'text') {
          setTimeout(() => {
            editingElement.value = el
          }, 0)
          return
        }
        return
      }
      lastDblClickTime = now

      if (event.button === 1 || spaceHeld) return
      event.stopPropagation()

      const isSelected = props.selectedIds.includes(id)
      const localPos = container.toLocal(event.global)

      // 检测是否点击了手柄
      if (isSelected) {
        const handle = getHandleAt(el, localPos.x, localPos.y)
        if (handle === 'rotate') {
          const canvasPos = screenToCanvas(event.globalX, event.globalY)
          const cx = el.x + el.width / 2            // 元素中心X
          const cy = el.y + el.height / 2           // 元素中心Y
          // 记录旋转状态
          rotateState.active = true
          rotateState.elementId = id
          rotateState.centerX = cx
          rotateState.centerY = cy
          rotateState.startAngle = Math.atan2(canvasPos.y - cy, canvasPos.x - cx) - (el.rotation || 0) * Math.PI / 180
          return
        }
        // 检测是否点击了调整大小手柄
        if (handle) {
          const canvasPos = screenToCanvas(event.globalX, event.globalY)
          resizeState.active = true
          resizeState.elementId = id
          resizeState.handle = handle
          resizeState.startCanvasX = canvasPos.x
          resizeState.startCanvasY = canvasPos.y
          resizeState.startX = el.x
          resizeState.startY = el.y
          resizeState.startW = el.width
          resizeState.startH = el.height
          return
        }
      }

      // 如果点击了未选中的元素，且没有按住 Shift 键，则清空其他选中状态，只选中当前元素
      if (!isSelected && !event.shiftKey) {
        emit('selection-change', [el])
        const canvasPos = screenToCanvas(event.globalX, event.globalY)
        dragState.active = true
        dragState.elementId = id
        dragState.isMulti = false
        dragState.startCanvasX = canvasPos.x
        dragState.startCanvasY = canvasPos.y
        dragState.elementStartX = el.x
        dragState.elementStartY = el.y
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

      dragState.active = true
      dragState.elementId = id
      dragState.startCanvasX = canvasPos.x
      dragState.startCanvasY = canvasPos.y
      if (selectedEls.length > 1 && props.selectedIds.includes(id)) {
        dragState.isMulti = true
        dragState.targets = selectedEls.map((sel) => ({ id: sel.id, startX: sel.x, startY: sel.y }))
      } else {
        dragState.isMulti = false
        dragState.elementStartX = el.x
        dragState.elementStartY = el.y
      }
    })


    container.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
      if (!props.selectedIds.includes(id)) return
      const localPos = container.toLocal(event.global)
      const h = getHandleAt(el, localPos.x, localPos.y)
      // 定义鼠标样式映射
      const cursors: Record<string, string> = {
        nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
        n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', rotate: 'grab',
      }
      container.cursor = h ? cursors[h] : 'pointer'
    })
  })
}

// 文本编辑
const handleTextCommit = (content: string) => {
  if (editingElement.value) {
    useCanvasStore().updateElement(editingElement.value.id, { content })
    editingElement.value = null
  }
}

// 监听器
watch(
  () => [props.elements, props.selectedIds] as const,
  () => { renderAllElements() },
  { deep: true },
)

// 生命周期
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
