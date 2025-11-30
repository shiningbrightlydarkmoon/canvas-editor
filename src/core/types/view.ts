/**
 * 视口状态
 * 控制画布的缩放和平移
 */
export interface ViewportState {
  zoom: number
  x: number // 视口偏移量 X
  y: number // 视口偏移量 Y
}

/**
 * 画布全局配置
 * 例如网格大小、背景色等
 */
export interface CanvasConfig {
  width: number
  height: number
  backgroundColor: string
  gridSize: number
  showGrid: boolean
}
