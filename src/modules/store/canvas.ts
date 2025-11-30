import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CanvasElement, ViewportState } from '@/core/types'
import { generateId } from '@/lib/utils/id'

export const useCanvasStore = defineStore('canvas', () => {
  const elements = ref<Record<string, CanvasElement>>({})
  const selectedIds = ref<string[]>([])
  const viewport = ref<ViewportState>({ zoom: 1, x: 0, y: 0 })

  const addElement = (element: Omit<CanvasElement, 'id'>) => {
    const id = generateId()
    elements.value[id] = { ...element, id }
    return id
  }

  const getElements = () => {
    return Object.values(elements.value)
  }

  return {
    elements,
    selectedIds,
    viewport,
    addElement,
    getElements,
  }
})
