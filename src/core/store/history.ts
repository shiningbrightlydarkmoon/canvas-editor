import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { HistoryRecord, CanvasElement } from '@/core/types'
import { generateHistoryId, deepClone } from '@/lib/utils/id'

export const useHistoryStore = defineStore('history', () => {
  const historyStack = ref<HistoryRecord[]>([])       // 历史记录栈，存储所有的历史记录
  const currentIndex = ref(-1)                        // 当前历史记录索引，指向 historyStack 中的当前记录
  const maxHistorySize = 50                           // 最大历史记录数量，超过该数量时会删除最早的记录

  const canUndo = computed(() => currentIndex.value > 0)
  const canRedo = computed(() => currentIndex.value < historyStack.value.length - 1)
  const historyCount = computed(() => historyStack.value.length)

  // 将新的历史记录推入历史记录栈中，并更新当前索引
  const pushHistory = (
    description: string,
    prevState: Record<string, CanvasElement>,
    nextState: Record<string, CanvasElement>,
    type: HistoryRecord['type']     // 操作类型（add/update/delete）
  ) => {
    // 如果当前索引不是历史记录栈的最后一个位置，说明用户进行了撤销操作，此时需要删除当前索引之后的所有历史记录， 截断“未来”d的记录
    if (currentIndex.value < historyStack.value.length - 1) {
      historyStack.value = historyStack.value.slice(0, currentIndex.value + 1)
    }

    const record: HistoryRecord = {
      id: generateHistoryId(),
      timestamp: Date.now(),
      description,
      prevState: deepClone(prevState),
      nextState: deepClone(nextState),
      type
    }

    historyStack.value.push(record)

    if (historyStack.value.length > maxHistorySize) {
      historyStack.value.shift()
    } else {
      currentIndex.value = historyStack.value.length - 1
    }
  }

  // 撤销操作，返回上一个状态，如果无法撤销则返回 null
  const undo = () => {
    if (!canUndo.value) return null

    currentIndex.value--
    const record = historyStack.value[currentIndex.value]

    if (!record) return null

    return record.prevState
  }

  const redo = () => {
    if (!canRedo.value) return null

    currentIndex.value++
    const record = historyStack.value[currentIndex.value]

    if (!record) return null

    return record.nextState
  }

  // 清空历史记录栈和当前索引
  const clearHistory = () => {
    historyStack.value = []
    currentIndex.value = -1
  }

  return {
    canUndo,
    canRedo,
    historyCount,
    historyStack,
    pushHistory,
    undo,
    redo,
    clearHistory
  }
})
