import type { AgentOperation, AgentRunRequest, AgentRunResponse } from '@/core/types'

// 合法类型操作白名单
const OPERATION_TYPES = new Set<AgentOperation['type']>([
  'create-text',
  'create-chart',
  'create-table',
  'update-element',
  'update-chart-data',
  'update-table-data',
  'delete-elements',
])

// 类型守卫，判断一个值是否为 Record<string, unknown> 类型
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// 逐个校验 LLM 返回的操作，确保其符合 AgentOperation 类型定义，并为缺失的 id 字段生成默认值
const normalizeOperation = (value: unknown, index: number): AgentOperation => {
  // 必须是对象
  if (!isRecord(value)) throw new Error('Agent 返回了无效操作')
  // type 必须是合法类型
  if (typeof value.type !== 'string' || !OPERATION_TYPES.has(value.type as AgentOperation['type'])) {
    throw new Error(`Agent 返回了不支持的操作：${String(value.type ?? 'unknown')}`)
  }
  // payload 必须是对象
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

// 运行 Agent，发送请求到后端，并返回处理结果
export const runAgent = async (request: AgentRunRequest): Promise<AgentRunResponse> => {
  // 相对路径，开发时靠 Vite 的代理转发到 127.0.0.1:8787
  const response = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  // 手动检查响应状态码，如果不是 2xx，尝试解析错误信息并抛出异常
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || `Agent 请求失败：${response.status}`)
  }

  const payload = (await response.json()) as unknown
  if (!isRecord(payload)) throw new Error('Agent 返回格式不正确')

  // 校验返回的字段
  const message = typeof payload.message === 'string' ? payload.message : '已完成分析。'
  const operations = Array.isArray(payload.operations)
    ? payload.operations.map(normalizeOperation)
    : []

  return { message, operations }
}
