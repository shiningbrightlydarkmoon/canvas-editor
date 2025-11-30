// 基础枚举

/**
 * 元素类型
 */
export type ElementType = 'rect' | 'circle' | 'triangle' | 'text' | 'image'

/**
 * 字体粗细
 */
export type FontWeight = 'normal' | 'bold' | 'lighter' | 'bolder' | number

/**
 * 字体样式
 */
export type FontStyle = 'normal' | 'italic' | 'oblique'

/**
 * 文本装饰线
 */
export type TextDecoration = 'none' | 'underline' | 'line-through'

/**
 * 线条端点样式
 */
export type StrokeLineCap = 'butt' | 'round' | 'square'

/**
 * 滤镜类型
 */
export type FilterType = 'grayscale' | 'blur' | 'brightness'


// 子接口定义

/**
 * 滤镜配置
 */
export interface FilterConfig {
  type: FilterType
  value: number // 0 到 1 之间的数值
}

/**
 * 元素样式接口
 * 定义了画布上元素的视觉表现
 */
export interface ElementStyle {
  // --- 基础填充与描边 ---
  fill: string        // 填充颜色 (Hex 或 rgba)
  stroke: string      // 描边颜色
  strokeWidth: number // 描边宽度

  // --- 文本专属样式 ---
  fontSize?: number
  fontFamily?: string
  color?: string      // 文本颜色
  fontWeight?: FontWeight
  fontStyle?: FontStyle
  textDecoration?: TextDecoration

  // --- 形状专属样式 ---
  cornerRadius?: number // 圆角半径 (仅矩形)
  lineCap?: StrokeLineCap
}

//  核心元素接口

/**
 * 画布元素主接口
 * 定义了画布上所有可操作元素的通用属性。
 */
export interface CanvasElement {
  // 标识符
  id: string
  type: ElementType

  // 几何属性
  x: number
  y: number
  width: number
  height: number
  rotation?: number // 旋转角度 (度数)

  // 视觉属性
  style: ElementStyle
  opacity?: number  // 整体透明度 (0-1)
  zIndex?: number   // 层级 (数值越大越靠前)
  filters?: FilterConfig[] // 滤镜列表

  // 内容属性
  name?: string     // 元素显示名称 (图层面板用)
  content?: string  // 文本内容
  imageUrl?: string // 图片地址

  // 交互状态
  isSelected?: boolean // 是否被选中
  isLocked?: boolean   // 是否锁定 (不可拖拽/编辑)

  // 系统元数据
  createdAt: number // 创建时间戳
  updatedAt: number // 最后更新时间戳
}

// 工具类型

/**
 * 创建元素时的输入参数
 * 用于 store.addElement()，自动剔除由系统生成的字段 (id, 时间戳等)
 */
export type CreateElementInput = Omit<CanvasElement, 'id' | 'createdAt' | 'updatedAt'>
