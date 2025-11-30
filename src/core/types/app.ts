import type { ElementType } from './element'

/**
 * 当前激活的工具
 */
export type ToolType = 'select' | ElementType

/**
 * 应用 UI 状态
 */
export interface AppState {
  currentTool: ToolType
  isDrawing: boolean // 是否正在绘制中
}

/**
 * 拖拽限制配置
 */
export interface DragConfig {
  enabled: boolean
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
}

/**
 * 通用操作结果包装器
 */
export interface OperationResult<T = void> {
  success: boolean
  message?: string
  data?: T
}
