import type { AgentOperation, AgentRunRequest, AgentRunResponse } from '@/core/types'

const OPERATION_TYPES = new Set<AgentOperation['type']>([
  'create-text',
  'create-chart',
  'create-table',
  'update-element',
  'update-chart-data',
  'update-table-data',
  'delete-elements',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeOperation = (value: unknown, index: number): AgentOperation => {
  if (!isRecord(value)) throw new Error('Agent 返回了无效操作')
  if (typeof value.type !== 'string' || !OPERATION_TYPES.has(value.type as AgentOperation['type'])) {
    throw new Error(`Agent 返回了不支持的操作：${String(value.type ?? 'unknown')}`)
  }
  if (!isRecord(value.payload)) {
    throw new Error(`Agent 操作 ${value.type} 缺少 payload`)
  }
  const type = value.type as AgentOperation['type']

  return {
    ...value,
    id: typeof value.id === 'string' && value.id ? value.id : `operation-${index + 1}`,
    type,
    payload: value.payload,
  } as AgentOperation
}

export const runAgent = async (request: AgentRunRequest): Promise<AgentRunResponse> => {
  const response = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || `Agent 请求失败：${response.status}`)
  }

  const payload = (await response.json()) as unknown
  if (!isRecord(payload)) throw new Error('Agent 返回格式不正确')

  const message = typeof payload.message === 'string' ? payload.message : '已完成分析。'
  const operations = Array.isArray(payload.operations)
    ? payload.operations.map(normalizeOperation)
    : []

  return { message, operations }
}
