<template>
  <div ref="canvasContainer" class="canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import * as PIXI from 'pixi.js'
import type { CanvasElement, ViewportState } from '@/core/types/canvas'

interface Props {
  zoom?: number
  elements: CanvasElement[]
}

interface Emits {
  (e: 'viewport-change', viewport: ViewportState): void
  (e: 'selection-change', elements: CanvasElement[]): void
}

const props = withDefaults(defineProps<Props>(), {
  zoom: 1,
})

const emit = defineEmits<Emits>()

const canvasContainer = ref<HTMLDivElement>()
let app: PIXI.Application | null = null
const selectedElements = ref<CanvasElement[]>([])

// 扩展 Graphics 类型以存储自定义数据
declare module 'pixi.js' {
  interface Graphics {
    elementData?: CanvasElement
  }
}

onMounted(async () => {
  await nextTick()
  if (!canvasContainer.value) return

  try {
    app = new PIXI.Application({
      width: canvasContainer.value.clientWidth,
      height: canvasContainer.value.clientHeight,
      backgroundColor: 0xf8f9fa,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    canvasContainer.value.appendChild(app.view as HTMLCanvasElement)

    // 设置初始缩放
    if (app.stage) {
      app.stage.scale.set(props.zoom, props.zoom)
    }

    renderElements(props.elements)
  } catch (error) {
    console.error('PIXI 初始化失败:', error)
  }
})

const renderElements = (elementsToRender: CanvasElement[]) => {
  if (!app) return

  // 清空画布
  app.stage.removeChildren()

  // 渲染所有元素
  elementsToRender.forEach((element) => {
    const graphics = new PIXI.Graphics()

    // 设置样式
    if (element.style.fill && element.style.fill !== 'transparent') {
      graphics.beginFill(parseInt(element.style.fill.replace('#', '0x')))
    }

    if (
      element.style.stroke &&
      element.style.stroke !== 'transparent' &&
      element.style.strokeWidth > 0
    ) {
      graphics.lineStyle(
        element.style.strokeWidth,
        parseInt(element.style.stroke.replace('#', '0x')),
      )
    }

    // 绘制形状
    switch (element.type) {
      case 'rect':
        graphics.drawRect(element.x, element.y, element.width, element.height)
        break
      case 'circle':
        graphics.drawCircle(
          element.x + element.width / 2,
          element.y + element.height / 2,
          Math.min(element.width, element.height) / 2,
        )
        break
      case 'triangle':
        // 简单的三角形绘制
        graphics.moveTo(element.x + element.width / 2, element.y)
        graphics.lineTo(element.x + element.width, element.y + element.height)
        graphics.lineTo(element.x, element.y + element.height)
        graphics.lineTo(element.x + element.width / 2, element.y)
        break
      case 'text':
        // 文本元素用矩形表示
        graphics.drawRect(element.x, element.y, element.width, element.height)
        graphics.beginFill(0xffffff, 0.3) // 半透明背景
        graphics.drawRect(element.x, element.y, element.width, element.height)
        break
    }

    graphics.endFill()

    // 添加交互
    graphics.interactive = true
    graphics.cursor = 'pointer'

    // 存储元素数据到自定义属性
    graphics.elementData = element

    graphics.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation()
      handleElementClick(element)
    })

    app!.stage.addChild(graphics)
  })

  // 舞台点击事件（取消选择）
  app.stage.interactive = true
  app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height)
  app.stage.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
    if (event.target === app!.stage) {
      selectedElements.value = []
      emit('selection-change', [])
    }
  })
}

const handleElementClick = (element: CanvasElement) => {
  selectedElements.value = [element]
  emit('selection-change', [element])
}

// 监听元素变化
watch(
  () => props.elements,
  (newElements) => {
    renderElements(newElements)
  },
  { deep: true },
)

// 监听缩放变化
watch(
  () => props.zoom,
  (newZoom) => {
    if (app && app.stage) {
      app.stage.scale.set(newZoom, newZoom)
      emit('viewport-change', { x: 0, y: 0, zoom: newZoom })
    }
  },
)
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  background: #f8f9fa;
}
</style>
