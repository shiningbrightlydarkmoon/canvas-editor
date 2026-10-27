import type {
  AgentOperation,
  CanvasElement,
  CreateElementInput,
  ElementStyle,
} from '@/core/types'
import { normalizeChartData } from '@/core/charts'
import { createTableConfig, normalizeTableConfig } from '@/core/tables'
import type { useCanvasStore } from '@/core/store/canvas'

type CanvasStore = ReturnType<typeof useCanvasStore>

// Agent 创建文本元素时用的默认样式
const DEFAULT_TEXT_STYLE: ElementStyle = {
  fill: 'transparent',
  stroke: 'transparent',
  strokeWidth: 0,
  fontSize: 16,
  fontFamily: 'Arial',
  color: '#273449',
}

// 算新元素默认放在哪里， 避免和现有元素重叠
const getDefaultPosition = (elements: CanvasElement[]) => {
  if (elements.length === 0) return { x: 120, y: 120 }
  const maxX = Math.max(...elements.map((element) => element.x + element.width))
  const minY = Math.min(...elements.map((element) => element.y))
  return { x: maxX + 40, y: minY }
}

// 将未知值转换为数字，如果不是有效数字则返回默认值
const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

// 过滤 LLM 返回的 patch， 只保留“允许修改”的字段
const sanitizeElementPatch = (patch: Partial<CanvasElement>): Partial<CanvasElement> => {
  const allowedKeys: Array<keyof CanvasElement> = [
    'name',
    'x',
    'y',
    'width',
    'height',
    'rotation',
    'opacity',
    'zIndex',
    'isLocked',
    'style',
    'filters',
    'content',
    'imageUrl',
    'chart',
    'table',
  ]

  // Object.fromEntries: 把键值对数组转换为对象
  return Object.fromEntries(
    allowedKeys
      .filter((key) => key in patch)
      .map((key) => [key, patch[key]]),
  ) as Partial<CanvasElement>
}

// 告诉调用方哪些元素被添加了，哪些元素被修改了
export interface AgentApplyResult {
  addedIds: string[]
  affectedIds: string[]
}

// 把 Agent 操作列表翻译成画布的批量更改
// 一次写入，一条历史记录
export const applyAgentOperations = (
  store: CanvasStore,
  operations: AgentOperation[],
): AgentApplyResult => {
  const elements = store.getAllElements()
  const defaultPosition = getDefaultPosition(elements)
  const additions: CreateElementInput[] = []                                      // 要新增的元素
  const updates: Array<{ id: string; updates: Partial<CanvasElement> }> = []      // 要更新的元素
  const deletions: string[] = []                                                  // 要删除的元素 ID
  const affectedIds: string[] = []                                                // 受影响的元素 ID

  operations.forEach((operation) => {
    switch (operation.type) {
      // 创建文本元素
      case 'create-text': {
        additions.push({
          type: 'text',
          name: operation.payload.text.slice(0, 24) || 'AI 文本',
          x: asNumber(operation.payload.x, defaultPosition.x),
          y: asNumber(operation.payload.y, defaultPosition.y),
          width: asNumber(operation.payload.width, 240),
          height: asNumber(operation.payload.height, 52),
          content: operation.payload.text,
          style: { ...DEFAULT_TEXT_STYLE, ...operation.payload.style },
        })
        break
      }

      // 创建图表元素
      case 'create-chart': {
        const data = normalizeChartData(operation.payload.data)
        if (data.columns.length === 0 || data.rows.length === 0) {
          throw new Error('创建图表失败：缺少有效数据')
        }
        const xField = operation.payload.xField ?? data.columns[0]?.key
        const yFields =
          operation.payload.yFields?.filter((key) =>
            data.columns.some((column) => column.key === key),
          ) ?? data.columns.filter((column) => column.type === 'number').map((column) => column.key)

        additions.push({
          type: 'chart',
          name: operation.payload.title || 'AI 图表',
          x: asNumber(operation.payload.x, defaultPosition.x),
          y: asNumber(operation.payload.y, defaultPosition.y),
          width: asNumber(operation.payload.width, 420),
          height: asNumber(operation.payload.height, 260),
          style: { fill: '#ffffff', stroke: 'transparent', strokeWidth: 0 },
          chart: {
            chartType: operation.payload.chartType,
            data,
            xField,
            yFields,
            title: operation.payload.title,
            showLegend: operation.payload.showLegend ?? true,
          },
        })
        break
      }

      // 创建表格元素
      case 'create-table': {
        const rows = Math.max(1, operation.payload.cells.length)
        const columns = Math.max(
          1,
          ...operation.payload.cells.map((row) => row.length),
        )
        additions.push({
          type: 'table',
          name: 'AI 表格',
          x: asNumber(operation.payload.x, defaultPosition.x),
          y: asNumber(operation.payload.y, defaultPosition.y),
          width: asNumber(operation.payload.width, Math.max(240, columns * 110)),
          height: asNumber(operation.payload.height, Math.max(120, rows * 38)),
          style: {
            fill: '#ffffff',
            stroke: '#d7deea',
            strokeWidth: 1,
            fontSize: 12,
            fontFamily: 'Arial',
            color: '#273449',
          },
          table: createTableConfig(
            rows,
            columns,
            operation.payload.cells,
            operation.payload.headerRow ?? true,
            operation.payload.columnWidths,
            operation.payload.rowHeights,
          ),
        })
        break
      }

      // 更新元素属性
      case 'update-element': {
        const target = store.getElement(operation.payload.elementId)
        if (!target) throw new Error(`更新失败：元素 ${operation.payload.elementId} 不存在`)
        if (target.isLocked) throw new Error(`更新失败：元素 ${target.name || target.id} 已锁定`)
        updates.push({
          id: target.id,
          updates: sanitizeElementPatch(operation.payload.patch),
        })
        affectedIds.push(target.id)
        break
      }

      // 更新图表数据和配置
      case 'update-chart-data': {
        const target = store.getElement(operation.payload.elementId)
        if (!target?.chart) throw new Error('更新失败：目标不是可编辑图表')
        if (target.isLocked) throw new Error(`更新失败：元素 ${target.name || target.id} 已锁定`)
        const nextData = operation.payload.data
          ? normalizeChartData(operation.payload.data)
          : target.chart.data
        const {
          elementId: _elementId,
          data: _data,
          ...chartUpdates
        } = operation.payload               // 排除 data 和 elementId，剩下的就是 chart 配置的更新
        updates.push({
          id: target.id,
          updates: {
            chart: {
              ...target.chart,
              ...chartUpdates,
              data: nextData,
            },
          },
        })
        affectedIds.push(target.id)
        break
      }

      // 更新表格数据和配置
      case 'update-table-data': {
        const target = store.getElement(operation.payload.elementId)
        if (!target?.table) throw new Error('更新失败：目标不是可编辑表格')
        if (target.isLocked) throw new Error(`更新失败：元素 ${target.name || target.id} 已锁定`)
        const current = normalizeTableConfig(target.table)
        const rows = Math.max(1, operation.payload.cells.length)
        const columns = Math.max(1, ...operation.payload.cells.map((row) => row.length))
        updates.push({
          id: target.id,
          updates: {
            table: createTableConfig(
              rows,
              columns,
              operation.payload.cells,
              operation.payload.headerRow ?? current.headerRow,
              operation.payload.columnWidths ?? current.columnWidths,
              operation.payload.rowHeights ?? current.rowHeights,
            ),
          },
        })
        affectedIds.push(target.id)
        break
      }

      // 删除元素
      case 'delete-elements': {
        operation.payload.elementIds.forEach((id) => {
          const target = store.getElement(id)
          if (!target) return
          if (target.isLocked) throw new Error(`删除失败：元素 ${target.name || target.id} 已锁定`)
          deletions.push(id)
          affectedIds.push(id)
        })
        break
      }

      // 兜底处理，确保 switch 是穷尽的
      default: {
        const exhaustive: never = operation
        throw new Error(`不支持的 Agent 操作：${String(exhaustive)}`)
      }
    }
  })

  const addedIds = store.applyElementBatch('AI 编辑画布', { additions, updates, deletions })
  if (addedIds.length > 0) store.selectMultiple(addedIds)

  return {
    addedIds,
    affectedIds: [...new Set([...affectedIds, ...addedIds])],
  }
}
