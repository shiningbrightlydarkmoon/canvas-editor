/**
 * 坐标点接口
 */
export interface Point {
  x: number
  y: number
}

/**
 * 尺寸接口
 */
export interface Size {
  width: number
  height: number
}

/**
 * 边界框接口
 */
export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 操作结果接口
 */
export interface OperationResult<T = void> {
  success: boolean
  message?: string
  data?: T
}

/**
 * 拖拽配置接口
 */
export interface DragConfig {
  enabled: boolean
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
}

/**
 * 画布配置接口
 */
export interface CanvasConfig {
  width: number
  height: number
  backgroundColor: string
  gridSize: number
  showGrid: boolean
}
