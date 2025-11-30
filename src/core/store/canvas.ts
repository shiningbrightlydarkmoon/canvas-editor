import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CanvasElement, ViewportState, CreateElementInput } from '@/core/types'
import { generateId, deepClone } from '@/lib/utils/id'
import { EventBus, CANVAS_EVENTS } from '@/core/events/EventBus'
import { useClipboardStore } from './clipboard'
import { useHistoryStore } from './history'

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
  const clipboardStore = useClipboardStore()
  const historyStore = useHistoryStore()

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

  // 辅助函数：获取当前最大的 zIndex
  const getMaxZIndex = () => {
    const allElements = Object.values(elements.value)
    if (allElements.length === 0) return 0
    return Math.max(...allElements.map(el => el.zIndex || 0))
  }
  // 辅助函数：获取当前最小的 zIndex
  const getMinZIndex = () => {
    const allElements = Object.values(elements.value)
    if (allElements.length === 0) return 0
    return Math.min(...allElements.map(el => el.zIndex || 0))
  }

  // 元素操作
  const addElement = (elementData: CreateElementInput): string => {
    // 记录操作前状态
    const prevState = deepClone(elements.value)
    const nextZIndex = getMaxZIndex() + 1
    const newElement = createNewElement({
    ...elementData,
    zIndex: nextZIndex // 确保新元素在最顶层
  })
    elements.value[newElement.id] = newElement

    // 添加历史记录
    historyStore.pushHistory(
      `添加${newElement.type}元素`,
      prevState,
      elements.value,
      'add'
    )

    EventBus.emit(CANVAS_EVENTS.ELEMENT_ADDED, newElement)
    return newElement.id
  }

  const updateElement = (id: string, updates: Partial<CanvasElement>): boolean => {
    const existingElement = elements.value[id]
    if (!existingElement) {
      console.warn(`Element ${id} not found`)
      return false
    }

    // 记录操作前状态
    const prevState = deepClone(elements.value)
    const oldElement = deepClone(existingElement)

    // 创建更新后的元素
    const updatedElement: CanvasElement = {
      ...existingElement,
      ...updates,
      updatedAt: Date.now()
    }

    elements.value[id] = updatedElement

    // 添加历史记录
    historyStore.pushHistory(
      `更新${updatedElement.type}元素`,
      prevState,
      elements.value,
      'update'
    )

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


    // 记录操作前状态
    const prevState = deepClone(elements.value)
    delete elements.value[id]
    selectedIds.value = selectedIds.value.filter(selectedId => selectedId !== id)

    // 添加历史记录
    historyStore.pushHistory(
      `删除${element.type}元素`,
      prevState,
      elements.value,
      'delete'
    )

    EventBus.emit(CANVAS_EVENTS.ELEMENT_DELETED, element)
    return true
  }

  const deleteSelectedElements = (): number => {
    const selectedCount = selectedIds.value.length
    if (selectedCount === 0) return 0

    // 记录操作前状态 (用于撤销)
    const prevState = deepClone(elements.value)

    // 暂存要删除的 ID 列表
    const idsToDelete = [...selectedIds.value]

    // 执行删除操作
    idsToDelete.forEach(id => {
      const element = elements.value[id]
      if (element) {
        delete elements.value[id]
        // 如果有图层树组件需要监听单个删除，可以在这里发出事件
        // EventBus.emit(CANVAS_EVENTS.ELEMENT_DELETED, element)
      }
    })

    // 清空选中状态
    selectedIds.value = []

    // 记录历史
    historyStore.pushHistory(
      `删除${selectedCount}个元素`,
      prevState,
      elements.value,
      'delete'
    )

    // 广播事件：通知外部选中状态已变为空
    // 根据 EventBus.ts 定义，这里使用 ELEMENT_SELECTED 事件传递空数组
    EventBus.emit(CANVAS_EVENTS.ELEMENT_SELECTED, [])

    return selectedCount
  }

// 置顶选中元素
const bringToFront = (): void => {
  const selected = selectedElements.value
  if (selected.length === 0) return

  const prevState = deepClone(elements.value)
  let currentMax = getMaxZIndex()

  selected.forEach((el) => {
    currentMax += 1
    const targetElement = elements.value[el.id]
    if (targetElement) {
      targetElement.zIndex = currentMax
      targetElement.updatedAt = Date.now()
    }
  })

  historyStore.pushHistory('置顶元素', prevState, elements.value, 'update')
}

// 置底选中元素
const sendToBack = (): void => {
  const selected = selectedElements.value
  if (selected.length === 0) return

  const prevState = deepClone(elements.value)
  let currentMin = getMinZIndex()

  selected.forEach((el) => {
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

  // 复制所有选中的额元素
  const copySelectedElements = (): void => {
    if (selectedElements.value.length === 0) return
    clipboardStore.copy(selectedElements.value)
  }

  // 剪切选中元素
  const cutSelectedElements = (): void => {
    if (selectedElements.value.length === 0) return

    const result = clipboardStore.cut(selectedElements.value)
    if (result) {
      // 剪切后删除原元素
      deleteSelectedElements()
    }
  }

  // 粘贴元素
  const pasteElements = (): number => {
    if (!canPaste()) return 0

    // 记录操作前的状态 (PrevState)
    const prevState = deepClone(elements.value)

    const pastedElements = clipboardStore.paste()

    // 添加到画布
    pastedElements.forEach((element: CanvasElement) => {
      elements.value[element.id] = element
      EventBus.emit(CANVAS_EVENTS.ELEMENT_ADDED, element)
    })

    // 如果有粘贴内容，记录历史并选中
    if (pastedElements.length > 0) {
      // 记录历史
      historyStore.pushHistory(
        `粘贴${pastedElements.length}个元素`,
        prevState,         // 粘贴前的状态
        elements.value,    // 粘贴后的状态
        'add'
      )

      // 选中新粘贴的元素
      selectMultiple(pastedElements.map(el => el.id))
    }

    return pastedElements.length
  }

  // 检查是否可粘贴
  const canPaste = (): boolean => {
    return clipboardStore.hasData()
  }

  // 撤销重做
  const undo = (): void => {
    const prevState = historyStore.undo()
    if (prevState) {
      elements.value = deepClone(prevState)
      // 撤销后清除选中状态
      clearSelection()
    }
  }

  const redo = (): void => {
    const nextState = historyStore.redo()
    if (nextState) {
      elements.value = deepClone(nextState)
      // 重做后清除选中状态
      clearSelection()
    }
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

    // 图层操作
    bringToFront,
    sendToBack,

    // 选择操作
    selectElement,
    selectMultiple,
    clearSelection,
    toggleElementSelection,

    // 复制粘贴方法
    copySelectedElements,
    cutSelectedElements,
    pasteElements,
    canPaste,

    // 撤销重做
    undo,
    redo,
    canUndo: computed(() => historyStore.canUndo),
    canRedo: computed(() => historyStore.canRedo),

    // 视图操作
    updateViewport,
    resetViewport,
    zoomToFit,

    // 初始化
    initializeWithSampleData,
  }
})
