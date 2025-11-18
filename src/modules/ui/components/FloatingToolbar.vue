<template>
  <div
    class="floating-toolbar"
    :style="{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
    }"
  >
    <div class="toolbar-content">
      <span class="selection-info">选中 {{ elements.length }} 个元素</span>
      <div class="toolbar-actions">
        <button class="action-btn" @click="handleDelete" title="删除">
          <Trash2 class="icon" />
        </button>
        <button class="action-btn" @click="handleDuplicate" title="复制">
          <Copy class="icon" />
        </button>
        <button class="action-btn" @click="handleBringToFront" title="置顶">
          <Layers class="icon" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Trash2, Copy, Layers } from 'lucide-vue-next'
import type { CanvasElement } from '@/core/types/canvas'

const { elements } = defineProps<{
  elements: CanvasElement[]
}>()

const emit = defineEmits<{
  delete: []
}>()

const handleDelete = () => {
  emit('delete')
}

const handleDuplicate = () => {
  console.log('复制元素')
}

const handleBringToFront = () => {
  console.log('置顶元素')
}
</script>

<style scoped>
.floating-toolbar {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 8px 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  z-index: 1000;
}

.toolbar-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selection-info {
  color: #495057;
  font-weight: 500;
}

.toolbar-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  color: #495057;
}

.action-btn:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.action-btn .icon {
  width: 14px;
  height: 14px;
}
</style>
