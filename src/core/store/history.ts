// 撤销重做
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { HistoryRecord, CanvasElement } from '@/core/types'
import { generateHistoryId, deepClone } from '@/lib/utils/id'
import { EventBus, CANVAS_EVENTS } from '@/core/events/EventBus'

export const useHistoryStore = defineStore('history', () => {
  // 状态定义
  const historyStack = ref<HistoryRecord[]>([])
  const currentIndex = ref(-1)
  const maxHistorySize = 50

  // 计算属性
  const canUndo = computed(() => currentIndex.value > 0)
  const canRedo = computed(() => currentIndex.value < historyStack.value.length - 1)
  const historyCount = computed(() => historyStack.value.length)

  // 添加历史记录
  const pushHistory = (
    description: string,
    prevState: Record<string, CanvasElement>,
    nextState: Record<string, CanvasElement>,
    type: HistoryRecord['type']
  ) => {
    // 如果当前不在栈顶，清除后面的记录
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

    // 限制历史记录数量
    if (historyStack.value.length > maxHistorySize) {
      historyStack.value.shift()
    } else {
      currentIndex.value = historyStack.value.length - 1
    }

    EventBus.emit(CANVAS_EVENTS.HISTORY_RECORD_ADDED, record)
    EventBus.emit(CANVAS_EVENTS.HISTORY_CHANGED, {
      canUndo: canUndo.value,
      canRedo: canRedo.value
    })
  }

  // 撤销操作
  const undo = () => {
    if (!canUndo.value) return null

    currentIndex.value--
    const record = historyStack.value[currentIndex.value]

    if (!record) return null

    EventBus.emit(CANVAS_EVENTS.HISTORY_CHANGED, {
      canUndo: canUndo.value,
      canRedo: canRedo.value
    })

    return record.prevState
  }

  // 重做操作
  const redo = () => {
    if (!canRedo.value) return null

    currentIndex.value++
    const record = historyStack.value[currentIndex.value]

    if (!record) return null

    EventBus.emit(CANVAS_EVENTS.HISTORY_CHANGED, {
      canUndo: canUndo.value,
      canRedo: canRedo.value
    })

    return record.nextState
  }

  // ========== 清空历史 ==========
  const clearHistory = () => {
    historyStack.value = []
    currentIndex.value = -1

    EventBus.emit(CANVAS_EVENTS.HISTORY_CHANGED, {
      canUndo: false,
      canRedo: false
    })
  }

  return {
    // 计算属性
    canUndo,
    canRedo,
    historyCount,

    // 方法
    pushHistory,
    undo,
    redo,
    clearHistory
  }
})
