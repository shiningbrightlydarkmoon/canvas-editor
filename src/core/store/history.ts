import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CanvasCommand, HistoryEntry, HistoryActionType } from '@/core/types'
import { generateHistoryId } from '@/lib/utils/id'

/**
 * 撤销/重做：命令栈（而不是快照栈）。
 *
 * - 每条记录存一个 CanvasCommand：本次事务里新增/删除/替换了哪些元素。
 * - 命令里存的是元素**引用**，元素本身不可变（只替换、不原地改），
 *   所以 N 次操作只占 N 条命令，每条只记变化的那几个元素。
 * - 撤销 = 对命令做反向应用；重做 = 正向应用。
 *   不存全量快照，内存从 O(元素数 × 历史条数) 降到 O(变化量)。
 */
export const useHistoryStore = defineStore('history', () => {
  const maxHistorySize = 50 // 最多保留 50 步

  const entries = ref<HistoryEntry[]>([])
  // 指向最近一条「已应用」的命令；-1 表示处于初始状态（还没做过任何操作）
  const currentIndex = ref(-1)

  const canUndo = computed(() => currentIndex.value >= 0)
  const canRedo = computed(() => currentIndex.value < entries.value.length - 1)
  const historyCount = computed(() => entries.value.length)

  /** 记录一条命令（效果已经应用过，由调用方保证） */
  const record = (
    description: string,
    command: CanvasCommand,
    type: HistoryActionType = 'mixed',
  ) => {
    // 撤销过又做了新操作 → 截断「未来」分支，保证历史线性
    if (currentIndex.value < entries.value.length - 1) {
      entries.value = entries.value.slice(0, currentIndex.value + 1)
    }

    entries.value.push({
      id: generateHistoryId(),
      timestamp: Date.now(),
      description,
      type,
      command,
    })

    // 超出上限时丢掉最老的一条，游标始终指向末尾
    if (entries.value.length > maxHistorySize) {
      entries.value.shift()
    }

    currentIndex.value = entries.value.length - 1
  }

  /** 取出需要「反向应用」的命令，并把游标前移 */
  const undo = (): CanvasCommand | null => {
    if (!canUndo.value) return null
    const entry = entries.value[currentIndex.value]
    currentIndex.value -= 1
    return entry?.command ?? null
  }

  /** 取出需要「正向应用」的命令，并把游标后移 */
  const redo = (): CanvasCommand | null => {
    if (!canRedo.value) return null
    currentIndex.value += 1
    return entries.value[currentIndex.value]?.command ?? null
  }

  /** 清空历史（画布内容不变）。加载存档、重置画布时调用。 */
  const clearHistory = () => {
    entries.value = []
    currentIndex.value = -1
  }

  return {
    maxHistorySize,
    entries,
    currentIndex,
    canUndo,
    canRedo,
    historyCount,
    record,
    undo,
    redo,
    clearHistory,
  }
})
