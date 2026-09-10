import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CanvasElement } from '@/core/types'
import { generateId, deepClone } from '@/lib/utils/id'

export const useClipboardStore = defineStore('clipboard', () => {
  const clipboardData = ref<CanvasElement[]>([])                // 剪贴板数据，存储被复制或剪切的元素
  const lastAction = ref<'copy' | 'cut' | null>(null)           // 上一次的操作类型，用于判断粘贴时是复制还是剪切
  const pasteCount = ref(0)                                     // 粘贴计数器，用于计算粘贴时的偏移量，避免粘贴的元素完全重叠

  const copy = (elements: CanvasElement[]) => {
    if (elements.length === 0) return false

    pasteCount.value = 0

    clipboardData.value = elements.map(element => ({
      ...deepClone(element),
      id: generateId(),
      x: element.x + 20,
      y: element.y + 20,
      isSelected: false,
      isLocked: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))

    lastAction.value = 'copy'

    return true
  }

  const cut = (elements: CanvasElement[]) => {
    if (elements.length === 0) return false

    copy(elements)
    lastAction.value = 'cut'

    return true
  }

  const paste = () => {
    if (clipboardData.value.length === 0) return []

    pasteCount.value++
    const offset = pasteCount.value * 20

    const pastedElements = clipboardData.value.map(element => ({
      ...deepClone(element),
      id: generateId(),
      x: element.x + offset,
      y: element.y + offset,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))

    return pastedElements
  }

  // 判断剪贴板是否有数据
  const hasData = () => clipboardData.value.length > 0

  const clear = () => {
    clipboardData.value = []
    lastAction.value = null
  }

  return {
    hasData,

    copy,
    cut,
    paste,
    clear
  }
})
