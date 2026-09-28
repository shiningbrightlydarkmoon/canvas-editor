import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AgentCanvasContext, AgentMessage, AgentOperation } from '@/core/types'
import { runAgent } from '@/lib/api/agent'
import { generateId } from '@/lib/utils/id'
import { useCanvasStore } from '@/core/store/canvas'
import { applyAgentOperations } from '@/core/agent/operations'

export const useAgentStore = defineStore('agent', () => {
  const messages = ref<AgentMessage[]>([])
  const isRunning = ref(false)
  const error = ref('')
  const pendingMessageId = ref('')

  const pendingOperations = computed<AgentOperation[]>(() => {
    const message = messages.value.find((item) => item.id === pendingMessageId.value)
    return message?.operationStatus === 'pending' ? (message.operations ?? []) : []
  })

  const hasPendingOperations = computed(() => pendingOperations.value.length > 0)

  const sendMessage = async (content: string, context: AgentCanvasContext) => {
    const trimmed = content.trim()
    if (!trimmed || isRunning.value || hasPendingOperations.value) return

    const history = messages.value.slice(-8).map(({ role, content: messageContent }) => ({
      role,
      content: messageContent,
    }))

    messages.value.push({
      id: generateId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    })

    isRunning.value = true
    error.value = ''

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

  const cancelPendingOperations = () => {
    const message = messages.value.find((item) => item.id === pendingMessageId.value)
    if (message) message.operationStatus = 'cancelled'
    pendingMessageId.value = ''
  }

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
