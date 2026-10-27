import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

// 定义 Agent 操作接口
interface AgentOperation {
  id: string                                        // 操作标识
  type: string                                      // 操作类型
  payload: Record<string, unknown>                  // 各操作自己的参数，未校验前是未知结构
  reason?: string                                   // 模型自述操作原因
}

// 前端 POST 的请求体
interface AgentRunBody {
  message?: string                                                          // 用户自然语言
  context?: unknown                                                         // 当前画布上下文
  history?: Array<{ role: 'user' | 'assistant'; content: string }>          // 历史对话
}

// 服务器配置
// 端口
const PORT = Number(process.env.AGENT_PORT || 8787)
// API Key
const API_KEY = process.env.AGENT_API_KEY || process.env.OPENAI_API_KEY || ''
// 模型请求地址
const BASE_URL = (process.env.AGENT_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
// 模型名称
const MODEL = process.env.AGENT_MODEL || process.env.OPENAI_MODEL || ''
// 是否启用 Mock 模式
const MOCK_MODE = process.env.AGENT_MOCK === '1'

// 协议层白名单
const ALLOWED_OPERATION_TYPES = [
  'create-text',
  'create-chart',
  'create-table',
  'update-element',
  'update-chart-data',
  'update-table-data',
  'delete-elements',
]

// 图表类型白名单
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

// 系统提示词，Prompt
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

// 统一的响应出口，同时解决跨域问题
const sendJson = (response: ServerResponse, status: number, payload: unknown) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  })
  response.end(JSON.stringify(payload))
}

// 读取请求体并解析为 JSON
const readJsonBody = async (request: IncomingMessage): Promise<AgentRunBody> => {
  const chunks: Buffer[] = []                      // 装每一块数据的数组
  let size = 0                                     // 累计请求体大小

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 2 * 1024 * 1024) throw new Error('请求体过大')
    chunks.push(buffer)
  }

  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as AgentRunBody
}

// 解析模型返回的 JSON 内容，提取 message 和 operations，把返回的“脏字符串”转换为标准的 JSON 格式
const parseModelJson = (content: string): { message: string; operations: AgentOperation[] } => {
  // 去掉首尾空白
  const trimmed = content.trim()
  // 去掉 Markdown 代码块标记
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

  // 规范化操作列表，确保每个操作都有 id、type、payload，并且 type 在白名单中
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

// Mock 模式下的响应生成器，用于测试和开发
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

// 接收前端请求，组装 Prompt，调用大模型，解析并返回结构化操作
const handleAgentRun = async (request: IncomingMessage, response: ServerResponse) => {
  // 读取请求体，校验 message
  const body = await readJsonBody(request)
  const message = body.message?.trim()
  if (!message) {
    sendJson(response, 400, { error: 'message 不能为空' })
    return
  }

  // Mock 拦截
  if (MOCK_MODE) {
    sendJson(response, 200, createMockResponse(message))
    return
  }

  // 检查 API 配置
  if (!API_KEY || !MODEL) {
    sendJson(response, 500, {
      error: 'Agent 服务未配置，请设置 AGENT_API_KEY 与 AGENT_MODEL',
    })
    return
  }

  // 组装历史对话，最多保留最近 8 条
  const history = (body.history ?? []).slice(-8).map((item) => ({
    role: item.role,
    content: item.content,
  }))

  // 调用大模型
  const upstream = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,            // LLM API 鉴权标准
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,                              // 温度参数，0：完全确定，1：高随机，2：非常随机
      response_format: { type: 'json_object' },      // 强制 JSON
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

  // 检查上游响应
  const result = (await upstream.json().catch(() => null)) as
    | {
        choices?: Array<{ message?: { content?: string } }>
        error?: { message?: string }
      }
    | null

  // 请求失败，返回错误信息
  if (!upstream.ok) {
    sendJson(response, upstream.status, {
      error: result?.error?.message || `模型请求失败：${upstream.status}`,
    })
    return
  }

  // 提取模型返回的内容
  const content = result?.choices?.[0]?.message?.content
  if (!content) {
    sendJson(response, 502, { error: '模型没有返回内容' })
    return
  }

  sendJson(response, 200, parseModelJson(content))
}

// 创建 HTTP 服务器，处理请求
const server = createServer(async (request, response) => {
  if (!request.url) return
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)

  // CORS 预检请求，直接返回 204
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  // 健康检查接口
  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,                                         // 服务是否正常
      mock: MOCK_MODE,                                  // 是否启用 Mock 模式
      modelConfigured: Boolean(API_KEY && MODEL),       // 模型是否配置
    })
    return
  }

  // 业务接口：运行 Agent，返回结构化操作
  if (request.method === 'POST' && url.pathname === '/api/agent/run') {
    try {
      await handleAgentRun(request, response)
    } catch (error) {
      // 处理异常情况
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
