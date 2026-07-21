import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppState } from '@/core/types'

export const useAppStore = defineStore('app', () => {
  const currentTool = ref<AppState['currentTool']>('select')
  const isDrawing = ref(false)
  const isDragging = ref(false)
  const isResizing = ref(false)
  const snapToGrid = ref(true)
  const gridSize = ref(10)

  const setCurrentTool = (tool: AppState['currentTool']) => {
    isDrawing.value = false
    isDragging.value = false
    isResizing.value = false
    currentTool.value = tool
  }

  const setDrawingState = (drawing: boolean) => {
    isDrawing.value = drawing
  }

  const setDraggingState = (dragging: boolean) => {
    isDragging.value = dragging
  }

  const setResizingState = (resizing: boolean) => {
    isResizing.value = resizing
  }

  const toggleSnapToGrid = () => {
    snapToGrid.value = !snapToGrid.value
  }

  return {
    currentTool,
    isDrawing,
    isDragging,
    isResizing,
    snapToGrid,
    gridSize,

    setCurrentTool,
    setDrawingState,
    setDraggingState,
    setResizingState,
    toggleSnapToGrid,
  }
})
