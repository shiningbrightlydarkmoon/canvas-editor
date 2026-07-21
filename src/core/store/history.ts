import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { HistoryRecord, CanvasElement } from '@/core/types'
import { generateHistoryId, deepClone } from '@/lib/utils/id'

export const useHistoryStore = defineStore('history', () => {
  const historyStack = ref<HistoryRecord[]>([])
  const currentIndex = ref(-1)
  const maxHistorySize = 50

  const canUndo = computed(() => currentIndex.value > 0)
  const canRedo = computed(() => currentIndex.value < historyStack.value.length - 1)
  const historyCount = computed(() => historyStack.value.length)

  const pushHistory = (
    description: string,
    prevState: Record<string, CanvasElement>,
    nextState: Record<string, CanvasElement>,
    type: HistoryRecord['type']
  ) => {
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

  const clearHistory = () => {
    historyStack.value = []
    currentIndex.value = -1
  }

  return {
    canUndo,
    canRedo,
    historyCount,

    pushHistory,
    undo,
    redo,
    clearHistory
  }
})
