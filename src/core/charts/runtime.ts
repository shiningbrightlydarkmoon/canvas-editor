import * as echarts from 'echarts'
import * as PIXI from 'pixi.js'
import type { CanvasElement } from '@/core/types'
import { buildChartOption } from './registry'

export interface ChartRuntime {
  chart: ReturnType<typeof echarts.init>
  canvas: HTMLCanvasElement
  texture: PIXI.Texture
  sprite: PIXI.Sprite
  update: (element: CanvasElement, width: number, height: number) => void
  resize: (width: number, height: number) => void
  destroy: () => void
}

/**
 * ECharts 离屏渲染适配器。
 * ECharts 仍然运行在 DOM Canvas 上，渲染结果通过 Texture 进入 PIXI 场景图。
 */
export const createChartRuntime = (
  element: CanvasElement,
  width: number,
  height: number,
): ChartRuntime => {
  const canvas = document.createElement('canvas')
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

  const chart = echarts.init(canvas, undefined, {
    renderer: 'canvas',
    width,
    height,
    devicePixelRatio: pixelRatio,
  })

  // 显式按逻辑尺寸与 DPR 管理 canvas，避免 Texture.from 对物理像素二次解释。
  const textureSource = new PIXI.CanvasSource({
    resource: canvas,
    width,
    height,
    resolution: pixelRatio,
    autoDensity: true,
  })
  const texture = new PIXI.Texture({ source: textureSource })
  const sprite = new PIXI.Sprite(texture)
  sprite.width = width
  sprite.height = height

  let currentWidth = width
  let currentHeight = height
  let disposed = false
  let refreshFrame: number | null = null

  const refreshTexture = () => {
    if (disposed) return
    textureSource.update()
  }

  // ECharts 的 setOption 与真实绘制不在同一个同步阶段，监听 rendered/finished
  // 才能确保 PIXI 上传的是图表最终帧，而不是尚未绘制的空白 canvas。
  const refreshAfterRender = () => {
    refreshTexture()
    if (refreshFrame !== null) {
      cancelAnimationFrame(refreshFrame)
    }
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = null
      refreshTexture()
    })
  }

  chart.on('rendered', refreshAfterRender)
  chart.on('finished', refreshAfterRender)

  const update = (nextElement: CanvasElement, nextWidth: number, nextHeight: number) => {
    if (!nextElement.chart) return
    try {
      if (nextWidth !== currentWidth || nextHeight !== currentHeight) {
        chart.resize({ width: nextWidth, height: nextHeight, silent: true })
        currentWidth = nextWidth
        currentHeight = nextHeight
        sprite.width = nextWidth
        sprite.height = nextHeight
      }
      chart.setOption(
        {
          ...buildChartOption(nextElement.chart),
          animation: false,
        },
        {
          notMerge: true,
          lazyUpdate: false,
        },
      )
      chart.getZr().flush()
      refreshAfterRender()
    } catch (error) {
      console.error('[ECharts] 图表渲染失败:', error)
    }
  }

  const resize = (nextWidth: number, nextHeight: number) => {
    if (nextWidth <= 0 || nextHeight <= 0) return
    chart.resize({ width: nextWidth, height: nextHeight, silent: true })
    sprite.width = nextWidth
    sprite.height = nextHeight
    currentWidth = nextWidth
    currentHeight = nextHeight
    refreshAfterRender()
  }

  const destroy = () => {
    disposed = true
    if (refreshFrame !== null) {
      cancelAnimationFrame(refreshFrame)
      refreshFrame = null
    }
    chart.off('rendered', refreshAfterRender)
    chart.off('finished', refreshAfterRender)
    chart.dispose()
    sprite.destroy({ children: true })
    texture.destroy(true)
  }

  update(element, width, height)

  return {
    chart,
    canvas,
    texture,
    sprite,
    update,
    resize,
    destroy,
  }
}
