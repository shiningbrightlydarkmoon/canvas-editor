import type { CanvasCommand, CanvasElement } from '@/core/types'

/** 命令是否为空（空事务不写历史） */
export const isEmptyCommand = (cmd: CanvasCommand | null): boolean =>
  !cmd || (cmd.added.length === 0 && cmd.removed.length === 0 && cmd.updated.length === 0)

/** 正向应用一条命令 */
export const applyCommand = (
  dict: Record<string, CanvasElement>,
  cmd: CanvasCommand,
): void => {
  cmd.removed.forEach((el) => {
    delete dict[el.id]
  })
  cmd.added.forEach((el) => {
    dict[el.id] = el
  })
  cmd.updated.forEach(({ after }) => {
    dict[after.id] = after
  })
}

/** 反向应用一条命令（撤销） */
export const revertCommand = (
  dict: Record<string, CanvasElement>,
  cmd: CanvasCommand,
): void => {
  cmd.updated.forEach(({ before }) => {
    dict[before.id] = before
  })
  cmd.added.forEach((el) => {
    delete dict[el.id]
  })
  cmd.removed.forEach((el) => {
    dict[el.id] = el
  })
}

/**
 * 用前后两份字典推导命令。
 * 只做引用比较：元素不可变，所以引用不同即内容不同。
 * 返回 null 表示什么都没变（空操作不产生历史）。
 */
export const diffToCommand = (
  before: Record<string, CanvasElement>,
  after: Record<string, CanvasElement>,
): CanvasCommand | null => {
  const added: CanvasElement[] = []
  const removed: CanvasElement[] = []
  const updated: Array<{ before: CanvasElement; after: CanvasElement }> = []

  for (const id in after) {
    const prev = before[id]
    if (!prev) {
      added.push(after[id] as CanvasElement)
    } else if (prev !== after[id]) {
      updated.push({ before: prev, after: after[id] as CanvasElement })
    }
  }

  for (const id in before) {
    if (!after[id]) removed.push(before[id] as CanvasElement)
  }

  if (added.length === 0 && removed.length === 0 && updated.length === 0) return null

  return { added, removed, updated }
}
