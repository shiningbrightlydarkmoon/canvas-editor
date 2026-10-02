import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

interface AgentOperation {
  id: string
  type: string
  payload: Record<string, unknown>
  reason?: string
}

interface AgentRunBody {
  message?: string
  context?: unknown
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

const PORT = Number(process.env.AGENT_PORT || 8787)
const API_KEY = process.env.AGENT_API_KEY || process.env.OPENAI_API_KEY || ''
const BASE_URL = (process.env.AGENT_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const MODEL = process.env.AGENT_MODEL || process.env.OPENAI_MODEL || ''
const MOCK_MODE = process.env.AGENT_MOCK === '1'

const ALLOWED_OPERATION_TYPES = [
  'create-text',
  'create-chart',
  'create-table',
  'update-element',
  'update-chart-data',
  'update-table-data',
  'delete-elements',
]

const CHART_TYPES = [
  'line',
  'area',
  'stacked-area',
  'bar',
  'horizontal-bar',
  'stacked-bar',
  'pie',
  'doughnut',
  'rose',
  'scatter',
  'bubble',
  'funnel',
]

const SYSTEM_PROMPT = `你是 Canvas Editor 的画布编辑 Agent。

你的任务是根据用户指令和当前画布上下文，返回结构化画布操作。

必须只返回一个 JSON 对象，格式如下：
{
  "message": "给用户看的简短说明",
  "operations": [
    {
      "id": "operation-1",
      "type": "create-chart",
      "payload": {},
      "reason": "为什么执行这个操作"
    }
  ]
}

允许的 operation.type：
${ALLOWED_OPERATION_TYPES.join(', ')}

允许的 chartType：
${CHART_TYPES.join(', ')}

操作协议：
1. create-text:
   payload: { text, x?, y?, width?, height?, style? }
2. create-chart:
   payload: {
     chartType,
     data: {
       columns: [{ key, label, type: "string" | "number" }],
       rows: [object]
     },
     xField?,
     yFields?,
     title?,
     showLegend?,
     x?,
     y?,
     width?,
     height?
   }
3. create-table:
   payload: { cells: string[][], headerRow?, x?, y?, width?, height? }
4. update-element:
   payload: { elementId, patch }
   patch 只能包含 name, x, y, width, height, rotation, opacity, style, content 等元素属性。
5. update-chart-data:
   payload: { elementId, data?, chartType?, xField?, yFields?, title?, showLegend? }
6. update-table-data:
   payload: { elementId, cells, headerRow? }
7. delete-elements:
   payload: { elementIds: string[] }

规则：
- 不要输出 Markdown 代码块，不要输出 JSON 以外的解释。
- 信息不足时，可以返回空 operations，并在 message 中提出一个明确问题。
- 修改现有元素时优先使用目标元素的真实 id。
- 创建图表时必须提供完整、可解析的数据，至少包含一个分类字段和一个数值字段。
- 删除多个元素时使用一次 delete-elements，不要拆成多次操作。
- 不要生成代码、HTML、脚本或网络请求。
- 默认使用中文说明。
- 坐标和尺寸应避免与其他元素大面积重叠。`

const sendJson = (response: ServerResponse, status: number, payload: unknown) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  })
  response.end(JSON.stringify(payload))
}

const readJsonBody = async (request: IncomingMessage): Promise<AgentRunBody> => {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 2 * 1024 * 1024) throw new Error('请求体过大')
    chunks.push(buffer)
  }

  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as AgentRunBody
}

const parseModelJson = (content: string): { message: string; operations: AgentOperation[] } => {
  const trimmed = content.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed
  const start = withoutFence.indexOf('{')
  const end = withoutFence.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('模型没有返回 JSON 对象')

  const parsed = JSON.parse(withoutFence.slice(start, end + 1)) as {
    message?: unknown
    operations?: unknown
  }
  const operations = Array.isArray(parsed.operations) ? parsed.operations : []

  const normalizedOperations = operations.map((operation, index) => {
    if (!operation || typeof operation !== 'object') throw new Error('模型返回了无效操作')
    const record = operation as Record<string, unknown>
    if (typeof record.type !== 'string' || !ALLOWED_OPERATION_TYPES.includes(record.type)) {
      throw new Error(`模型返回了不支持的操作：${String(record.type)}`)
    }
    if (!record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) {
      throw new Error(`操作 ${record.type} 缺少 payload`)
    }
    return {
      id: typeof record.id === 'string' && record.id ? record.id : `operation-${index + 1}`,
      type: record.type,
      payload: record.payload as Record<string, unknown>,
      reason: typeof record.reason === 'string' ? record.reason : undefined,
    }
  })

  return {
    message: typeof parsed.message === 'string' ? parsed.message : '已完成分析。',
    operations: normalizedOperations,
  }
}

const createMockResponse = (message: string) => {
  if (message.includes('季度') || message.includes('柱状图')) {
    return {
      message: '我会创建一个季度销售数据柱状图。',
      operations: [
        {
          id: 'mock-create-chart',
          type: 'create-chart',
          reason: '根据用户的季度销售图表要求创建。',
          payload: {
            chartType: 'bar',
            title: '季度销售额',
            xField: 'quarter',
            yFields: ['sales'],
            data: {
              columns: [
                { key: 'quarter', label: '季度', type: 'string' },
                { key: 'sales', label: '销售额', type: 'number' },
              ],
              rows: [
                { quarter: '第一季度', sales: 128 },
                { quarter: '第二季度', sales: 186 },
                { quarter: '第三季度', sales: 154 },
                { quarter: '第四季度', sales: 238 },
              ],
            },
          },
        },
      ],
    }
  }

  return {
    message: '目前只有 Mock Agent 可用，请配置模型环境变量。',
    operations: [],
  }
}

const handleAgentRun = async (request: IncomingMessage, response: ServerResponse) => {
  const body = await readJsonBody(request)
  const message = body.message?.trim()
  if (!message) {
    sendJson(response, 400, { error: 'message 不能为空' })
    return
  }

  if (MOCK_MODE) {
    sendJson(response, 200, createMockResponse(message))
    return
  }

  if (!API_KEY || !MODEL) {
    sendJson(response, 500, {
      error: 'Agent 服务未配置，请设置 AGENT_API_KEY 与 AGENT_MODEL',
    })
    return
  }

  const history = (body.history ?? []).slice(-8).map((item) => ({
    role: item.role,
    content: item.content,
  }))

  const upstream = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        {
          role: 'user',
          content: JSON.stringify({
            instruction: message,
            canvasContext: body.context ?? {},
          }),
        },
      ],
    }),
  })

  const result = (await upstream.json().catch(() => null)) as
    | {
        choices?: Array<{ message?: { content?: string } }>
        error?: { message?: string }
      }
    | null

  if (!upstream.ok) {
    sendJson(response, upstream.status, {
      error: result?.error?.message || `模型请求失败：${upstream.status}`,
    })
    return
  }

  const content = result?.choices?.[0]?.message?.content
  if (!content) {
    sendJson(response, 502, { error: '模型没有返回内容' })
    return
  }

  sendJson(response, 200, parseModelJson(content))
}

const server = createServer(async (request, response) => {
  if (!request.url) return
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      mock: MOCK_MODE,
      modelConfigured: Boolean(API_KEY && MODEL),
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/agent/run') {
    try {
      await handleAgentRun(request, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent 服务异常'
      sendJson(response, 500, { error: message })
    }
    return
  }

  sendJson(response, 404, { error: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[agent] listening on http://127.0.0.1:${PORT}${MOCK_MODE ? ' (mock)' : ''}`)
})
