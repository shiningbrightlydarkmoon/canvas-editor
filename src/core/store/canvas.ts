import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CanvasElement, ViewportState, CreateElementInput } from '@/core/types/canvas'
import { generateId, deepClone } from '@/lib/utils/id'
import { EventBus, CANVAS_EVENTS } from '@/core/events/EventBus'

// 创建新元素的辅助函数
const createNewElement = (elementData: CreateElementInput): CanvasElement => {
  const now = Date.now()

  const newElement: CanvasElement = {
    // 必需属性
    id: generateId(),
    type: elementData.type,
    x: elementData.x,
    y: elementData.y,
    width: elementData.width,
    height: elementData.height,
    style: elementData.style,

    // 时间戳
    createdAt: now,
    updatedAt: now,

    // 可选属性（提供默认值）
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
  // 状态定义
  const elements = ref<Record<string, CanvasElement>>({})
  const selectedIds = ref<string[]>([])
  const viewport = ref<ViewportState>({ zoom: 1, x: 0, y: 0 })

  // 计算属性
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

  // 元素操作
  const addElement = (elementData: CreateElementInput): string => {
    const newElement = createNewElement(elementData)
    elements.value[newElement.id] = newElement

    EventBus.emit(CANVAS_EVENTS.ELEMENT_ADDED, newElement)
    return newElement.id
  }

  const updateElement = (id: string, updates: Partial<CanvasElement>): boolean => {
    const existingElement = elements.value[id]
    if (!existingElement) {
      console.warn(`Element ${id} not found`)
      return false
    }

    const oldElement = deepClone(existingElement)

    // 创建更新后的元素
    const updatedElement: CanvasElement = {
      ...existingElement,
      ...updates,
      updatedAt: Date.now()
    }

    elements.value[id] = updatedElement

    EventBus.emit(CANVAS_EVENTS.ELEMENT_UPDATED, {
      element: updatedElement,
      oldElement,
      updates
    })

    return true
  }

  const deleteElement = (id: string): boolean => {
    const element = elements.value[id]
    if (!element) return false

    delete elements.value[id]
    selectedIds.value = selectedIds.value.filter(selectedId => selectedId !== id)

    EventBus.emit(CANVAS_EVENTS.ELEMENT_DELETED, element)
    return true
  }

  const deleteSelectedElements = (): number => {
    const selectedCount = selectedIds.value.length
    if (selectedCount === 0) return 0

    // 记录要删除的元素
    const elementsToDelete = [...selectedIds.value]

    // 删除元素
    elementsToDelete.forEach(id => {
      delete elements.value[id]
    })

    // 清空选择
    selectedIds.value = []

    return selectedCount
  }

  const getElement = (id: string): CanvasElement | null => {
    return elements.value[id] || null
  }

  const getAllElements = (): CanvasElement[] => {
    return elementsArray.value
  }

  // 选择操作
  const selectElement = (id: string, addToSelection = false): void => {
    const element = elements.value[id]
    if (!element) return

    if (addToSelection) {
      // 添加到当前选择
      if (!selectedIds.value.includes(id)) {
        selectedIds.value.push(id)
      }
    } else {
      // 替换当前选择
      selectedIds.value = [id]
    }

    // 更新所有元素的选中状态
    updateElementsSelectionState()

    EventBus.emit(CANVAS_EVENTS.ELEMENT_SELECTED, selectedElements.value)
  }

  const selectMultiple = (ids: string[]): void => {
    // 过滤掉不存在的元素ID
    const validIds = ids.filter(id => elements.value[id])
    selectedIds.value = validIds

    // 更新所有元素的选中状态
    updateElementsSelectionState()

    EventBus.emit(CANVAS_EVENTS.ELEMENT_SELECTED, selectedElements.value)
  }

  const clearSelection = (): void => {
    selectedIds.value = []
    updateElementsSelectionState()
    EventBus.emit(CANVAS_EVENTS.ELEMENT_SELECTED, [])
  }

  const toggleElementSelection = (id: string): void => {
    if (selectedIds.value.includes(id)) {
      selectMultiple(selectedIds.value.filter(selectedId => selectedId !== id))
    } else {
      selectElement(id, true)
    }
  }

  // 更新所有元素的选中状态
  const updateElementsSelectionState = (): void => {
    Object.keys(elements.value).forEach(id => {
      const element = elements.value[id]
      if (element) {
        element.isSelected = selectedIds.value.includes(id)
      }
    })
  }

  // 视图操作
  const updateViewport = (updates: Partial<ViewportState>): void => {
    const oldViewport = { ...viewport.value }
    viewport.value = { ...viewport.value, ...updates }

    EventBus.emit(CANVAS_EVENTS.VIEWPORT_CHANGED, {
      oldViewport,
      newViewport: viewport.value
    })
  }

  const resetViewport = (): void => {
    updateViewport({ zoom: 1, x: 0, y: 0 })
  }

  const zoomToFit = (): void => {
    updateViewport({ zoom: 0.8, x: 50, y: 50 })
  }

  // 初始化示例数据
  const initializeWithSampleData = (): void => {
    // 清空现有数据
    elements.value = {}
    selectedIds.value = []

    // 添加示例矩形
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
    })

    // 添加示例圆形
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
    })

    // 添加示例文本
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
    })
  }

  // 导出
  return {
    // 状态
    elements: computed(() => elements.value),
    selectedIds: computed(() => selectedIds.value),
    viewport: computed(() => viewport.value),

    // 计算属性
    selectedElements,
    hasSelection,
    singleSelectedElement,
    elementsArray,

    // 元素操作
    addElement,
    updateElement,
    deleteElement,
    deleteSelectedElements,
    getElement,
    getAllElements,

    // 选择操作
    selectElement,
    selectMultiple,
    clearSelection,
    toggleElementSelection,

    // 视图操作
    updateViewport,
    resetViewport,
    zoomToFit,

    // 初始化
    initializeWithSampleData,
  }
})
