import type { CanvasElement } from './element'

/**
 * 历史记录的操作类型（仅用于展示/调试，不参与逻辑）
 */
export type HistoryActionType = 'add' | 'delete' | 'update' | 'move' | 'resize' | 'mixed'

/**
 * 画布命令：一次事务内发生的所有变更。
 *
 * 设计要点（结构共享）：
 * - added / removed / updated 里存的是元素**引用**，不是深拷贝。
 * - 前提是元素对象不可变：只整体替换，不原地改字段。
 *   因此"引用相同"就等价于"内容相同"，diff 和撤销都不需要序列化。
 */
export interface CanvasCommand {
  /** 事务内新增的元素（撤销时删除） */
  added: CanvasElement[]
  /** 事务内删除的元素（撤销时加回） */
  removed: CanvasElement[]
  /** 事务内被替换的元素（撤销时换回 before） */
  updated: Array<{ before: CanvasElement; after: CanvasElement }>
}

/** 历史栈里的一条记录：描述 + 命令 */
export interface HistoryEntry {
  id: string
  timestamp: number
  description: string
  type: HistoryActionType
  command: CanvasCommand
}

/** 兼容旧命名 */
export type HistoryRecord = HistoryEntry
