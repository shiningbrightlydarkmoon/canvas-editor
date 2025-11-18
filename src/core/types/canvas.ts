// 画布上的元素
export interface CanvasElement {
  id: string // 元素唯一ID
  type: 'rect' | 'circle' | 'triangle' | 'text' // 元素类型
  x: number // 水平位置
  y: number // 垂直位置
  width: number // 宽度
  height: number // 高度
  style: ElementStyle // 样式
  name?: string // 元素名称（可选）
  content?: string // 文本内容（可选）
}

// 元素样式
export interface ElementStyle {
  fill: string // 填充颜色
  stroke: string // 边框颜色
  strokeWidth: number // 边框宽度
  fontSize?: number // 文字大小
  fontFamily?: string // 字体
  color?: string // 文字颜色
}

// 画布视图状态
export interface ViewportState {
  zoom: number // 缩放级别
  x: number // 水平偏移
  y: number // 垂直偏移
}
