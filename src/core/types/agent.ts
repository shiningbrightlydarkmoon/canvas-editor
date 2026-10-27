import type { CanvasElement, ChartData, ChartType, ElementStyle } from '@/core/types'

// 消息
/**
 * LLM Chat API 的标准角色定义（用户、agent、系统）
 */
export type AgentMessageRole = 'user' | 'assistant' | 'system'

/**
 * 一条消息的完整信息
 */
export interface AgentMessage {
  id: string                                                                // 唯一标识
  role: AgentMessageRole                                                    // 谁发的
  content: string                                                           // 消息内容
  createdAt: number                                                         // 时间戳
  operations?: AgentOperation[]                                             // 该消息触发的操作列表（可选）
  operationStatus?: 'pending' | 'applied' | 'cancelled' | 'failed'          // 操作状态
}

/**
 * 画布上下文
 * 画布上下文信息，用于在 LLM prompt 中传递
 * 不传完整数据，因为 LLM prompt 有 token 限制，只传 id / 位置 / 类型等关键信息。
 */
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

/**
 * 画布上下文信息，用于在 LLM prompt 中传递
 */
export interface AgentCanvasContext {
  viewport: {
    zoom: number
    x: number
    y: number
  }                                                                  // 画布视口信息，Agent 可以根据视口信息
  selectedIds: string[]                                              // 选中元素 ID
  selectedElements: CanvasElement[]                                  // 选中元素的完整信息
  elementSummaries: AgentCanvasElementSummary[]                      // 画布上所有元素的摘要
}

// 请求响应
/**
 * 发给后端的请求
 */
export interface AgentRunRequest {
  message: string                                                     // 用户输入的指令
  context: AgentCanvasContext                                         // 画布上下文信息
  history: Array<Pick<AgentMessage, 'role' | 'content'>>              // 对话历史
}

/**
 * 后端返回的响应
 */
export interface AgentRunResponse {
  message: string                                                     // 给用户的回复
  operations: AgentOperation[]                                        // 画布操作列表
}

// 操作
/**
 * 画布操作的基础类型
 */
interface AgentOperationBase {
  id: string                                                        // 操作唯一标识
  reason?: string                                                   // 操作原因（可选）
}

/**
 * 创建文本元素
 */
export interface CreateTextOperation extends AgentOperationBase {
  type: 'create-text'
  payload: {
    text: string    // 文本内容（必填）
    x?: number
    y?: number
    width?: number
    height?: number
    style?: Partial<ElementStyle>
  }
}

/**
 * 创建图表元素
 */
export interface CreateChartOperation extends AgentOperationBase {
  type: 'create-chart'
  payload: {
    chartType: ChartType     // 图表类型（必填）
    data: ChartData          // 图表数据（必填）
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

/**
 * 创建表格元素
 */
export interface CreateTableOperation extends AgentOperationBase {
  type: 'create-table'
  payload: {
    cells: string[][]        // 表格数据（必填）
    headerRow?: boolean      // 是否有表头行（可选，默认 false）
    x?: number
    y?: number
    width?: number
    height?: number
    columnWidths?: number[]
    rowHeights?: number[]
  }
}

/**
 * 更新元素属性
 */
export interface UpdateElementOperation extends AgentOperationBase {
  type: 'update-element'
  payload: {
    elementId: string    // 元素 ID
    patch: Partial<CanvasElement>    // 元素属性的部分更新，支持修改位置、大小、样式等属性
  }
}

/**
 * 更新图表数据和配置
 */
export interface UpdateChartDataOperation extends AgentOperationBase {
  type: 'update-chart-data'
  payload: {
    elementId: string    // 元素 ID（必填）
    data?: ChartData
    chartType?: ChartType
    xField?: string
    yFields?: string[]
    title?: string
    showLegend?: boolean
  }
}

/**
 * 更新表格数据和配置
 */
export interface UpdateTableDataOperation extends AgentOperationBase {
  type: 'update-table-data'
  payload: {
    elementId: string     // 元素 ID（必填）
    cells: string[][]     // 表格数据（必填）
    headerRow?: boolean
    columnWidths?: number[]
    rowHeights?: number[]
  }
}

/**
 * 删除多个元素
 */
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
