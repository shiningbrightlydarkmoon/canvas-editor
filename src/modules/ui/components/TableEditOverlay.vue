<template>
  <div
    ref="overlayRef"
    class="table-edit-overlay"
    :style="overlayStyle"
    @mousedown.stop
    @pointerdown.stop
  >
    <div class="table-edit-tools">
      <button type="button" title="添加一行" @click="addRow">
        <Plus :size="13" />
        <span>行</span>
      </button>
      <button type="button" title="添加一列" @click="addColumn">
        <Plus :size="13" />
        <span>列</span>
      </button>
      <label class="header-toggle">
        <input v-model="draft.headerRow" type="checkbox" @change="emitPreview" />
        <span>首行为表头</span>
      </label>
    </div>

    <div class="table-edit-grid">
      <table>
        <colgroup>
          <col
            v-for="(width, columnIndex) in columnPercents"
            :key="columnIndex"
            :style="{ width: `${width}%` }"
          />
        </colgroup>
        <tbody>
          <tr
            v-for="(row, rowIndex) in draft.cells"
            :key="rowIndex"
            :style="{ height: `${rowPercents[rowIndex] ?? 0}%` }"
          >
            <td
              v-for="(_, columnIndex) in row"
              :key="columnIndex"
              :class="{ 'is-header': draft.headerRow && rowIndex === 0 }"
            >
              <input
                :value="draft.cells[rowIndex]?.[columnIndex] ?? ''"
                type="text"
                :data-row="rowIndex"
                :data-column="columnIndex"
                :aria-label="`第 ${rowIndex + 1} 行第 ${columnIndex + 1} 列`"
                @input="updateCell(rowIndex, columnIndex, $event)"
                @keydown.enter.prevent="focusBelow(rowIndex, columnIndex)"
                @keydown.esc.prevent="cancel"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'
import type { CanvasElement, TableConfig } from '@/core/types'
import {
  appendTableColumn,
  appendTableRow,
  cloneTableConfig,
  getTableColumnWeights,
  getTableRowWeights,
  normalizeTableConfig,
} from '@/core/tables'

const props = defineProps<{
  element: CanvasElement
  zoom: number
  panX: number
  panY: number
  activeCell?: { row: number; column: number } | null
}>()

const emit = defineEmits<{
  preview: [table: TableConfig]
  commit: [table: TableConfig]
  cancel: []
}>()

const overlayRef = ref<HTMLElement>()
const draft = ref<TableConfig>(normalizeTableConfig(props.element.table))
const initialSnapshot = ref(JSON.stringify(draft.value))

watch(
  () => props.element.id,
  () => {
    draft.value = normalizeTableConfig(props.element.table)
    initialSnapshot.value = JSON.stringify(draft.value)
  },
)

const columnPercents = computed(() => {
  const weights = getTableColumnWeights(draft.value)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return weights.map((weight) => (weight / total) * 100)
})

const rowPercents = computed(() => {
  const weights = getTableRowWeights(draft.value)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return weights.map((weight) => (weight / total) * 100)
})

const overlayStyle = computed(() => {
  const width = Math.max(120, props.element.width * props.zoom)
  const height = Math.max(68, props.element.height * props.zoom)
  const centerX = (props.element.x + props.element.width / 2) * props.zoom + props.panX
  const centerY = (props.element.y + props.element.height / 2) * props.zoom + props.panY

  return {
    left: `${centerX}px`,
    top: `${centerY}px`,
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(-50%, -50%) rotate(${props.element.rotation || 0}deg)`,
  }
})

const emitPreview = () => {
  emit('preview', cloneTableConfig(draft.value))
}

const updateCell = (row: number, column: number, event: Event) => {
  const rowCells = draft.value.cells[row]
  if (!rowCells) return
  rowCells[column] = (event.target as HTMLInputElement).value
  emitPreview()
}

const commit = () => {
  if (JSON.stringify(draft.value) === initialSnapshot.value) {
    emit('cancel')
    return
  }
  emit('commit', cloneTableConfig(draft.value))
}

const cancel = () => {
  emit('cancel')
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target as Node | null
  if (target && overlayRef.value?.contains(target)) return
  commit()
}

const addRow = () => {
  draft.value = appendTableRow(draft.value)
  emitPreview()
}

const addColumn = () => {
  draft.value = appendTableColumn(draft.value)
  emitPreview()
}

const focusBelow = (row: number, column: number) => {
  const nextRow = Math.min(row + 1, draft.value.rows - 1)
  focusCell(nextRow, column)
}

const focusCell = (row: number, column: number) => {
  const input = overlayRef.value?.querySelector<HTMLInputElement>(
    `input[data-row="${row}"][data-column="${column}"]`,
  )
  input?.focus()
  input?.select()
}

onMounted(async () => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  await nextTick()
  const activeCell = props.activeCell ?? { row: 0, column: 0 }
  focusCell(activeCell.row, activeCell.column)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<style scoped>
.table-edit-overlay {
  position: absolute;
  z-index: 2000;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  border: 2px solid #2f6fed;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 14px 34px rgba(29, 44, 69, 0.2);
}

.table-edit-tools {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px;
  border: 1px solid #dfe5ed;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 8px 22px rgba(29, 44, 69, 0.12);
}

.table-edit-tools > button,
.header-toggle {
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

.table-edit-tools > button:hover,
.header-toggle:hover {
  color: #2f6fed;
  background: #edf3ff;
}

.header-toggle input {
  margin: 0;
  accent-color: #2f6fed;
}

.table-edit-grid {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.table-edit-grid table {
  width: 100%;
  height: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.table-edit-grid td {
  min-width: 0;
  padding: 0;
  border: 1px solid #dfe5ed;
  background: #ffffff;
}

.table-edit-grid td.is-header {
  background: #f2f6fd;
}

.table-edit-grid input {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 5px 7px;
  border: 0;
  outline: 0;
  color: #263349;
  background: transparent;
  font: inherit;
  font-size: 12px;
}

.table-edit-grid td.is-header input {
  font-weight: 600;
}

.table-edit-grid input:focus {
  box-shadow: inset 0 0 0 2px #2f6fed;
  background: #ffffff;
}
</style>
