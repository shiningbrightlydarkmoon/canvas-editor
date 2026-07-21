import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { CanvasElement, ViewportState, CreateElementInput } from '@/core/types'
import { generateId, deepClone, debounce } from '@/lib/utils/id'
import { useClipboardStore } from './clipboard'
import { useHistoryStore } from './history'
import { saveToDB, loadFromDB } from '@/lib/utils/storage'


// 辅助函数：创建新元素
const createNewElement = (elementData: CreateElementInput): CanvasElement => {
  const now = Date.now()

  const newElement: CanvasElement = {
    id: generateId(),
    type: elementData.type,
    x: elementData.x,
    y: elementData.y,
    width: elementData.width,
    height: elementData.height,
    style: elementData.style,
    createdAt: now,
    updatedAt: now,
    rotation: elementData.rotation ?? 0,
    name: elementData.name,
    content: elementData.content,
    imageUrl: elementData.imageUrl,
    filters: elementData.filters,
    isSelected: false,
    zIndex: elementData.zIndex ?? 0,
    opacity: elementData.opacity ?? 1,
    isLocked: elementData.isLocked ?? false
  }

  return newElement
}

export const useCanvasStore = defineStore('canvas', () => {
  const elements = ref<Record<string, CanvasElement>>({})
  const selectedIds = ref<string[]>([])
  const viewport = ref<ViewportState>({ zoom: 1, x: 0, y: 0 })
  const clipboardStore = useClipboardStore()
  const historyStore = useHistoryStore()

  const selectedElements = computed((): CanvasElement[] => {
    const result: CanvasElement[] = []
    selectedIds.value.forEach(id => {
      const element = elements.value[id]
      if (element) {
        result.push(element)
      }
    })
    return result.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  })

  const hasSelection = computed(() => selectedIds.value.length > 0)

  const singleSelectedElement = computed((): CanvasElement | null => {
    if (selectedIds.value.length !== 1) return null
    const elementId = selectedIds.value[0]
    if (!elementId) return null
    return elements.value[elementId] || null
  })

  const elementsArray = computed((): CanvasElement[] => {
    return Object.values(elements.value).filter(element => element !== undefined)
  })

  const getMaxZIndex = () => {
    const allElements = Object.values(elements.value)
    if (allElements.length === 0) return 0
    return Math.max(...allElements.map(el => el.zIndex || 0))
  }

  const getMinZIndex = () => {
    const allElements = Object.values(elements.value)
    if (allElements.length === 0) return 0
    return Math.min(...allElements.map(el => el.zIndex || 0))
  }

  const addElement = (elementData: CreateElementInput, skipHistory = false): string => {
    const prevState = skipHistory ? {} : deepClone(elements.value)
    const nextZIndex = getMaxZIndex() + 1
    const newElement = createNewElement({
    ...elementData,
    zIndex: nextZIndex
  })
    elements.value[newElement.id] = newElement

    if (!skipHistory) {
      historyStore.pushHistory(
        `添加${newElement.type}元素`,
        prevState,
        elements.value,
        'add'
      )
    }

    return newElement.id
  }

  const updateElement = (id: string, updates: Partial<CanvasElement>): boolean => {
    const existingElement = elements.value[id]
    if (!existingElement) {
      console.warn(`Element ${id} not found`)
      return false
    }
    if (existingElement.isLocked && updates.isLocked !== false) return false

    const prevState = deepClone(elements.value)

    const updatedElement: CanvasElement = {
      ...existingElement,
      ...updates,
      updatedAt: Date.now()
    }

    elements.value[id] = updatedElement

    historyStore.pushHistory(
      `更新${updatedElement.type}元素`,
      prevState,
      elements.value,
      'update'
    )

    return true
  }

  const deleteElement = (id: string): boolean => {
    const element = elements.value[id]
    if (!element) return false
    if (element.isLocked) return false

    const prevState = deepClone(elements.value)
    delete elements.value[id]
    selectedIds.value = selectedIds.value.filter(selectedId => selectedId !== id)

    historyStore.pushHistory(
      `删除${element.type}元素`,
      prevState,
      elements.value,
      'delete'
    )

    return true
  }

  const deleteSelectedElements = (): number => {
    const selectedCount = selectedIds.value.length
    if (selectedCount === 0) return 0

    const prevState = deepClone(elements.value)
    const idsToDelete = [...selectedIds.value]

    idsToDelete.forEach(id => {
      const element = elements.value[id]
      if (element && !element.isLocked) {
        delete elements.value[id]
      }
    })

    selectedIds.value = []

    historyStore.pushHistory(
      `删除${selectedCount}个元素`,
      prevState,
      elements.value,
      'delete'
    )

    return selectedCount
  }

  const bringToFront = (): void => {
    const selected = selectedElements.value
    if (selected.length === 0) return

    const prevState = deepClone(elements.value)
    let currentMax = getMaxZIndex()

    selected.forEach((el) => {
      if (el.isLocked) return
      currentMax += 1
      const targetElement = elements.value[el.id]
      if (targetElement) {
        targetElement.zIndex = currentMax
        targetElement.updatedAt = Date.now()
      }
    })

    historyStore.pushHistory('置顶元素', prevState, elements.value, 'update')
  }

  const sendToBack = (): void => {
    const selected = selectedElements.value
    if (selected.length === 0) return

    const prevState = deepClone(elements.value)
    let currentMin = getMinZIndex()

    selected.forEach((el) => {
      if (el.isLocked) return
      currentMin -= 1
      const targetElement = elements.value[el.id]
      if (targetElement) {
        targetElement.zIndex = currentMin
        targetElement.updatedAt = Date.now()
      }
    })

    historyStore.pushHistory('置底元素', prevState, elements.value, 'update')
  }

  const getElement = (id: string): CanvasElement | null => {
    return elements.value[id] || null
  }

  const getAllElements = (): CanvasElement[] => {
    return elementsArray.value
  }

  const selectElement = (id: string, addToSelection = false): void => {
    const element = elements.value[id]
    if (!element) return

    if (addToSelection) {
      if (!selectedIds.value.includes(id)) {
        selectedIds.value.push(id)
      }
    } else {
      selectedIds.value = [id]
    }

    updateElementsSelectionState()
  }

  const selectMultiple = (ids: string[]): void => {
    const validIds = ids.filter(id => elements.value[id])
    selectedIds.value = validIds
    updateElementsSelectionState()
  }

  const clearSelection = (): void => {
    selectedIds.value = []
    updateElementsSelectionState()
  }

  const toggleElementSelection = (id: string): void => {
    if (selectedIds.value.includes(id)) {
      selectMultiple(selectedIds.value.filter(selectedId => selectedId !== id))
    } else {
      selectElement(id, true)
    }
  }

  const updateElementsSelectionState = (): void => {
    Object.keys(elements.value).forEach(id => {
      const element = elements.value[id]
      if (element) {
        element.isSelected = selectedIds.value.includes(id)
      }
    })
  }

  const copySelectedElements = (): void => {
    if (selectedElements.value.length === 0) return
    clipboardStore.copy(selectedElements.value)
  }

  const cutSelectedElements = (): void => {
    if (selectedElements.value.length === 0) return

    const result = clipboardStore.cut(selectedElements.value)
    if (result) {
      deleteSelectedElements()
    }
  }

  const pasteElements = (): number => {
    if (!canPaste()) return 0

    const prevState = deepClone(elements.value)
    const pastedElements = clipboardStore.paste()

    pastedElements.forEach((element: CanvasElement) => {
      elements.value[element.id] = element
    })

    if (pastedElements.length > 0) {
      historyStore.pushHistory(
        `粘贴${pastedElements.length}个元素`,
        prevState,
        elements.value,
        'add'
      )

      selectMultiple(pastedElements.map(el => el.id))
    }

    return pastedElements.length
  }

  const canPaste = (): boolean => {
    return clipboardStore.hasData()
  }

  const undo = (): void => {
    const prevState = historyStore.undo()
    if (prevState) {
      elements.value = deepClone(prevState)
      clearSelection()
    }
  }

  const redo = (): void => {
    const nextState = historyStore.redo()
    if (nextState) {
      elements.value = deepClone(nextState)
      clearSelection()
    }
  }

  const updateViewport = (updates: Partial<ViewportState>): void => {
    viewport.value = { ...viewport.value, ...updates }
  }

  const resetViewport = (): void => {
    updateViewport({ zoom: 1, x: 0, y: 0 })
  }

  const zoomToFit = (): void => {
    updateViewport({ zoom: 0.8, x: 50, y: 50 })
  }

  const debouncedSave = debounce(async (newVal: Record<string, CanvasElement>) => {
    await saveToDB(deepClone(newVal))
  }, 500)

  watch(elements, (newVal) => {
    debouncedSave(newVal)
  }, { deep: true })


  const initializeWithSampleData = async (): Promise<void> => {
    console.log('尝试从 IndexedDB 加载数据...')
    const saved = await loadFromDB()

    if (saved && Object.keys(saved).length > 0) {
      console.log('加载到已保存的数据')
      elements.value = saved
      selectedIds.value = []
      return
    } else {
      console.log('无存档，加载默认示例')
      elements.value = {}
      selectedIds.value = []
    }

    addElement({
      type: 'rect',
      name: '示例矩形',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      style: {
        fill: '#3498db',
        stroke: '#2980b9',
        strokeWidth: 2,
      }
    }, true)

    addElement({
      type: 'circle',
      name: '示例圆形',
      x: 400,
      y: 150,
      width: 120,
      height: 120,
      style: {
        fill: '#e74c3c',
        stroke: '#c0392b',
        strokeWidth: 1,
      }
    }, true)

    addElement({
      type: 'text',
      name: '示例文本',
      x: 200,
      y: 300,
      width: 150,
      height: 40,
      content: 'Hello Canvas Editor',
      style: {
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#2c3e50',
        fontWeight: 'normal'
      }
    }, true)
  }

  return {
    elements: computed(() => elements.value),
    selectedIds: computed(() => selectedIds.value),
    viewport: computed(() => viewport.value),

    selectedElements,
    hasSelection,
    singleSelectedElement,
    elementsArray,

    addElement,
    updateElement,
    deleteElement,
    deleteSelectedElements,
    getElement,
    getAllElements,

    bringToFront,
    sendToBack,

    selectElement,
    selectMultiple,
    clearSelection,
    toggleElementSelection,

    copySelectedElements,
    cutSelectedElements,
    pasteElements,
    canPaste,

    undo,
    redo,
    canUndo: computed(() => historyStore.canUndo),
    canRedo: computed(() => historyStore.canRedo),

    updateViewport,
    resetViewport,
    zoomToFit,

    initializeWithSampleData,
  }
})
