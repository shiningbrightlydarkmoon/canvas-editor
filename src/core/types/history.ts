import type { CanvasElement } from './element'

/**
 * 历史记录操作类型
 */
export type HistoryActionType = 'add' | 'delete' | 'update' | 'move' | 'resize'

/**
 * 历史记录项
 * 用于实现撤销/重做功能
 */
export interface HistoryRecord {
  id: string
  timestamp: number
  description: string // 例如: "移动了 3 个元素"

  // 操作前后的状态快照
  prevState: Record<string, CanvasElement>
  nextState: Record<string, CanvasElement>

  type: HistoryActionType
}
