import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AgentCanvasContext, AgentMessage, AgentOperation } from '@/core/types'
import { runAgent } from '@/lib/api/agent'
import { generateId } from '@/lib/utils/id'
import { useCanvasStore } from '@/core/store/canvas'
import { applyAgentOperations } from '@/core/agent/operations'

// Agent 的状态管理
export const useAgentStore = defineStore('agent', () => {
  const messages = ref<AgentMessage[]>([])               // 消息列表
  const isRunning = ref(false)                           // 是否正在请求
  const error = ref('')                                  // 错误信息
  const pendingMessageId = ref('')                       // 当前待处理操作的消息 ID

  // 取待处理操作的 operations
  const pendingOperations = computed<AgentOperation[]>(() => {
    const message = messages.value.find((item) => item.id === pendingMessageId.value)
    return message?.operationStatus === 'pending' ? (message.operations ?? []) : []
  })

  const hasPendingOperations = computed(() => pendingOperations.value.length > 0)

  // 发送消息给 Agent，处理用户输入的指令
  const sendMessage = async (content: string, context: AgentCanvasContext) => {
    // 前置检查
    const trimmed = content.trim()
    if (!trimmed || isRunning.value || hasPendingOperations.value) return

    // 生成历史消息，取最近 8 条
    const history = messages.value.slice(-8).map(({ role, content: messageContent }) => ({
      role,
      content: messageContent,
    }))

    // 添加用户信息
    messages.value.push({
      id: generateId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    })

    // 设状态
    isRunning.value = true
    error.value = ''

    // 发送请求给后端
    try {
      const response = await runAgent({ message: trimmed, context, history })
      const assistantMessage: AgentMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.message,
        createdAt: Date.now(),
        operations: response.operations,
        operationStatus: response.operations.length > 0 ? 'pending' : undefined,
      }
      messages.value.push(assistantMessage)
      pendingMessageId.value = assistantMessage.operationStatus === 'pending' ? assistantMessage.id : ''
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : 'Agent 请求失败'
      error.value = message
      messages.value.push({
        id: generateId(),
        role: 'assistant',
        content: message,
        createdAt: Date.now(),
      })
    } finally {
      isRunning.value = false
    }
  }

  // “应用修改”操作
  const applyPendingOperations = () => {
    const message = messages.value.find((item) => item.id === pendingMessageId.value)
    if (!message?.operations?.length) return

    try {
      applyAgentOperations(useCanvasStore(), message.operations)
      message.operationStatus = 'applied'
      pendingMessageId.value = ''
      error.value = ''
    } catch (applyError) {
      message.operationStatus = 'failed'
      error.value = applyError instanceof Error ? applyError.message : '操作执行失败'
    }
  }

  // “取消修改”操作
  const cancelPendingOperations = () => {
    const message = messages.value.find((item) => item.id === pendingMessageId.value)
    if (message) message.operationStatus = 'cancelled'
    pendingMessageId.value = ''
  }

  // 清空对话
  const clearConversation = () => {
    messages.value = []
    pendingMessageId.value = ''
    error.value = ''
  }

  return {
    messages,
    isRunning,
    error,
    pendingOperations,
    hasPendingOperations,
    sendMessage,
    applyPendingOperations,
    cancelPendingOperations,
    clearConversation,
  }
})
