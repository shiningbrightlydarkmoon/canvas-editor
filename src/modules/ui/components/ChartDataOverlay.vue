<template>
  <div class="chart-data-overlay" :style="overlayStyle">
    <div class="overlay-header">
      <div>
        <strong>编辑图表数据</strong>
        <span class="overlay-subtitle">{{ element.name || '图表' }}</span>
      </div>
      <button class="close-btn" title="关闭" @click="cancel">×</button>
    </div>

    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th class="row-index">#</th>
            <th
              v-for="column in draft.columns"
              :key="column.key"
              :class="{ 'is-category': isCategoryColumn(column.key) }"
            >
              <input
                v-model="column.label"
                class="column-name-input"
                type="text"
                :aria-label="`${column.label} 字段名称`"
                title="修改字段名称"
                @input="emitPreview"
              />
            </th>
            <th class="row-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in draft.rows" :key="rowIndex">
            <td class="row-index">{{ rowIndex + 1 }}</td>
            <td
              v-for="column in draft.columns"
              :key="column.key"
              :class="{ 'is-category': isCategoryColumn(column.key) }"
            >
              <input
                v-if="column.type === 'number'"
                v-model.number="row[column.key]"
                class="cell-input"
                type="number"
                step="any"
                @input="emitPreview"
              />
              <input
                v-else
                v-model="row[column.key]"
                class="cell-input"
                type="text"
                @input="emitPreview"
              />
            </td>
            <td class="row-actions">
              <button class="remove-row" title="删除这一行" @click="removeRow(rowIndex)">×</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="overlay-footer">
      <button class="secondary-btn" @click="addRow">+ 添加一行</button>
      <div class="footer-actions">
        <button class="secondary-btn" @click="cancel">取消</button>
        <button class="primary-btn" @click="commit">完成</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CanvasElement, ChartData, ChartDataRow } from '@/core/types'
import { cloneChartData } from '@/core/charts/normalizeData'

const props = defineProps<{
  element: CanvasElement
  zoom: number
  panX: number
  panY: number
}>()

const emit = defineEmits<{
  preview: [data: ChartData]
  commit: [data: ChartData]
  cancel: []
}>()

const draft = ref<ChartData>(cloneChartData(props.element.chart?.data || { columns: [], rows: [] }))

const categoryFieldKey = computed(
  () => props.element.chart?.xField ?? props.element.chart?.data.columns[0]?.key ?? '',
)

const isCategoryColumn = (key: string) => key === categoryFieldKey.value

watch(
  () => props.element.id,
  () => {
    draft.value = cloneChartData(props.element.chart?.data || { columns: [], rows: [] })
  },
)

const overlayStyle = computed(() => {
  const sx = props.element.x * props.zoom + props.panX
  const sy = props.element.y * props.zoom + props.panY
  const width = Math.max(320, Math.min(520, props.element.width * props.zoom))
  return {
    left: `${sx}px`,
    top: `${sy}px`,
    width: `${width}px`,
    transform: `rotate(${props.element.rotation || 0}deg)`,
    transformOrigin: 'top left',
  }
})

const emitPreview = () => {
  emit('preview', cloneChartData(draft.value))
}

const commit = () => {
  emit('commit', cloneChartData(draft.value))
}

const cancel = () => {
  emit('cancel')
}

const addRow = () => {
  const row: ChartDataRow = {}
  draft.value.columns.forEach((column) => {
    row[column.key] = column.type === 'number' ? 0 : ''
  })
  draft.value.rows.push(row)
  emitPreview()
}

const removeRow = (index: number) => {
  draft.value.rows.splice(index, 1)
  emitPreview()
}
</script>

<style scoped>
.chart-data-overlay {
  position: absolute;
  z-index: 2000;
  max-height: 70%;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.98);
  border: 2px solid #3498db;
  border-radius: 6px;
  box-shadow: 0 10px 28px rgba(44, 62, 80, 0.22);
  overflow: hidden;
}

.overlay-header,
.overlay-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: #f8fafc;
  border-bottom: 1px solid #e9ecef;
}

.overlay-footer {
  border-top: 1px solid #e9ecef;
  border-bottom: none;
}

.overlay-subtitle {
  display: block;
  margin-top: 2px;
  color: #6c757d;
  font-size: 11px;
}

.close-btn,
.remove-row {
  border: none;
  background: transparent;
  color: #6c757d;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.close-btn:hover,
.remove-row:hover {
  color: #e74c3c;
}

.table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-table th,
.data-table td {
  padding: 4px 5px;
  border-bottom: 1px solid #eef1f4;
  text-align: left;
  white-space: nowrap;
}

.data-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
  color: #6c757d;
  font-weight: 600;
}

.data-table th.is-category,
.data-table td.is-category {
  background: #f5f9ff;
}

.column-name-input {
  width: 100%;
  min-width: 72px;
  padding: 3px 5px;
  border: 1px solid transparent;
  border-radius: 3px;
  color: #526177;
  background: transparent;
  font: inherit;
  font-weight: 600;
}

.column-name-input:hover {
  border-color: #dbe4f1;
  background: #ffffff;
}

.column-name-input:focus {
  outline: none;
  border-color: #3498db;
  background: #ffffff;
}

.cell-input {
  width: 100%;
  min-width: 72px;
  padding: 4px 5px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: #2c3e50;
  font-size: 12px;
}

.cell-input:focus {
  outline: none;
  border-color: #3498db;
  background: #fff;
}

.row-index {
  width: 28px;
  color: #adb5bd;
  text-align: center;
}

.row-actions {
  width: 28px;
  text-align: center;
}

.overlay-footer {
  gap: 8px;
}

.footer-actions {
  display: flex;
  gap: 6px;
}

.primary-btn,
.secondary-btn {
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  padding: 5px 9px;
}

.primary-btn {
  border: 1px solid #3498db;
  background: #3498db;
  color: #fff;
}

.secondary-btn {
  border: 1px solid #dee2e6;
  background: #fff;
  color: #495057;
}

.secondary-btn:hover {
  background: #f8f9fa;
}
</style>
