import type { CanvasElement, ChartData, ChartType, ElementStyle } from '@/core/types'

export type AgentMessageRole = 'user' | 'assistant' | 'system'

export interface AgentMessage {
  id: string
  role: AgentMessageRole
  content: string
  createdAt: number
  operations?: AgentOperation[]
  operationStatus?: 'pending' | 'applied' | 'cancelled' | 'failed'
}

export interface AgentCanvasElementSummary {
  id: string
  type: CanvasElement['type']
  name?: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  isLocked?: boolean
  chartType?: ChartType
  tableRows?: number
  tableColumns?: number
}

export interface AgentCanvasContext {
  viewport: {
    zoom: number
    x: number
    y: number
  }
  selectedIds: string[]
  selectedElements: CanvasElement[]
  elementSummaries: AgentCanvasElementSummary[]
}

export interface AgentRunRequest {
  message: string
  context: AgentCanvasContext
  history: Array<Pick<AgentMessage, 'role' | 'content'>>
}

export interface AgentRunResponse {
  message: string
  operations: AgentOperation[]
}

interface AgentOperationBase {
  id: string
  reason?: string
}

export interface CreateTextOperation extends AgentOperationBase {
  type: 'create-text'
  payload: {
    text: string
    x?: number
    y?: number
    width?: number
    height?: number
    style?: Partial<ElementStyle>
  }
}

export interface CreateChartOperation extends AgentOperationBase {
  type: 'create-chart'
  payload: {
    chartType: ChartType
    data: ChartData
    xField?: string
    yFields?: string[]
    title?: string
    showLegend?: boolean
    x?: number
    y?: number
    width?: number
    height?: number
  }
}

export interface CreateTableOperation extends AgentOperationBase {
  type: 'create-table'
  payload: {
    cells: string[][]
    headerRow?: boolean
    x?: number
    y?: number
    width?: number
    height?: number
    columnWidths?: number[]
    rowHeights?: number[]
  }
}

export interface UpdateElementOperation extends AgentOperationBase {
  type: 'update-element'
  payload: {
    elementId: string
    patch: Partial<CanvasElement>
  }
}

export interface UpdateChartDataOperation extends AgentOperationBase {
  type: 'update-chart-data'
  payload: {
    elementId: string
    data?: ChartData
    chartType?: ChartType
    xField?: string
    yFields?: string[]
    title?: string
    showLegend?: boolean
  }
}

export interface UpdateTableDataOperation extends AgentOperationBase {
  type: 'update-table-data'
  payload: {
    elementId: string
    cells: string[][]
    headerRow?: boolean
    columnWidths?: number[]
    rowHeights?: number[]
  }
}

export interface DeleteElementsOperation extends AgentOperationBase {
  type: 'delete-elements'
  payload: {
    elementIds: string[]
  }
}

export type AgentOperation =
  | CreateTextOperation
  | CreateChartOperation
  | CreateTableOperation
  | UpdateElementOperation
  | UpdateChartDataOperation
  | UpdateTableDataOperation
  | DeleteElementsOperation
