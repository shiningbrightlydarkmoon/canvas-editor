<template>
  <div class="agent-panel">
    <div class="agent-header">
      <div>
        <strong>Agent</strong>
        <span>{{ statusText }}</span>
      </div>
      <button class="clear-button" type="button" title="清空对话" @click="clearConversation">
        <Trash2 :size="14" />
      </button>
    </div>

    <div ref="messageListRef" class="message-list">
      <div v-if="messages.length === 0" class="agent-empty">
        <div class="agent-empty-icon">
          <Bot :size="20" />
        </div>
        <strong>让 Agent 帮你编辑画布</strong>
        <span>可以创建图表、修改选中元素或生成表格数据。</span>
        <div class="prompt-list">
          <button type="button" @click="usePrompt('创建一个季度销售额柱状图')">
            创建季度销售额柱状图
          </button>
          <button type="button" @click="usePrompt('把当前图表改成折线图并保留数据')">
            当前图表改为折线图
          </button>
          <button type="button" @click="usePrompt('创建一个 4 行 3 列的销售数据表格')">
            创建销售数据表格
          </button>
        </div>
      </div>

      <article
        v-for="message in messages"
        :key="message.id"
        class="message"
        :class="`is-${message.role}`"
      >
        <div class="message-role">{{ message.role === 'user' ? '你' : 'Agent' }}</div>
        <div class="message-content">{{ message.content }}</div>

        <div
          v-if="message.operations?.length"
          class="operation-preview"
          :class="`status-${message.operationStatus}`"
        >
          <div class="operation-summary">
            <Sparkles :size="13" />
            <span>{{ message.operations.length }} 项画布修改</span>
          </div>
          <div
            v-for="operation in message.operations"
            :key="operation.id"
            class="operation-item"
          >
            <strong>{{ operationLabel(operation) }}</strong>
            <span v-if="operation.reason">{{ operation.reason }}</span>
          </div>

          <div v-if="message.operationStatus === 'pending'" class="operation-actions">
            <button class="cancel-action" type="button" @click="cancelPendingOperations">
              <X :size="13" />
              <span>取消</span>
            </button>
            <button class="apply-action" type="button" @click="applyPendingOperations">
              <Check :size="13" />
              <span>应用修改</span>
            </button>
          </div>
          <div v-else class="operation-result">
            {{ operationStatusLabel(message.operationStatus) }}
          </div>
        </div>
      </article>

      <div v-if="isRunning" class="agent-loading">
        <LoaderCircle :size="15" class="spin" />
        <span>Agent 正在处理画布上下文</span>
      </div>
    </div>

    <div v-if="error" class="agent-error">{{ error }}</div>

    <div class="agent-composer">
      <textarea
        v-model="prompt"
        rows="3"
        placeholder="描述你想创建或修改的内容"
        @keydown="handleKeydown"
      />
      <div class="composer-footer">
        <span>{{ contextLabel }}</span>
        <button
          class="send-button"
          type="button"
          :disabled="!prompt.trim() || isRunning || hasPendingOperations"
          :title="hasPendingOperations ? '请先应用或取消当前修改' : '发送'"
          @click="send"
        >
          <Send :size="15" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Bot, Check, LoaderCircle, Send, Sparkles, Trash2, X } from 'lucide-vue-next'
import { useAgentStore } from '@/core/store/agent'
import { useCanvasStore } from '@/core/store/canvas'
import { createAgentCanvasContext } from '@/core/agent/context'
import type { AgentMessage, AgentOperation } from '@/core/types'

const agentStore = useAgentStore()
const canvasStore = useCanvasStore()
const { messages, isRunning, error, hasPendingOperations } = storeToRefs(agentStore)
const {
  sendMessage,
  applyPendingOperations,
  cancelPendingOperations,
  clearConversation,
} = agentStore
const { elementsArray, selectedIds, viewport } = storeToRefs(canvasStore)

const prompt = ref('')
const messageListRef = ref<HTMLElement>()

const statusText = computed(() => {
  if (isRunning.value) return '处理中'
  if (hasPendingOperations.value) return '等待确认'
  return '画布助手'
})

const contextLabel = computed(() =>
  selectedIds.value.length > 0
    ? `已引用 ${selectedIds.value.length} 个选中元素`
    : `已读取 ${elementsArray.value.length} 个画布元素`,
)

const operationLabels: Record<AgentOperation['type'], string> = {
  'create-text': '创建文本',
  'create-chart': '创建图表',
  'create-table': '创建表格',
  'update-element': '更新元素',
  'update-chart-data': '更新图表数据',
  'update-table-data': '更新表格数据',
  'delete-elements': '删除元素',
}

const operationLabel = (operation: AgentOperation) => operationLabels[operation.type]
const operationStatusLabel = (status?: AgentMessage['operationStatus']) => {
  if (status === 'applied') return '修改已应用，可一次性撤销。'
  if (status === 'cancelled') return '已取消本次修改。'
  if (status === 'failed') return '修改执行失败。'
  return ''
}

const scrollToBottom = async () => {
  await nextTick()
  const list = messageListRef.value
  if (list) list.scrollTop = list.scrollHeight
}

watch(messages, scrollToBottom, { deep: true })

const send = async () => {
  const content = prompt.value.trim()
  if (!content || isRunning.value || hasPendingOperations.value) return

  const context = createAgentCanvasContext(
    elementsArray.value,
    selectedIds.value,
    viewport.value,
  )
  prompt.value = ''
  await sendMessage(content, context)
}

const usePrompt = (value: string) => {
  prompt.value = value
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  void send()
}
</script>

<style scoped>
.agent-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

.agent-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid #e7ebf1;
  flex-shrink: 0;
}

.agent-header > div {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.agent-header strong {
  color: #253044;
  font-size: 13px;
}

.agent-header span,
.composer-footer span {
  color: #8994a6;
  font-size: 10px;
}

.clear-button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 7px;
  color: #7f8a9c;
  background: #f6f8fb;
  cursor: pointer;
}

.clear-button:hover {
  color: #dc3545;
  background: #fff1f2;
}

.message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 14px 8px;
  background: #f8fafc;
}

.agent-empty {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 6px;
  color: #7c8799;
  text-align: center;
}

.agent-empty-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  margin-bottom: 10px;
  border-radius: 12px;
  color: #2f6fed;
  background: #edf3ff;
}

.agent-empty strong {
  color: #344054;
  font-size: 13px;
}

.agent-empty > span {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.6;
}

.prompt-list {
  width: 100%;
  display: grid;
  gap: 6px;
  margin-top: 16px;
}

.prompt-list button {
  min-height: 34px;
  padding: 7px 9px;
  border: 1px solid #e2e8f1;
  border-radius: 8px;
  color: #526177;
  background: #ffffff;
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.prompt-list button:hover {
  color: #2f6fed;
  border-color: #c9d8fa;
  background: #f8faff;
}

.message {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
}

.message-role {
  color: #8d98a9;
  font-size: 10px;
  font-weight: 600;
}

.message-content {
  padding: 9px 10px;
  border: 1px solid #e6ebf2;
  border-radius: 9px;
  color: #344054;
  background: #ffffff;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.message.is-user .message-content {
  color: #ffffff;
  border-color: #2f6fed;
  background: #2f6fed;
}

.operation-preview {
  display: grid;
  gap: 6px;
  padding: 9px;
  border: 1px solid #d9e5fc;
  border-radius: 9px;
  background: #f7faff;
}

.operation-preview.status-applied {
  border-color: #bde8d2;
  background: #f3fbf7;
}

.operation-preview.status-cancelled,
.operation-preview.status-failed {
  border-color: #eadfe0;
  background: #fbf7f7;
}

.operation-summary {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #2f6fed;
  font-size: 11px;
  font-weight: 600;
}

.operation-item {
  display: grid;
  gap: 2px;
  padding: 6px 7px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.78);
}

.operation-item strong {
  color: #40506a;
  font-size: 11px;
}

.operation-item span,
.operation-result {
  color: #7e899b;
  font-size: 10px;
  line-height: 1.45;
}

.operation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 2px;
}

.operation-actions button {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-radius: 7px;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.cancel-action {
  border: 1px solid #dce2ea;
  color: #667386;
  background: #ffffff;
}

.apply-action {
  border: 1px solid #2f6fed;
  color: #ffffff;
  background: #2f6fed;
}

.agent-loading {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 2px;
  color: #68778d;
  font-size: 11px;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.agent-error {
  margin: 0 14px 8px;
  padding: 8px 9px;
  border: 1px solid #f0c9cd;
  border-radius: 8px;
  color: #c03645;
  background: #fff5f6;
  font-size: 11px;
  line-height: 1.45;
}

.agent-composer {
  padding: 10px 12px 12px;
  border-top: 1px solid #e7ebf1;
  background: #ffffff;
  flex-shrink: 0;
}

.agent-composer textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 72px;
  max-height: 140px;
  resize: vertical;
  padding: 9px 10px;
  border: 1px solid #dde3ec;
  border-radius: 9px;
  outline: 0;
  color: #273449;
  background: #f8fafc;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
}

.agent-composer textarea:focus {
  border-color: #a9c4fa;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.08);
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
}

.send-button {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: #ffffff;
  background: #2f6fed;
  cursor: pointer;
}

.send-button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
</style>
