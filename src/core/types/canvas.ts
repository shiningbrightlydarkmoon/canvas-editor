/**
 * 画布元素接口
 * 定义了画布上的元素共有的属性和方法。
 */
export interface CanvasElement {
  id: string // 元素唯一ID
  type: 'rect' | 'circle' | 'triangle' | 'text' | 'image' // 元素类型
  x: number // 水平位置
  y: number // 垂直位置
  width: number // 宽度
  height: number // 高度
  rotation?: number // 旋转角度
  style: ElementStyle // 样式
  name?: string // 元素名称（可选）
  content?: string // 文本内容（可选）
  imageUrl?: string // 图片URL（可选）
  filters?: FilterConfig[] // 滤镜配置（可选）
}

/**
 * 元素样式接口
 * 定义了画布上元素的样式属性。
 */
export interface ElementStyle {
  fill: string // 填充颜色
  stroke: string // 边框颜色
  strokeWidth: number // 边框宽度
  fontSize?: number // 文字大小
  fontFamily?: string // 字体
  color?: string // 文字颜色
  fontWeight?: number // 字体粗细
  fontStyle?: 'normal' | 'italic' | 'oblique' // 字体样式
  textDecoration?: 'none' | 'underline' | 'line-through' // 文字装饰
}

/**
 * 滤镜配置接口
 * 描述了滤镜的配置属性。
 */
export interface FilterConfig {
  type: 'grayscale' | 'blur' | 'brightness' // 滤镜类型
  value: number // 滤镜值（0-1之间）
}

/**
 * 画布视图状态接口
 * 定义了画布的缩放级别和偏移量。
 */
export interface ViewportState {
  zoom: number // 缩放级别
  x: number // 水平偏移
  y: number // 垂直偏移
}

/**
 * 历史记录接口
 * 用于实现撤销/重做功能
 */
export interface HistoryRecord {
  id: string // 操作记录ID
  timestamp: number // 时间戳
  description: string // 操作描述
  prevState: Record<string, CanvasElement> // 操作前状态
  nextState: Record<string, CanvasElement> // 操作后状态
}

/**
 * 应用状态接口
 * 定义应用的当前工具状态
 */
export interface AppState {
  currentTool: 'select' | 'rect' | 'circle' | 'triangle' | 'text' | 'image' // 当前工具
  isDrawing: boolean // 是否正在绘制
}
