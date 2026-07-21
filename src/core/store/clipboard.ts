import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CanvasElement } from '@/core/types'
import { generateId, deepClone } from '@/lib/utils/id'

export const useClipboardStore = defineStore('clipboard', () => {
  const clipboardData = ref<CanvasElement[]>([])
  const lastAction = ref<'copy' | 'cut' | null>(null)
  const pasteCount = ref(0)

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
