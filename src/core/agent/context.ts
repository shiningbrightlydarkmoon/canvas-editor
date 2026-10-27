import type {
  AgentCanvasContext,
  AgentCanvasElementSummary,
  CanvasElement,
  ViewportState,
} from '@/core/types'

// 将 CanvasElement 转换为 AgentCanvasElementSummary
const summarizeElement = (element: CanvasElement): AgentCanvasElementSummary => ({
  id: element.id,
  type: element.type,
  name: element.name,
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
  rotation: element.rotation,
  isLocked: element.isLocked,
  chartType: element.chart?.chartType,
  tableRows: element.table?.rows,
  tableColumns: element.table?.columns,
})

// 把画布当前状态打包成Agent能够理解的上下文对象，发给后端/LLM
export const createAgentCanvasContext = (
  elements: CanvasElement[],
  selectedIds: string[],
  viewport: ViewportState,
): AgentCanvasContext => {
  const selectedSet = new Set(selectedIds)

  return {
    viewport: { ...viewport },
    selectedIds: [...selectedIds],
    selectedElements: elements.filter((element) => selectedSet.has(element.id)),
    elementSummaries: elements.map(summarizeElement),
  }
}
