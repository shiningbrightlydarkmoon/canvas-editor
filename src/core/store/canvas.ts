import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { CanvasElement, ViewportState, CreateElementInput } from '@/core/types'
import { generateId, deepClone, debounce } from '@/lib/utils/id'
import { useClipboardStore } from './clipboard'
import { useHistoryStore } from './history'
import { applyCommand, diffToCommand, revertCommand } from './commands'
import { saveToDB, loadFromDB } from '@/lib/utils/storage'
import { createDefaultChartData } from '@/core/charts/normalizeData'
import { normalizeChartType } from '@/core/charts/registry'
import { normalizeTableConfig } from '@/core/tables'

// 判断两个值在业务含义上是否相同。
// 原始值用 Object.is 比较；对象/数组用序列化比较——因为属性面板每次都会构造一个新的
// style 对象，引用必然不同，但内容可能是完全一致的。
const isSameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

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
    createdAt: now, // 设置创建时间为当前时间
    updatedAt: now, // 设置更新时间为当前时间
    rotation: elementData.rotation ?? 0,
    name: elementData.name,
    content: elementData.content,
    imageUrl: elementData.imageUrl,
    chart: elementData.chart, // 设置图表数据，如果元素类型是图表，则包含图表的配置和数据
    table: elementData.table, // 设置表格数据，如果元素类型是表格，则包含行列和单元格内容
    filters: elementData.filters,
    isSelected: false,
    zIndex: elementData.zIndex ?? 0,
    opacity: elementData.opacity ?? 1,
    isLocked: elementData.isLocked ?? false,
  }

  return newElement
}

export const useCanvasStore = defineStore('canvas', () => {
  const elements = ref<Record<string, CanvasElement>>({}) // 存储所有画布元素的对象，键为元素 ID，值为 CanvasElement 对象
  const selectedIds = ref<string[]>([]) // 存储当前选中的元素 ID 数组
  const viewport = ref<ViewportState>({ zoom: 1, x: 0, y: 0 }) // 存储画布的视口状态，包括缩放比例和偏移量
  const clipboardStore = useClipboardStore() // 引用剪贴板存储，用于处理复制、剪切和粘贴操作
  const historyStore = useHistoryStore()

  // 事务执行：入口记一份元素引用的浅拷贝，出口按引用差异推导命令。
  // 元素不可变（只整体替换，不原地改字段），所以引用不同就等于内容不同，
  // 不需要深拷贝；即使某个入口忘了记录，diff 也能自动兜住。
  const runCommand = (description: string, mutate: () => void): void => {
    const before = { ...elements.value }
    mutate()
    const command = diffToCommand(before, elements.value)
    if (command) historyStore.record(description, command)
  } // 引用历史记录存储，用于处理撤销和重做操作

  // 计算属性，返回当前选中的元素对象数组，并按 zIndex 排序
  const selectedElements = computed((): CanvasElement[] => {
    const result: CanvasElement[] = []
    selectedIds.value.forEach((id) => {
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
    return Object.values(elements.value).filter((element) => element !== undefined)
  })

  // 获取当前所有元素的最大 zIndex 值，如果没有元素则返回 0
  const getMaxZIndex = () => {
    const allElements = Object.values(elements.value)
    if (allElements.length === 0) return 0
    return Math.max(...allElements.map((el) => el.zIndex || 0))
  }

  // 获取当前所有元素的最小 zIndex 值，如果没有元素则返回 0
  const getMinZIndex = () => {
    const allElements = Object.values(elements.value)
    if (allElements.length === 0) return 0
    return Math.min(...allElements.map((el) => el.zIndex || 0))
  }

  // 添加新元素到画布，并返回新元素的 ID。可以选择是否跳过历史记录的保存。
  // 传入参数：元素数据（不完整）， 是否跳过历史记录保存（默认为 false）
  const addElement = (elementData: CreateElementInput, skipHistory = false): string => {
    const nextZIndex = getMaxZIndex() + 1
    const newElement = createNewElement({
      ...elementData,
      zIndex: nextZIndex,
    })
    if (skipHistory) {
      elements.value[newElement.id] = newElement
    } else {
      runCommand(`添加${newElement.type}元素`, () => {
        elements.value[newElement.id] = newElement
      })
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

    // 兜底：这次更新没有任何字段真正发生变化时，不写历史。
    // 否则「点一下元素松手」这类空操作也会压入一条可撤销记录，用户撤销时会觉得「按了没反应」。
    const updateKeys = Object.keys(updates) as Array<keyof CanvasElement>
    const hasActualChange = updateKeys.some((key) => !isSameValue(existingElement[key], updates[key]))
    if (!hasActualChange) return false

    const updatedElement: CanvasElement = {
      ...existingElement, // 复制所有旧属性
      ...updates, // 覆盖为新属性
      updatedAt: Date.now(), // 更新时间戳
    }

    runCommand(`更新${updatedElement.type}元素`, () => {
      elements.value[id] = updatedElement
    })

    return true
  }

  // 批量更新属性：整批只写一条历史（多选拖拽、批量对齐这类「一次用户意图」）
  const updateElements = (
    changes: Array<{ id: string; updates: Partial<CanvasElement> }>,
    description?: string,
  ): void => {
    const valid = changes.filter(({ id }) => Boolean(elements.value[id]))
    if (valid.length === 0) return

    runCommand(description ?? `更新${valid.length}个元素`, () => {
      valid.forEach(({ id, updates: elementUpdates }) => {
        const existing = elements.value[id]
        if (!existing) return
        if (existing.isLocked && elementUpdates.isLocked !== false) return
        elements.value[id] = {
          ...existing,
          ...elementUpdates,
          updatedAt: Date.now(),
        }
      })
    })
  }

  // 批量应用一组变更，供 Agent 等自动化流程使用。
  // 整个批次只写入一条历史记录，因此用户可以一次性撤销。
  const applyElementBatch = (
    description: string,
    changes: {
      additions?: CreateElementInput[]
      updates?: Array<{ id: string; updates: Partial<CanvasElement> }>
      deletions?: string[]
    },
  ): string[] => {
    const additions = changes.additions ?? []
    const updates = changes.updates ?? []
    const deletions = changes.deletions ?? []
    if (additions.length === 0 && updates.length === 0 && deletions.length === 0) return []

    const addedIds: string[] = []

    runCommand(description, () => {
      let nextZIndex = getMaxZIndex()

      additions.forEach((input) => {
        nextZIndex += 1
        const element = createNewElement({ ...input, zIndex: input.zIndex ?? nextZIndex })
        elements.value[element.id] = element
        addedIds.push(element.id)
      })

      updates.forEach(({ id, updates: elementUpdates }) => {
        const existing = elements.value[id]
        if (!existing || existing.isLocked) return
        elements.value[id] = {
          ...existing,
          ...elementUpdates,
          updatedAt: Date.now(),
        }
      })

      deletions.forEach((id) => {
        const existing = elements.value[id]
        if (!existing || existing.isLocked) return
        delete elements.value[id]
        selectedIds.value = selectedIds.value.filter((selectedId) => selectedId !== id)
      })
    })

    return addedIds
  }

  // 删除元素
  const deleteElement = (id: string): boolean => {
    const element = elements.value[id]
    if (!element) return false
    if (element.isLocked) return false

    runCommand(`删除${element.type}元素`, () => {
      delete elements.value[id]
      selectedIds.value = selectedIds.value.filter((selectedId) => selectedId !== id)
    })

    return true
  }

  // 删除所有选中的元素，并返回删除的元素数量
  const deleteSelectedElements = (): number => {
    const selectedCount = selectedIds.value.length
    if (selectedCount === 0) return 0

    const idsToDelete = [...selectedIds.value] // 复制选中列表，防止在循环中修改原数组导致问题

    runCommand(`删除${selectedCount}个元素`, () => {
      idsToDelete.forEach((id) => {
        const element = elements.value[id]
        if (element && !element.isLocked) {
          delete elements.value[id]
        }
      })
      selectedIds.value = []
    })

    return selectedCount
  }

  // 判断选中的这批元素是不是已经占据了「最高/最低」的那一段层级。
  // 层级只看相对顺序：已经贴顶了再点置顶，不该产生任何变化，也不该写历史。
  const isAlreadyAtEdge = (ids: string[], edge: 'top' | 'bottom'): boolean => {
    const all = Object.values(elements.value)
    if (all.length === 0) return true
    const sorted = [...all].sort((a, b) =>
      edge === 'top' ? (b.zIndex || 0) - (a.zIndex || 0) : (a.zIndex || 0) - (b.zIndex || 0),
    )
    // 取同样的数量，看前 k 个是不是全都在选中集合里
    return sorted.slice(0, ids.length).every((el) => ids.includes(el.id))
  }

  // 将选中的元素置顶
  const bringToFront = (): void => {
    const selected = selectedElements.value.filter((el) => !el.isLocked)
    if (selected.length === 0) return

    const ids = selected.map((el) => el.id)
    // 已经在最上层 → 空操作（不写历史，也不让 zIndex 无意义地增长）
    if (isAlreadyAtEdge(ids, 'top')) return

    runCommand('置顶元素', () => {
      let currentMax = getMaxZIndex()
      ids.forEach((id) => {
        const targetElement = elements.value[id]
        if (!targetElement) return
        currentMax += 1
        // 不可变：替换整个对象，而不是原地改 zIndex
        elements.value[id] = { ...targetElement, zIndex: currentMax, updatedAt: Date.now() }
      })
    })
  }

  // 将选中的元素置底
  const sendToBack = (): void => {
    const selected = selectedElements.value.filter((el) => !el.isLocked)
    if (selected.length === 0) return

    const ids = selected.map((el) => el.id)
    // 已经在最下层 → 空操作
    if (isAlreadyAtEdge(ids, 'bottom')) return

    runCommand('置底元素', () => {
      let currentMin = getMinZIndex()
      ids.forEach((id) => {
        const targetElement = elements.value[id]
        if (!targetElement) return
        currentMin -= 1
        // 不可变：替换整个对象，而不是原地改 zIndex
        elements.value[id] = { ...targetElement, zIndex: currentMin, updatedAt: Date.now() }
      })
    })
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
    // 选中态只保留 selectedIds 一个真相源；渲染层按 id 自行判断。
  }

  // 选择多个元素
  const selectMultiple = (ids: string[]): void => {
    const validIds = ids.filter((id) => elements.value[id])
    selectedIds.value = validIds
  }

  // 清楚选中
  const clearSelection = (): void => {
    selectedIds.value = []
  }

  // 切换元素的选中状态，如果当前已选中则取消选中，否则添加到选中列表
  const toggleElementSelection = (id: string): void => {
    if (selectedIds.value.includes(id)) {
      selectMultiple(selectedIds.value.filter((selectedId) => selectedId !== id))
    } else {
      selectElement(id, true)
    }
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

    const pastedElements = clipboardStore.paste()

    if (pastedElements.length > 0) {
      runCommand(`粘贴${pastedElements.length}个元素`, () => {
        pastedElements.forEach((element: CanvasElement) => {
          elements.value[element.id] = element
        })
        selectedIds.value = pastedElements.map((el) => el.id)
      })
    }

    return pastedElements.length
  }

  // 检查是否可以粘贴元素，即剪贴板中是否有数据
  const canPaste = (): boolean => {
    return clipboardStore.hasData()
  }

  // 撤销
  const undo = (): void => {
    const command = historyStore.undo()
    if (command) {
      revertCommand(elements.value, command)
      clearSelection()
    }
  }

  // 重做
  const redo = (): void => {
    const command = historyStore.redo()
    if (command) {
      applyCommand(elements.value, command)
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
  // 使用 deepClone 转成普通对象：既脱离响应式引用，也保证可被结构化克隆
  // 参数 newVal 是当前元素的状态对象
  const debouncedSave = debounce(async (newVal: Record<string, CanvasElement>) => {
    await saveToDB(deepClone(newVal))
  }, 500)

  // 监听元素变化，深度监听，触发防抖保存
  watch(
    elements,
    (newVal) => {
      debouncedSave(newVal)
    },
    { deep: true },
  )

  const initializeWithSampleData = async (): Promise<void> => {
    console.log('尝试从 IndexedDB 加载数据...')
    const saved = await loadFromDB()

    if (saved && Object.keys(saved).length > 0) {
      console.log('加载到已保存的数据')
      elements.value = Object.fromEntries(
        Object.entries(saved).map(([id, element]) => [
          id,
          element.type === 'chart'
            ? {
                ...element,
                chart: {
                  chartType: normalizeChartType(element.chart?.chartType),
                  data: element.chart?.data ?? createDefaultChartData(),
                  xField: element.chart?.xField ?? 'month',
                  yFields: element.chart?.yFields ?? ['sales', 'profit'],
                  title: element.chart?.title ?? element.name ?? '图表',
                  showLegend: element.chart?.showLegend,
                },
              }
            : element.type === 'table' && !element.table
              ? {
                  ...element,
                  table: normalizeTableConfig(),
                }
              : element,
        ]),
      )
      selectedIds.value = []
      // 打开画布时清空历史：第一次撤销不会退到空画布
      historyStore.clearHistory()
      return
    } else {
      console.log('无存档，加载默认示例')
      elements.value = {}
      selectedIds.value = []
    }

    addElement(
      {
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
        },
      },
      true,
    )

    addElement(
      {
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
        },
      },
      true,
    )

    addElement(
      {
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
          fontWeight: 'normal',
        },
      },
      true,
    )

    addElement(
      {
        type: 'chart',
        name: '示例图表',
        x: 100,
        y: 400,
        width: 420,
        height: 260,
        style: {
          fill: '#ffffff',
          stroke: 'transparent',
          strokeWidth: 0,
        },
        chart: {
          chartType: 'bar',
          data: createDefaultChartData(),
          xField: 'month',
          yFields: ['sales', 'profit'],
          title: '销售趋势',
        },
      },
      true,
    )

    // 示例数据是用 skipHistory 建出来的，不该进历史；清空历史即可，
    // 于是「第一次撤销」不会发生（canUndo 为 false）。
    historyStore.clearHistory()
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
    updateElements,
    applyElementBatch,
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
