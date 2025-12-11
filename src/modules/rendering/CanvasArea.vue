<template>
  <div ref="canvasContainer" class="canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import * as PIXI from 'pixi.js'
import type { CanvasElement, ViewportState } from '@/core/types'

interface Props {
  elements: CanvasElement[]
  selectedIds: string[]
  zoom?: number
}

interface Emits {
  (e: 'viewport-change', viewport: ViewportState): void
  (e: 'selection-change', elements: CanvasElement[]): void
}

const props = withDefaults(defineProps<Props>(), {
  zoom: 1,
  selectedIds: () => [],
})

const emit = defineEmits<Emits>()

const canvasContainer = ref<HTMLDivElement>()
let app: PIXI.Application | null = null

// 扩展 Graphics 类型以存储自定义数据
declare module 'pixi.js' {
  interface Graphics {
    elementData?: CanvasElement
    isSelectable?: boolean
  }
}

onMounted(async () => {
  await nextTick()
  if (!canvasContainer.value) return

  try {
    // ✅ 修复 1：PIXI v8 必须使用 init() 异步初始化
    const pixiApp = new PIXI.Application()

    await pixiApp.init({
      width: canvasContainer.value.clientWidth,
      height: canvasContainer.value.clientHeight,
      backgroundColor: 0xf8f9fa,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: 'webgl', // 显式指定 webgl 模式，防止 WebGPU 兼容性问题
    })

    app = pixiApp // 初始化完成后再赋值

    // ✅ 修复 2：使用 app.canvas (v8)
    canvasContainer.value.appendChild(app.canvas)

    // 设置初始缩放
    if (app.stage) {
      app.stage.scale.set(props.zoom, props.zoom)
    }

    // 监听窗口大小变化
    const resizeObserver = new ResizeObserver(() => {
      if (app && app.renderer && canvasContainer.value) {
        app.renderer.resize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
        // 更新舞台点击区域
        app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height)
      }
    })
    resizeObserver.observe(canvasContainer.value)

    // 初始化完成后手动触发一次渲染
    renderElements(props.elements, props.selectedIds)

  } catch (error) {
    console.error('PIXI 初始化失败:', error)
  }
})

// 组件销毁时清理 PIXI
onUnmounted(() => {
  if (app) {
    app.destroy(true, { children: true, texture: true })
    app = null
  }
})

const renderElements = (elementsToRender: CanvasElement[], selectedIds: string[]) => {
  // ✅ 安全检查：确保 app 和 renderer 已经完全初始化
  if (!app || !app.renderer) return

  // 清空画布
  app.stage.removeChildren()

  // 渲染所有元素
  elementsToRender.forEach((element) => {
    const graphics = new PIXI.Graphics()

    // 准备样式数据
    const strokeWidth = element.style.strokeWidth ?? 1
    const strokeColor = parseInt((element.style.stroke || '#000000').replace('#', '0x'))
    const fillColor = parseInt((element.style.fill || '#ffffff').replace('#', '0x'))
    const isTransparent = element.style.fill === 'transparent'
    const fillAlpha = isTransparent ? 0 : (element.opacity ?? 1)

    // ✅ 修复 3：使用 v8 新绘图 API (消除 drawRect/beginFill 警告)

    // 1. 定义路径 (Context)
    switch (element.type) {
      case 'rect':
        graphics.rect(element.x, element.y, element.width, element.height)
        break
      case 'circle':
        graphics.circle(
          element.x + element.width / 2,
          element.y + element.height / 2,
          Math.min(element.width, element.height) / 2
        )
        break
      case 'triangle':
        graphics.moveTo(element.x + element.width / 2, element.y)
        graphics.lineTo(element.x + element.width, element.y + element.height)
        graphics.lineTo(element.x, element.y + element.height)
        graphics.closePath()
        break
      case 'text':
        // 文本后续单独处理
        break
      case 'image':
        graphics.rect(element.x, element.y, element.width, element.height)
        break
    }

    // 2. 填充 (Fill)
    if (!isTransparent && element.type !== 'text') {
      graphics.fill({ color: fillColor, alpha: fillAlpha })
    } else if (element.type === 'image') {
      // 图片占位符
      graphics.fill({ color: 0xcccccc, alpha: 0.5 })
    }

    // 3. 描边 (Stroke)
    if (strokeWidth > 0 && element.style.stroke !== 'transparent' && element.type !== 'text') {
      graphics.stroke({ width: strokeWidth, color: strokeColor })
    }

    // --- 特殊处理文本 ---
    if (element.type === 'text') {
      const textStyle = new PIXI.TextStyle({
        fontSize: element.style.fontSize ?? 16,
        fill: element.style.color || '#2c3e50',
        fontFamily: element.style.fontFamily || 'Arial',
        wordWrap: true,
        wordWrapWidth: element.width,
      })

      // ✅ 修复 4：PIXI v8 推荐使用对象参数创建 Text
      const text = new PIXI.Text({ text: element.content || '文本', style: textStyle })
      text.x = element.x
      text.y = element.y

      // 添加到 graphics 容器
      graphics.addChild(text)

      // 透明点击区域
      graphics.rect(element.x, element.y, element.width, element.height).fill({ color: 0xffffff, alpha: 0.01 })
    }

    // --- 绘制选中高亮框 ---
    if (selectedIds.includes(element.id)) {
      // 绘制一个新的图形作为高亮框，叠加在上方
      const highlight = new PIXI.Graphics()
      highlight.rect(
        element.x - 2,
        element.y - 2,
        element.width + 4,
        element.height + 4
      )
      highlight.stroke({ width: 2 / props.zoom, color: 0x3498db })
      graphics.addChild(highlight)
    }

    // 添加交互
    graphics.eventMode = 'static' // v8 中 interactive 属性被 eventMode 替代
    graphics.cursor = 'pointer'
    graphics.elementData = element

    graphics.on('pointerdown', (event) => {
      event.stopPropagation()
      const clickedElement = graphics.elementData
      if (clickedElement) {
        emit('selection-change', [clickedElement])
      }
    })
    if(app==null) return;
    app.stage.addChild(graphics)
  })

  // 舞台点击事件（取消选择）
  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen

  app.stage.on('pointerdown', (event) => {
    if (event.target === app?.stage) {
      emit('selection-change', [])
    }
  })
}

// 监听元素变化
watch(
  () => [props.elements, props.selectedIds],
  ([newElements, newSelectedIds]) => {
    renderElements(newElements as CanvasElement[], newSelectedIds as string[])
  },
  { deep: true }
)

// 监听缩放变化
watch(
  () => props.zoom,
  (newZoom) => {
    if (app && app.stage) {
      app.stage.scale.set(newZoom, newZoom)
    }
  },
)
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  background: #f8f9fa;
  overflow: hidden;
}
</style>
