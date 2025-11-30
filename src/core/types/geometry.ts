/**
 * 坐标点
 */
export interface Point {
  x: number
  y: number
}

/**
 * 尺寸
 */
export interface Size {
  width: number
  height: number
}

/**
 * 边界框 (Bounding Box)
 * 结合了位置和尺寸
 */
export interface Bounds extends Point, Size {}
