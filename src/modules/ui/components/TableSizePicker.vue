<template>
  <div ref="rootRef" class="table-size-picker" @mousedown.stop>
    <div class="picker-heading">
      <strong>插入表格</strong>
      <span>{{ hoverRow }} × {{ hoverColumns }}</span>
    </div>

    <div class="picker-grid" @mouseleave="setPreview(3, 3)">
      <button
        v-for="cell in gridCells"
        :key="`${cell.row}-${cell.column}`"
        class="grid-cell"
        :class="{ active: cell.row <= hoverRow && cell.column <= hoverColumns }"
        type="button"
        :title="`${cell.row} 行 ${cell.column} 列`"
        @mouseenter="setPreview(cell.row, cell.column)"
        @click="chooseSize(cell.row, cell.column)"
      />
    </div>

    <div class="picker-footer">
      <span>最多 10 × 10</span>
      <span>创建后可继续加行加列</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { MAX_TABLE_PICKER_SIZE } from '@/core/tables'

const emit = defineEmits<{
  select: [rows: number, columns: number]
  close: []
}>()

const rootRef = ref<HTMLElement>()
const hoverRow = ref(3)
const hoverColumns = ref(3)

const gridCells = Array.from(
  { length: MAX_TABLE_PICKER_SIZE * MAX_TABLE_PICKER_SIZE },
  (_, index) => ({
    row: Math.floor(index / MAX_TABLE_PICKER_SIZE) + 1,
    column: (index % MAX_TABLE_PICKER_SIZE) + 1,
  }),
)

const setPreview = (rows: number, columns: number) => {
  hoverRow.value = rows
  hoverColumns.value = columns
}

const chooseSize = (rows: number, columns: number) => {
  emit('select', rows, columns)
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target as HTMLElement | null
  if (rootRef.value?.contains(target)) return
  if (target?.closest('[data-table-picker-trigger]')) return
  emit('close')
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.table-size-picker {
  position: absolute;
  top: -6px;
  left: calc(100% + 10px);
  z-index: 80;
  width: 238px;
  padding: 12px;
  border: 1px solid #dfe5ed;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow:
    0 18px 38px rgba(29, 44, 69, 0.15),
    0 3px 10px rgba(29, 44, 69, 0.06);
  backdrop-filter: blur(12px);
}

.picker-heading,
.picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.picker-heading {
  margin-bottom: 10px;
  color: #253044;
  font-size: 12px;
}

.picker-heading span {
  color: #2f6fed;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
  padding: 6px;
  border: 1px solid #e6ebf1;
  border-radius: 9px;
  background: #f8fafc;
}

.grid-cell {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid #d8dfe8;
  border-radius: 3px;
  background: #ffffff;
  cursor: pointer;
}

.grid-cell.active {
  border-color: #6e9af7;
  background: #dfeaff;
}

.picker-footer {
  margin-top: 9px;
  color: #929cac;
  font-size: 10px;
}
</style>
