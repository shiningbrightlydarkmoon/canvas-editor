import type { CanvasElement } from './element'

/**
 * 历史记录操作类型
 * init 表示「初始状态」这一条基线记录，不对应用户操作
 */
export type HistoryActionType = 'init' | 'add' | 'delete' | 'update' | 'move' | 'resize'

/**
 * 历史记录项
 * 用于实现撤销/重做功能
 *
 * 采用「状态序列（0 基）」设计：
 * - records[0] 是初始状态，records[i] 是第 i 次操作之后的状态；
 * - 每条只保存当前这一刻的完整快照，不再同时存 prevState 和 nextState；
 * - N 次操作只需 N + 1 份快照。
 */
export interface HistoryRecord {
  id: string
  timestamp: number
  description: string // 例如: "移动了 3 个元素"

  /** 这一条记录对应的完整画布快照 */
  state: Record<string, CanvasElement>

  type: HistoryActionType
}
