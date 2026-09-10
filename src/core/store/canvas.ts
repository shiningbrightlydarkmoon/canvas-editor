import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { CanvasElement, ViewportState, CreateElementInput } from '@/core/types'
import { generateId, deepClone, debounce } from '@/lib/utils/id'
import { useClipboardStore } from './clipboard'
import { useHistoryStore } from './history'
import { saveToDB, loadFromDB } from '@/lib/utils/storage'



// 辅助函数，把用户输入的元素数据 CreateElementInput 转换为完整的 CanvasElement 对象
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
    createdAt: now,                                     // 设置创建时间为当前时间
    updatedAt: now,                                     // 设置更新时间为当前时间
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
  const elements = ref<Record<string, CanvasElement>>({})         // 存储所有画布元素的对象，键为元素 ID，值为 CanvasElement 对象
  const selectedIds = ref<string[]>([])                           // 存储当前选中的元素 ID 数组
  const viewport = ref<ViewportState>({ zoom: 1, x: 0, y: 0 })    // 存储画布的视口状态，包括缩放比例和偏移量
  const clipboardStore = useClipboardStore()                      // 引用剪贴板存储，用于处理复制、剪切和粘贴操作
  const historyStore = useHistoryStore()                          // 引用历史记录存储，用于处理撤销和重做操作

  // 计算属性，返回当前选中的元素对象数组，并按 zIndex 排序
  const selectedElements = computed((): CanvasElement[] => {
    const result: CanvasElement[] = []
    selectedIds.value.forEach(id => {
      const element = elements.value[id]
      if (element) {
        result.push(element)
      }
    })
    // 按 zIndex 从小到大排序
    return result.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  })

  // 判断是否有选中的元素
  const hasSelection = computed(() => selectedIds.value.length > 0)

  // 返回当前选中的单个元素的完整数据，如果选中多个或没有选中，则返回 null
  const singleSelectedElement = computed((): CanvasElement | null => {
    if (selectedIds.value.length !== 1) return null
    const elementId = selectedIds.value[0]
    if (!elementId) return null
    return elements.value[elementId] || null
  })

  // 返回所有元素的数组形式，方便遍历和操作
  const elementsArray = computed((): CanvasElement[] => {
    return Object.values(elements.value).filter(element => element !== undefined)
  })


  // 获取当前所有元素的最大 zIndex 值，如果没有元素则返回 0
  const getMaxZIndex = () => {
    const allElements = Object.values(elements.value)
    if (allElements.length === 0) return 0
    return Math.max(...allElements.map(el => el.zIndex || 0))
  }

  // 获取当前所有元素的最小 zIndex 值，如果没有元素则返回 0
  const getMinZIndex = () => {
    const allElements = Object.values(elements.value)
    if (allElements.length === 0) return 0
    return Math.min(...allElements.map(el => el.zIndex || 0))
  }

  // 添加新元素到画布，并返回新元素的 ID。可以选择是否跳过历史记录的保存。
  // 传入参数：元素数据（不完整）， 是否跳过历史记录保存（默认为 false）
  const addElement = (elementData: CreateElementInput, skipHistory = false): string => {
    const prevState = skipHistory ? {} : deepClone(elements.value)      // 是否跳过历史记录保存，如果不跳过则保存当前状态的深拷贝
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

  // 更新元素属性
  // 传入参数：元素 ID，更新的属性对象（部分 CanvasElement 属性）
  const updateElement = (id: string, updates: Partial<CanvasElement>): boolean => {
    const existingElement = elements.value[id]
    if (!existingElement) {
      console.warn(`Element ${id} not found`)
      return false
    }
    if (existingElement.isLocked && updates.isLocked !== false) return false

    const prevState = deepClone(elements.value)

    const updatedElement: CanvasElement = {
      ...existingElement,             // 复制所有旧属性
      ...updates,                     // 覆盖为新属性
      updatedAt: Date.now()           // 更新时间戳
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

  // 删除元素
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

  // 删除所有选中的元素，并返回删除的元素数量
  const deleteSelectedElements = (): number => {
    const selectedCount = selectedIds.value.length
    if (selectedCount === 0) return 0

    const prevState = deepClone(elements.value)
    const idsToDelete = [...selectedIds.value]                  // 复制选中列表，防止在循环中修改原数组导致问题

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

  // 将选中的元素置顶，即将它们的 zIndex 设置为当前最大值 + 1
  const bringToFront = (): void => {
    const selected = selectedElements.value
    if (selected.length === 0) return

    const prevState = deepClone(elements.value)
    let currentMax = getMaxZIndex()

    selected.forEach((el) => {
      if (el.isLocked) return
      currentMax += 1
      const targetElement = elements.value[el.id]            // 获取当前元素的引用
      if (targetElement) {
        targetElement.zIndex = currentMax
        targetElement.updatedAt = Date.now()
      }
    })

    historyStore.pushHistory('置顶元素', prevState, elements.value, 'update')
  }

  // 将选中的元素置底，即将它们的 zIndex 设置为当前最小值 - 1
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

  // 根据元素 ID 获取单个元素对象，如果不存在则返回 null
  const getElement = (id: string): CanvasElement | null => {
    return elements.value[id] || null
  }

  // 获取所有元素的数组形式，方便遍历和操作
  const getAllElements = (): CanvasElement[] => {
    return elementsArray.value
  }

  // 选择单个元素，如果 addToSelection 为 true，则将其添加到当前选中列表，否则替换当前选中列表
  // addToSelection 默认为 false，是否将元素添加到当前选中列表，而不是替换整个选中列表
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

  // 选择多个元素
  const selectMultiple = (ids: string[]): void => {
    const validIds = ids.filter(id => elements.value[id])
    selectedIds.value = validIds
    updateElementsSelectionState()
  }

  // 清楚选中
  const clearSelection = (): void => {
    selectedIds.value = []
    updateElementsSelectionState()
  }

  // 切换元素的选中状态，如果当前已选中则取消选中，否则添加到选中列表
  const toggleElementSelection = (id: string): void => {
    if (selectedIds.value.includes(id)) {
      selectMultiple(selectedIds.value.filter(selectedId => selectedId !== id))
    } else {
      selectElement(id, true)
    }
  }

  // 更新所有元素的 isSelected 状态，以确保它们与 selectedIds 保持一致
  const updateElementsSelectionState = (): void => {
    Object.keys(elements.value).forEach(id => {
      const element = elements.value[id]
      if (element) {
        element.isSelected = selectedIds.value.includes(id)
      }
    })
  }

  // 复制选中的元素
  const copySelectedElements = (): void => {
    if (selectedElements.value.length === 0) return
    clipboardStore.copy(selectedElements.value)
  }

  // 剪切选中的元素
  const cutSelectedElements = (): void => {
    if (selectedElements.value.length === 0) return

    const result = clipboardStore.cut(selectedElements.value)
    if (result) {
      deleteSelectedElements()
    }
  }

  // 粘贴元素到画布中，并返回粘贴的元素数量
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

  // 检查是否可以粘贴元素，即剪贴板中是否有数据
  const canPaste = (): boolean => {
    return clipboardStore.hasData()
  }

  // 撤销
  const undo = (): void => {
    const prevState = historyStore.undo()
    if (prevState) {
      elements.value = deepClone(prevState)
      clearSelection()
    }
  }

  // 重做
  const redo = (): void => {
    const nextState = historyStore.redo()
    if (nextState) {
      elements.value = deepClone(nextState)
      clearSelection()
    }
  }

  // 更新视口状态，可以更新缩放比例和偏移量
  const updateViewport = (updates: Partial<ViewportState>): void => {
    viewport.value = { ...viewport.value, ...updates }
  }

  // 重置视口状态为默认值，即缩放比例为 1，偏移量为 (0, 0)
  const resetViewport = (): void => {
    updateViewport({ zoom: 1, x: 0, y: 0 })
  }

  // 将视口缩放到适合画布内容的大小和位置，这里设置为缩放比例为 0.8，偏移量为 (50, 50)
  // 未调用
  const zoomToFit = (): void => {
    updateViewport({ zoom: 0.8, x: 50, y: 50 })
  }

  // 防抖保存到 IndexedDB，避免频繁写入
  // 使用 deepClone 确保保存的是元素的快照，而不是引用
  // 参数 newVal 是当前元素的状态对象
  const debouncedSave = debounce(async (newVal: Record<string, CanvasElement>) => {
    await saveToDB(deepClone(newVal))
  }, 500)

  // 监听元素变化，深度监听，触发防抖保存
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
