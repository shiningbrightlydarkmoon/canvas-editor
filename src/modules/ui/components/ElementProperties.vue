<template>
  <div class="element-properties">
    <section class="element-summary">
      <div class="summary-icon">
        <component :is="elementIcon" :size="17" :stroke-width="1.8" />
      </div>
      <div class="summary-copy">
        <input v-model="localName" class="element-name-input" type="text" aria-label="元素名称" />
        <div class="summary-meta">
          <span>{{ elementTypeLabel }}</span>
          <span v-if="element.type === 'chart' && localChartType" class="summary-divider">·</span>
          <span v-if="element.type === 'chart' && localChartType">{{ chartTypeLabel }}</span>
        </div>
      </div>
      <label class="lock-toggle" :title="localLocked ? '解锁元素' : '锁定元素'">
        <input v-model="localLocked" type="checkbox" />
        <Lock v-if="localLocked" :size="14" />
        <Unlock v-else :size="14" />
      </label>
    </section>

    <section class="property-section">
      <div class="section-heading">
        <Move :size="13" />
        <span>位置与尺寸</span>
      </div>

      <div class="field-grid">
        <label class="field">
          <span class="field-prefix">X</span>
          <input v-model.number="localX" type="number" aria-label="X 坐标" />
        </label>
        <label class="field">
          <span class="field-prefix">Y</span>
          <input v-model.number="localY" type="number" aria-label="Y 坐标" />
        </label>
        <label class="field">
          <span class="field-prefix">W</span>
          <input v-model.number="localWidth" type="number" min="1" aria-label="宽度" />
        </label>
        <label class="field">
          <span class="field-prefix">H</span>
          <input v-model.number="localHeight" type="number" min="1" aria-label="高度" />
        </label>
        <label class="field">
          <span class="field-prefix">旋转</span>
          <input v-model.number="localRotation" type="number" step="1" aria-label="旋转角度" />
          <span class="field-suffix">°</span>
        </label>
        <label class="field">
          <span class="field-prefix">圆角</span>
          <input v-model.number="localCornerRadius" type="number" min="0" aria-label="圆角" />
        </label>
      </div>
    </section>

    <section class="property-section">
      <div class="section-heading">
        <Paintbrush :size="13" />
        <span>外观</span>
      </div>

      <div class="appearance-list">
        <div class="color-field">
          <span class="field-label">填充</span>
          <div class="color-control">
            <label class="color-swatch" :style="{ background: localFill }" title="选择填充颜色">
              <input
                type="color"
                :value="localFill.startsWith('#') ? localFill : '#ffffff'"
                aria-label="填充颜色"
                @input="updateFillColor"
              />
            </label>
            <input v-model="localFill" class="color-text" type="text" aria-label="填充颜色值" />
            <button class="text-action" type="button" @click="localFill = 'transparent'">
              透明
            </button>
          </div>
        </div>

        <div class="color-field">
          <span class="field-label">描边</span>
          <div class="color-control">
            <label class="color-swatch" :style="{ background: localStroke }" title="选择描边颜色">
              <input
                type="color"
                :value="localStroke.startsWith('#') ? localStroke : '#ffffff'"
                aria-label="描边颜色"
                @input="updateStrokeColor"
              />
            </label>
            <input v-model="localStroke" class="color-text" type="text" aria-label="描边颜色值" />
            <label class="number-chip">
              <input
                v-model.number="localStrokeWidth"
                type="number"
                min="0"
                aria-label="描边宽度"
              />
              <span>px</span>
            </label>
          </div>
        </div>

        <div class="opacity-row">
          <span class="field-label">透明度</span>
          <input
            v-model.number="localOpacity"
            class="opacity-range"
            type="range"
            min="0"
            max="1"
            step="0.01"
            aria-label="透明度"
          />
          <span class="opacity-value">{{ Math.round(localOpacity * 100) }}%</span>
        </div>
      </div>
    </section>

    <section v-if="element.type === 'text'" class="property-section">
      <div class="section-heading">
        <Type :size="13" />
        <span>文本</span>
      </div>

      <label class="stacked-field">
        <span>内容</span>
        <textarea v-model="localContent" rows="3" placeholder="输入文本内容" />
      </label>

      <div class="field-grid text-grid">
        <label class="field">
          <span class="field-prefix">字号</span>
          <input v-model.number="localFontSize" type="number" min="8" max="200" aria-label="字号" />
        </label>
        <label class="field">
          <span class="field-prefix">颜色</span>
          <input
            v-model="localColor"
            class="plain-color-input"
            type="color"
            aria-label="字体颜色"
          />
        </label>
      </div>

      <label class="stacked-field compact-field">
        <span>字体</span>
        <select v-model="localFontFamily">
          <option value="Arial">Arial</option>
          <option value="Microsoft YaHei">微软雅黑</option>
          <option value="SimSun">宋体</option>
          <option value="SimHei">黑体</option>
          <option value="Courier New">Courier New</option>
          <option value="Times New Roman">Times New Roman</option>
        </select>
      </label>

      <div class="text-style-row" aria-label="文字样式">
        <button
          class="text-style-button"
          :class="{ active: fontWeight === 'bold' }"
          type="button"
          title="加粗"
          @click="toggleBold"
        >
          B
        </button>
        <button
          class="text-style-button italic"
          :class="{ active: fontStyle === 'italic' }"
          type="button"
          title="斜体"
          @click="toggleItalic"
        >
          I
        </button>
        <button
          class="text-style-button underline"
          :class="{ active: textDecoration === 'underline' }"
          type="button"
          title="下划线"
          @click="toggleUnderline"
        >
          U
        </button>
        <button
          class="text-style-button strike"
          :class="{ active: textDecoration === 'line-through' }"
          type="button"
          title="删除线"
          @click="toggleStrikethrough"
        >
          S
        </button>
      </div>
    </section>

    <section v-if="element.type === 'image'" class="property-section">
      <div class="section-heading">
        <ImageIcon :size="13" />
        <span>图片</span>
      </div>

      <label class="stacked-field">
        <span>图片地址</span>
        <input v-model="localImageUrl" type="text" placeholder="https://..." />
      </label>
    </section>

    <section v-if="element.type === 'table'" class="property-section">
      <div class="section-heading">
        <Table2 :size="13" />
        <span>表格</span>
      </div>

      <div class="data-summary">
        <Table2 :size="13" />
        <span>画布数据 · 内置</span>
        <span class="data-row-count">{{ localTableRows * localTableColumns }} 个单元格</span>
      </div>

      <div class="field-grid table-grid">
        <label class="field">
          <span class="field-prefix">行</span>
          <input
            v-model.number="localTableRows"
            type="number"
            min="1"
            max="100"
            aria-label="表格行数"
          />
        </label>
        <label class="field">
          <span class="field-prefix">列</span>
          <input
            v-model.number="localTableColumns"
            type="number"
            min="1"
            max="100"
            aria-label="表格列数"
          />
        </label>
      </div>

      <label class="table-header-row">
        <span>首行为表头</span>
        <span class="switch-control">
          <input v-model="localTableHeaderRow" type="checkbox" />
          <span class="switch-track"></span>
        </span>
      </label>

      <div class="table-actions">
        <button type="button" @click="localTableRows += 1">
          <Plus :size="13" />
          <span>添加一行</span>
        </button>
        <button type="button" @click="localTableColumns += 1">
          <Plus :size="13" />
          <span>添加一列</span>
        </button>
      </div>

      <div class="data-tip">
        <Table2 :size="13" />
        <span>双击画布中的表格可编辑单元格内容</span>
      </div>
    </section>

    <section v-if="element.type === 'chart'" class="property-section">
      <div class="section-heading">
        <Database :size="13" />
        <span>数据</span>
      </div>

      <div class="data-summary">
        <Database :size="13" />
        <span>画布数据 · 内置</span>
        <span class="data-row-count">{{ chartRowCount }} 行</span>
      </div>

      <div class="field-grid chart-grid">
        <label class="field">
          <span class="field-prefix">类型</span>
          <select v-model="localChartType">
            <option v-for="option in chartTypeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="field-prefix">图例</span>
          <span class="switch-control">
            <input v-model="localShowLegend" type="checkbox" />
            <span class="switch-track"></span>
          </span>
        </label>
      </div>

      <div v-if="chartAdvice" class="chart-advice">
        <div class="advice-title">
          <ChartColumn :size="13" />
          <span>推荐 {{ recommendedChartLabel }}</span>
        </div>
        <div class="advice-reason">{{ chartAdvice.reason }}</div>
        <div v-for="warning in chartAdvice.warnings" :key="warning" class="advice-warning">
          {{ warning }}
        </div>
      </div>

      <label class="stacked-field compact-field">
        <span>图表标题</span>
        <input v-model="localChartTitle" type="text" placeholder="图表标题" />
      </label>

      <label class="stacked-field compact-field">
        <span>分类字段</span>
        <select v-model="localXField">
          <option v-for="column in chartColumns" :key="column.key" :value="column.key">
            {{ column.label }}
          </option>
        </select>
      </label>

      <label class="stacked-field compact-field">
        <span>数值字段</span>
        <input v-model="localYFieldsText" type="text" placeholder="sales, profit" />
        <small>多个字段请使用逗号分隔</small>
      </label>

      <div class="data-tip">
        <Table2 :size="13" />
        <span>双击画布中的图表可编辑原始数据</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ChartColumn,
  Circle,
  Database,
  Image as ImageIcon,
  Lock,
  Move,
  Paintbrush,
  Plus,
  Square,
  Table2,
  Triangle,
  Type,
  Unlock,
} from 'lucide-vue-next'
import type { CanvasElement, ChartType, FontStyle, FontWeight } from '@/core/types'
import { chartTypeOptions, getChartAdvice } from '@/core/charts'
import { createTableConfig, normalizeTableConfig } from '@/core/tables'

const props = defineProps<{ element: CanvasElement }>()

const emit = defineEmits<{ change: [properties: Record<string, unknown>] }>()

const localName = ref(props.element.name || '')
const localX = ref(props.element.x)
const localY = ref(props.element.y)
const localWidth = ref(props.element.width)
const localHeight = ref(props.element.height)
const localRotation = ref(props.element.rotation || 0)
const localOpacity = ref(props.element.opacity ?? 1)
const localFill = ref(props.element.style.fill || '#3498db')
const localStroke = ref(props.element.style.stroke || '#000000')
const localStrokeWidth = ref(props.element.style.strokeWidth ?? 1)
const localCornerRadius = ref(props.element.style.cornerRadius ?? 0)
const localFontSize = ref(props.element.style.fontSize ?? 16)
const localFontFamily = ref(props.element.style.fontFamily ?? 'Arial')
const localColor = ref(props.element.style.color ?? '#2c3e50')
const localContent = ref(props.element.content || '')
const localImageUrl = ref(props.element.imageUrl || '')
const localLocked = ref(props.element.isLocked ?? false)
const localChartType = ref<ChartType>(props.element.chart?.chartType ?? 'bar')
const localChartTitle = ref(props.element.chart?.title ?? '')
const localXField = ref(
  props.element.chart?.xField ?? props.element.chart?.data.columns[0]?.key ?? '',
)
const localYFieldsText = ref((props.element.chart?.yFields ?? []).join(', '))
const localShowLegend = ref(props.element.chart?.showLegend ?? true)
const localTableRows = ref(normalizeTableConfig(props.element.table).rows)
const localTableColumns = ref(normalizeTableConfig(props.element.table).columns)
const localTableHeaderRow = ref(normalizeTableConfig(props.element.table).headerRow ?? false)

const chartColumns = computed(() => props.element.chart?.data.columns ?? [])
const chartAdvice = computed(() =>
  props.element.chart ? getChartAdvice(props.element.chart) : null,
)
const chartRowCount = computed(() => props.element.chart?.data.rows.length ?? 0)
const chartTypeLabel = computed(
  () => chartTypeOptions.find((option) => option.value === localChartType.value)?.label ?? '图表',
)
const recommendedChartLabel = computed(() => {
  const recommended = chartAdvice.value?.recommendedType
  return chartTypeOptions.find((option) => option.value === recommended)?.label ?? '柱状图'
})

const elementTypeLabel = computed(() => {
  const labels: Record<CanvasElement['type'], string> = {
    rect: '矩形',
    circle: '圆形',
    triangle: '三角形',
    text: '文本',
    image: '图片',
    chart: '图表',
    table: '表格',
  }
  return labels[props.element.type]
})

const elementIcon = computed(() => {
  const icons = {
    rect: Square,
    circle: Circle,
    triangle: Triangle,
    text: Type,
    image: ImageIcon,
    chart: ChartColumn,
    table: Table2,
  }
  return icons[props.element.type]
})

const fontWeight = ref<FontWeight>(props.element.style.fontWeight ?? 'normal')
const fontStyle = ref<FontStyle>(props.element.style.fontStyle ?? 'normal')
const textDecoration = ref(props.element.style.textDecoration ?? 'none')

const toggleBold = () => {
  fontWeight.value = fontWeight.value === 'bold' ? 'normal' : 'bold'
}
const toggleItalic = () => {
  fontStyle.value = fontStyle.value === 'italic' ? 'normal' : 'italic'
}
const toggleUnderline = () => {
  textDecoration.value = textDecoration.value === 'underline' ? 'none' : 'underline'
}
const toggleStrikethrough = () => {
  textDecoration.value = textDecoration.value === 'line-through' ? 'none' : 'line-through'
}

const updateFillColor = (event: Event) => {
  localFill.value = (event.target as HTMLInputElement).value
}

const updateStrokeColor = (event: Event) => {
  localStroke.value = (event.target as HTMLInputElement).value
}

const buildChanges = (): Record<string, unknown> => {
  const changes: Record<string, unknown> = {
    name: localName.value,
    x: localX.value,
    y: localY.value,
    width: localWidth.value,
    height: localHeight.value,
    rotation: localRotation.value,
    opacity: localOpacity.value,
    isLocked: localLocked.value,
    style: {
      ...props.element.style,
      fill: localFill.value,
      stroke: localStroke.value,
      strokeWidth: localStrokeWidth.value,
      cornerRadius: localCornerRadius.value,
    },
  }

  if (props.element.type === 'text') {
    changes.content = localContent.value
    ;(changes.style as Record<string, unknown>).fontSize = localFontSize.value
    ;(changes.style as Record<string, unknown>).fontFamily = localFontFamily.value
    ;(changes.style as Record<string, unknown>).color = localColor.value
    ;(changes.style as Record<string, unknown>).fontWeight = fontWeight.value
    ;(changes.style as Record<string, unknown>).fontStyle = fontStyle.value
    ;(changes.style as Record<string, unknown>).textDecoration = textDecoration.value
  }

  if (props.element.type === 'image') {
    changes.imageUrl = localImageUrl.value
  }

  if (props.element.type === 'chart' && props.element.chart) {
    changes.chart = {
      ...props.element.chart,
      chartType: localChartType.value,
      title: localChartTitle.value,
      xField: localXField.value,
      yFields: localYFieldsText.value
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean),
      showLegend: localShowLegend.value,
    }
  }

  if (props.element.type === 'table') {
    const tableRows = Math.max(1, Number(localTableRows.value) || 1)
    const tableColumns = Math.max(1, Number(localTableColumns.value) || 1)
    const currentTable = normalizeTableConfig(props.element.table)
    changes.table = createTableConfig(
      tableRows,
      tableColumns,
      props.element.table?.cells,
      localTableHeaderRow.value,
      props.element.table?.columnWidths,
      props.element.table?.rowHeights,
    )

    if (tableRows !== currentTable.rows) {
      changes.height = Math.max(20, (props.element.height * tableRows) / currentTable.rows)
    }
    if (tableColumns !== currentTable.columns) {
      changes.width = Math.max(20, (props.element.width * tableColumns) / currentTable.columns)
    }
  }

  return changes
}

const syncFromProps = () => {
  localName.value = props.element.name || ''
  localX.value = props.element.x
  localY.value = props.element.y
  localWidth.value = props.element.width
  localHeight.value = props.element.height
  localRotation.value = props.element.rotation || 0
  localOpacity.value = props.element.opacity ?? 1
  localFill.value = props.element.style.fill || '#3498db'
  localStroke.value = props.element.style.stroke || '#000000'
  localStrokeWidth.value = props.element.style.strokeWidth ?? 1
  localCornerRadius.value = props.element.style.cornerRadius ?? 0
  localFontSize.value = props.element.style.fontSize ?? 16
  localFontFamily.value = props.element.style.fontFamily ?? 'Arial'
  localColor.value = props.element.style.color ?? '#2c3e50'
  localContent.value = props.element.content || ''
  localImageUrl.value = props.element.imageUrl || ''
  localLocked.value = props.element.isLocked ?? false
  localChartType.value = props.element.chart?.chartType ?? 'bar'
  localChartTitle.value = props.element.chart?.title ?? ''
  localXField.value = props.element.chart?.xField ?? props.element.chart?.data.columns[0]?.key ?? ''
  localYFieldsText.value = (props.element.chart?.yFields ?? []).join(', ')
  localShowLegend.value = props.element.chart?.showLegend ?? true
  localTableRows.value = normalizeTableConfig(props.element.table).rows
  localTableColumns.value = normalizeTableConfig(props.element.table).columns
  localTableHeaderRow.value = normalizeTableConfig(props.element.table).headerRow ?? false
  fontWeight.value = props.element.style.fontWeight ?? 'normal'
  fontStyle.value = props.element.style.fontStyle ?? 'normal'
  textDecoration.value = props.element.style.textDecoration ?? 'none'
}

watch(
  () => props.element,
  () => syncFromProps(),
  { deep: true },
)

watch(
  [
    localName,
    localX,
    localY,
    localWidth,
    localHeight,
    localRotation,
    localOpacity,
    localFill,
    localStroke,
    localStrokeWidth,
    localCornerRadius,
    localFontSize,
    localFontFamily,
    localColor,
    localContent,
    localImageUrl,
    localLocked,
    localChartType,
    localChartTitle,
    localXField,
    localYFieldsText,
    localShowLegend,
    localTableRows,
    localTableColumns,
    localTableHeaderRow,
    fontWeight,
    fontStyle,
    textDecoration,
  ],
  () => {
    emit('change', buildChanges())
  },
)
</script>

<style scoped>
.element-properties {
  --panel-line: #e7ebf1;
  --field-bg: #f8fafc;
  --field-line: #e2e7ee;
  --text-main: #253044;
  --text-soft: #7b8799;
  --accent: #2f6fed;
  color: var(--text-main);
}

.element-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  margin-bottom: 4px;
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 5px 14px rgba(30, 45, 72, 0.04);
}

.summary-icon {
  width: 34px;
  height: 34px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: var(--accent);
  background: #edf3ff;
  border-radius: 9px;
}

.summary-copy {
  min-width: 0;
  flex: 1;
}

.element-name-input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  color: var(--text-main);
  background: transparent;
  font-size: 13px;
  font-weight: 600;
}

.element-name-input:focus {
  color: var(--accent);
}

.summary-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 16px;
  margin-top: 3px;
  color: var(--text-soft);
  font-size: 11px;
}

.summary-divider {
  color: #b5bdc9;
}

.lock-toggle {
  width: 30px;
  height: 30px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  color: #7c889a;
  background: #f7f9fc;
  cursor: pointer;
}

.lock-toggle:hover {
  color: var(--accent);
  background: #edf3ff;
}

.lock-toggle input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.property-section {
  padding: 14px 2px;
  border-bottom: 1px solid var(--panel-line);
}

.property-section:last-child {
  border-bottom: 0;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: #667389;
  font-size: 11px;
  font-weight: 600;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.field {
  min-width: 0;
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 9px;
  border: 1px solid var(--field-line);
  border-radius: 8px;
  color: var(--text-soft);
  background: var(--field-bg);
  font-size: 11px;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.field:focus-within {
  border-color: #b9cdf9;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.08);
}

.field-prefix,
.field-suffix {
  flex: 0 0 auto;
  color: #8792a4;
}

.field input,
.field select {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  color: var(--text-main);
  background: transparent;
  font: inherit;
  font-variant-numeric: tabular-nums;
}

.field select {
  cursor: pointer;
}

.appearance-list {
  display: grid;
  gap: 8px;
}

.color-field {
  display: grid;
  grid-template-columns: 45px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
}

.field-label {
  color: #7b8799;
  font-size: 11px;
}

.color-control {
  min-width: 0;
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 6px;
  border: 1px solid var(--field-line);
  border-radius: 8px;
  background: var(--field-bg);
}

.color-control:focus-within {
  border-color: #b9cdf9;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.08);
}

.color-swatch {
  position: relative;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid rgba(28, 39, 57, 0.14);
  border-radius: 6px;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.color-swatch input,
.plain-color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.color-text {
  min-width: 0;
  flex: 1;
  padding: 0;
  border: 0;
  outline: 0;
  color: var(--text-main);
  background: transparent;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.text-action {
  padding: 0 5px;
  border: 0;
  color: var(--accent);
  background: transparent;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.number-chip {
  height: 24px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
  border-left: 1px solid var(--field-line);
  color: #8c97a8;
  font-size: 10px;
}

.number-chip input {
  width: 26px;
  color: var(--text-main);
}

.opacity-row {
  min-height: 34px;
  display: grid;
  grid-template-columns: 45px minmax(0, 1fr) 38px;
  align-items: center;
  gap: 7px;
}

.opacity-range {
  width: 100%;
  height: 4px;
  accent-color: var(--accent);
  cursor: pointer;
}

.opacity-value {
  color: #5c6a7f;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.stacked-field {
  display: grid;
  gap: 6px;
  color: var(--text-soft);
  font-size: 11px;
}

.stacked-field + .stacked-field,
.stacked-field + .field-grid,
.field-grid + .stacked-field,
.text-style-row {
  margin-top: 9px;
}

.stacked-field input,
.stacked-field textarea,
.stacked-field select {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 9px;
  border: 1px solid var(--field-line);
  border-radius: 8px;
  outline: 0;
  color: var(--text-main);
  background: var(--field-bg);
  font: inherit;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.stacked-field input:focus,
.stacked-field textarea:focus,
.stacked-field select:focus {
  border-color: #b9cdf9;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.08);
}

.stacked-field textarea {
  min-height: 70px;
  resize: vertical;
  line-height: 1.5;
}

.stacked-field small {
  margin-top: -2px;
  color: #9aa4b3;
  font-size: 10px;
}

.compact-field {
  margin-top: 9px;
}

.text-grid {
  margin-top: 9px;
}

.text-grid .plain-color-input {
  position: static;
  width: 18px;
  height: 18px;
  opacity: 1;
  padding: 0;
  border: 0;
  border-radius: 5px;
}

.text-style-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.text-style-button {
  height: 32px;
  border: 1px solid var(--field-line);
  border-radius: 8px;
  color: #58667b;
  background: var(--field-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.text-style-button:hover {
  color: var(--accent);
  border-color: #c8d8f9;
  background: #f7faff;
}

.text-style-button.active {
  color: #ffffff;
  border-color: var(--accent);
  background: var(--accent);
}

.text-style-button.italic {
  font-style: italic;
}

.text-style-button.underline {
  text-decoration: underline;
}

.text-style-button.strike {
  text-decoration: line-through;
}

.chart-grid {
  margin-bottom: 9px;
}

.table-grid {
  margin-bottom: 9px;
}

.table-header-row {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 9px;
  border: 1px solid var(--field-line);
  border-radius: 8px;
  color: #6f7b8f;
  background: var(--field-bg);
  font-size: 11px;
}

.table-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 9px;
}

.table-actions button {
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--field-line);
  border-radius: 8px;
  color: #5f6c80;
  background: var(--field-bg);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.table-actions button:hover {
  color: var(--accent);
  border-color: #c8d8f9;
  background: #f7faff;
}

.data-summary,
.data-tip {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 9px;
  color: #708096;
  background: var(--field-bg);
  border-radius: 8px;
  font-size: 11px;
}

.data-summary {
  margin-bottom: 8px;
}

.data-row-count {
  margin-left: auto;
  color: #98a3b3;
}

.data-tip {
  margin-top: 9px;
  color: #7d899b;
}

.switch-control {
  position: relative;
  width: 28px;
  height: 17px;
  flex: 0 0 auto;
  margin-left: auto;
}

.switch-control input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.switch-track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: #ced5df;
  transition: background 0.18s ease;
}

.switch-track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(31, 43, 62, 0.2);
  transition: transform 0.18s ease;
}

.switch-control input:checked + .switch-track {
  background: var(--accent);
}

.switch-control input:checked + .switch-track::after {
  transform: translateX(11px);
}

.chart-advice {
  margin: 9px 0;
  padding: 9px;
  border: 1px solid #dce7fd;
  border-radius: 8px;
  background: #f6f9ff;
  font-size: 11px;
  line-height: 1.5;
}

.advice-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #2f6fed;
  font-weight: 600;
}

.advice-reason {
  margin-top: 4px;
  color: #6e7b8f;
}

.advice-warning {
  margin-top: 4px;
  color: #c17618;
}
</style>
