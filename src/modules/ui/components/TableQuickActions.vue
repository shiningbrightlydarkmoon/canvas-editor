<template>
  <div class="table-quick-actions" :style="overlayStyle" @mousedown.stop>
    <button type="button" title="在表格末尾添加一行" @click="emit('add-row')">
      <Plus :size="13" />
      <span>行</span>
    </button>
    <button type="button" title="在表格末尾添加一列" @click="emit('add-column')">
      <Plus :size="13" />
      <span>列</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import type { CanvasElement } from '@/core/types'

const props = defineProps<{
  element: CanvasElement
  zoom: number
  panX: number
  panY: number
}>()

const emit = defineEmits<{
  'add-row': []
  'add-column': []
}>()

const overlayStyle = computed(() => ({
  left: `${(props.element.x + props.element.width) * props.zoom + props.panX + 10}px`,
  top: `${(props.element.y + props.element.height) * props.zoom + props.panY + 10}px`,
}))
</script>

<style scoped>
.table-quick-actions {
  position: absolute;
  z-index: 1500;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px;
  border: 1px solid #dfe5ed;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 8px 22px rgba(29, 44, 69, 0.12);
}

.table-quick-actions button {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  color: #5f6c80;
  background: transparent;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.table-quick-actions button:hover {
  color: #2f6fed;
  background: #edf3ff;
}
</style>
