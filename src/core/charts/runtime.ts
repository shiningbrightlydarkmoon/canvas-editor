import * as echarts from 'echarts'
import * as PIXI from 'pixi.js'
import type { CanvasElement } from '@/core/types'
import { buildChartOption } from './registry'

/**
 * 图表运行时接口。
 */
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
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2) // 限制最大 DPR，避免离屏渲染过大导致性能问题

  // 在指定的离屏 canvas 傻瓜初始化一个 ECharts 实例
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
  })                                                              // 数据源
  const texture = new PIXI.Texture({ source: textureSource })     // 纹理
  const sprite = new PIXI.Sprite(texture)                         // 显示对象
  sprite.width = width
  sprite.height = height

  // 当前宽高状态，用于判断是否需要 resize ECharts 实例
  let currentWidth = width
  let currentHeight = height
  let disposed = false                                // 标记是否已销毁，避免异步回调在销毁后继续操作
  let refreshFrame: number | null = null              // requestAnimationFrame 的 ID，用于取消未完成的刷新请求

  // 刷新纹理
  const refreshTexture = () => {
    if (disposed) return
    textureSource.update()
  }

  // ECharts 的 setOption 与真实绘制不在同一个同步阶段，监听 rendered/finished
  // 才能确保 PIXI 上传的是图表最终帧，而不是尚未绘制的空白 canvas。
  const refreshAfterRender = () => {
    refreshTexture()                                // 第一次刷，事件触发时立刻
    if (refreshFrame !== null) {
      cancelAnimationFrame(refreshFrame)            // 取消未完成的刷新请求，避免重复刷新
    }
    // 第二刷：再等一个动画帧补刷一次 —— 双保险。
    // 因为 rendered 事件的时机和浏览器合成帧的时机不一定对齐，
    // 某些情况下事件触发时像素还没完全落盘。
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = null
      refreshTexture()
    })
  }
  // 监听 ECharts 渲染完成事件，刷新纹理
  chart.on('rendered', refreshAfterRender)
  chart.on('finished', refreshAfterRender)

  // 更新图表配置与数据
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
          animation: false,            // 关闭ECharts动画
        },
        {
          notMerge: true,
          lazyUpdate: false,
        },
      )
      chart.getZr().flush()           // 强制立即渲染，setOption 是异步的，需要确保 canvas 上的像素已经落盘
      refreshAfterRender()
    } catch (error) {
      console.error('[ECharts] 图表渲染失败:', error)
    }
  }

  // 只调整图表尺寸，不改变图表配置与数据
  const resize = (nextWidth: number, nextHeight: number) => {
    if (nextWidth <= 0 || nextHeight <= 0) return
    chart.resize({ width: nextWidth, height: nextHeight, silent: true })
    sprite.width = nextWidth
    sprite.height = nextHeight
    currentWidth = nextWidth
    currentHeight = nextHeight
    refreshAfterRender()
  }

  // 销毁图表运行时，释放资源
  const destroy = () => {
    disposed = true
    // 清理异步刷新请求，避免在销毁后继续操作 canvas/texture
    if (refreshFrame !== null) {
      cancelAnimationFrame(refreshFrame)
      refreshFrame = null
    }
    chart.off('rendered', refreshAfterRender)
    chart.off('finished', refreshAfterRender)
    chart.dispose()
    sprite.destroy({ children: true })    // 递归销毁子对象
    texture.destroy(true)                 // 销毁纹理及其资源
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
