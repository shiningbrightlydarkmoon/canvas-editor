<template>
  <div ref="rootRef" class="chart-type-picker" @mousedown.stop>
    <aside class="chart-categories">
      <div class="picker-title">图表类型</div>
      <button
        v-for="category in chartCategories"
        :key="category.id"
        type="button"
        class="category-button"
        :class="{ active: category.id === activeCategoryId }"
        @click="activeCategoryId = category.id"
      >
        <component :is="category.icon" :size="15" />
        <span>{{ category.label }}</span>
      </button>
    </aside>

    <section class="chart-panel">
      <header class="panel-heading">
        <div>
          <strong>{{ activeCategory.label }}</strong>
          <span>{{ activeCategory.description }}</span>
        </div>
        <small>{{ activeOptions.length }} 种</small>
      </header>

      <div class="chart-grid">
        <button
          v-for="option in activeOptions"
          :key="`${activeCategoryId}-${option.value}`"
          type="button"
          class="chart-option"
          :title="`${option.label}：${option.description}`"
          @click="chooseChart(option.value)"
        >
          <span class="chart-option-icon">
            <component :is="getChartIcon(option.value)" :size="20" :stroke-width="1.7" />
          </span>
          <span class="chart-option-copy">
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Component } from 'vue'
import {
  ChartArea,
  ChartBar,
  ChartCandlestick,
  ChartColumn,
  ChartLine,
  ChartNetwork,
  ChartNoAxesCombined,
  ChartPie,
  ChartScatter,
  Gauge,
  Grid3X3,
  Layers3,
  Radar,
} from 'lucide-vue-next'
import type { ChartType } from '@/core/types'
import { chartTypeOptions } from '@/core/charts'

interface ChartCategory {
  id: string
  label: string
  description: string
  icon: Component
  types: ChartType[]
}

const emit = defineEmits<{
  select: [type: ChartType]
  close: []
}>()

const rootRef = ref<HTMLElement>()
const activeCategoryId = ref('common')

const chartCategories: ChartCategory[] = [
  {
    id: 'common',
    label: '常用',
    description: '最常用的数据分析图表',
    icon: ChartColumn,
    types: ['bar', 'line', 'pie', 'area', 'horizontal-bar', 'scatter'],
  },
  {
    id: 'comparison',
    label: '对比',
    description: '比较不同分类和系列的大小',
    icon: ChartBar,
    types: ['bar', 'horizontal-bar', 'stacked-bar', 'radar'],
  },
  {
    id: 'trend',
    label: '趋势',
    description: '观察数据随时间与顺序的变化',
    icon: ChartLine,
    types: ['line', 'area', 'stacked-area', 'candlestick'],
  },
  {
    id: 'proportion',
    label: '占比',
    description: '展示构成比例和层级关系',
    icon: ChartPie,
    types: ['pie', 'doughnut', 'rose', 'funnel', 'treemap', 'sunburst'],
  },
  {
    id: 'distribution',
    label: '分布',
    description: '观察相关关系和数据分布',
    icon: ChartScatter,
    types: ['scatter', 'bubble', 'heatmap', 'boxplot'],
  },
  {
    id: 'relation',
    label: '关系',
    description: '表达流向、网络和单指标状态',
    icon: ChartNetwork,
    types: ['sankey', 'graph', 'gauge'],
  },
]

const chartIcons: Record<ChartType, Component> = {
  bar: ChartColumn,
  'horizontal-bar': ChartBar,
  'stacked-bar': ChartColumn,
  line: ChartLine,
  area: ChartArea,
  'stacked-area': Layers3,
  pie: ChartPie,
  doughnut: ChartPie,
  rose: ChartPie,
  scatter: ChartScatter,
  bubble: ChartScatter,
  radar: Radar,
  gauge: Gauge,
  funnel: ChartNoAxesCombined,
  candlestick: ChartCandlestick,
  boxplot: ChartBar,
  heatmap: Grid3X3,
  treemap: Layers3,
  sunburst: Layers3,
  sankey: ChartNetwork,
  graph: ChartNetwork,
}

const activeCategory = computed(
  () =>
    chartCategories.find((category) => category.id === activeCategoryId.value) ??
    chartCategories[0]!,
)

const activeOptions = computed(() =>
  chartTypeOptions.filter((option) => activeCategory.value.types.includes(option.value)),
)

const getChartIcon = (type: ChartType): Component => chartIcons[type] ?? ChartColumn

const chooseChart = (type: ChartType) => {
  emit('select', type)
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target as HTMLElement | null
  if (rootRef.value?.contains(target)) return
  if (target?.closest('[data-chart-picker-trigger]')) return
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
.chart-type-picker {
  position: fixed;
  top: 60px;
  left: 72px;
  z-index: 1200;
  width: min(560px, calc(100vw - 96px));
  height: min(430px, calc(100vh - 76px));
  display: grid;
  grid-template-columns: 136px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid #dfe5ed;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow:
    0 18px 38px rgba(29, 44, 69, 0.15),
    0 3px 10px rgba(29, 44, 69, 0.06);
  backdrop-filter: blur(12px);
}

.chart-categories {
  min-width: 0;
  padding: 10px 8px;
  border-right: 1px solid #e7ebf1;
  background: #f7f9fc;
}

.picker-title {
  padding: 4px 8px 10px;
  color: #253044;
  font-size: 12px;
  font-weight: 700;
}

.category-button {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 9px;
  border: 0;
  border-radius: 7px;
  color: #667389;
  background: transparent;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.category-button:hover {
  color: #2f6fed;
  background: #edf3ff;
}

.category-button.active {
  color: #ffffff;
  background: #2f6fed;
}

.chart-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.panel-heading {
  min-height: 66px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border-bottom: 1px solid #e7ebf1;
}

.panel-heading > div {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.panel-heading strong {
  color: #253044;
  font-size: 13px;
}

.panel-heading span {
  overflow: hidden;
  color: #8a95a6;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-heading small {
  flex: 0 0 auto;
  color: #2f6fed;
  font-size: 11px;
}

.chart-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 8px;
  padding: 12px;
  overflow-y: auto;
}

.chart-option {
  min-width: 0;
  min-height: 78px;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  padding: 11px;
  border: 1px solid #e3e8ef;
  border-radius: 8px;
  color: #526177;
  background: #ffffff;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.chart-option:hover {
  border-color: #b9cdf9;
  background: #f7faff;
  box-shadow: 0 7px 18px rgba(47, 111, 237, 0.08);
}

.chart-option-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #2f6fed;
  background: #edf3ff;
}

.chart-option-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.chart-option-copy strong {
  color: #253044;
  font-size: 12px;
}

.chart-option-copy small {
  display: -webkit-box;
  overflow: hidden;
  color: #8792a4;
  font-size: 10px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

@media (max-width: 720px) {
  .chart-type-picker {
    left: 64px;
    width: calc(100vw - 64px);
    grid-template-columns: 112px minmax(0, 1fr);
  }

  .chart-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
