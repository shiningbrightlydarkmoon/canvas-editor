import type { EChartsOption } from 'echarts'
import type { ChartConfig, ChartDataRow, ChartType } from '@/core/types'
import { getNumericFields } from './normalizeData'

export interface ChartDefinition {
  type: ChartType
  label: string
  description: string
  buildOption: (config: ChartConfig) => EChartsOption
}

const getXField = (config: ChartConfig): string =>
  config.xField || config.data.columns[0]?.key || ''

const getYFields = (config: ChartConfig): string[] => {
  const configured = config.yFields?.filter(Boolean) ?? []
  if (configured.length > 0) return configured
  const numericFields = getNumericFields(config.data)
  return numericFields.length > 0
    ? numericFields
    : config.data.columns.slice(1).map((column) => column.key)
}

const getValueField = (config: ChartConfig): string => getYFields(config)[0] || getXField(config)

const getRows = (config: ChartConfig): ChartDataRow[] => config.data.rows

const asNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const asLabel = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

const getTitle = (config: ChartConfig) =>
  config.title
    ? {
        text: config.title,
        left: 12,
        top: 8,
        textStyle: { fontSize: 14, fontWeight: 600 },
      }
    : undefined

const getLegend = (config: ChartConfig) =>
  config.showLegend === false
    ? undefined
    : {
        top: config.title ? 28 : 8,
        right: 12,
        type: 'scroll' as const,
      }

const getColumnLabel = (config: ChartConfig, key: string): string => {
  const column = config.data.columns.find((item) => item.key === key)
  return column ? column.label : key
}

const getCategoryAxisOptions = (config: ChartConfig, key: string) => {
  const label = getColumnLabel(config, key)
  return label.trim()
    ? {
        name: label,
        nameLocation: 'middle' as const,
      }
    : {}
}

const cartesianBase = (config: ChartConfig): EChartsOption => ({
  title: getTitle(config),
  tooltip: { trigger: 'axis' },
  legend: getLegend(config),
  grid: {
    left: 48,
    right: 24,
    top: config.title ? 64 : 44,
    bottom: 52,
    containLabel: true,
  },
})

// 柱状 / 条形 / 堆叠 / 折线 / 面积共用直角坐标系底座，差异只在 series 配置。
const buildCartesian = (
  config: ChartConfig,
  seriesType: 'bar' | 'line',
  options: { stacked?: boolean; area?: boolean; horizontal?: boolean; smooth?: boolean } = {},
): EChartsOption => {
  const xField = getXField(config)
  const yFields = getYFields(config)
  const rows = getRows(config)
  const categories = rows.map((row) => asLabel(row[xField]))
  const categoryAxisOptions = getCategoryAxisOptions(config, xField)
  const xAxis = options.horizontal
    ? { type: 'value' as const }
    : {
        type: 'category' as const,
        ...categoryAxisOptions,
        nameGap: 30,
        data: categories,
        axisLabel: { hideOverlap: true },
      }
  const yAxis = options.horizontal
    ? {
        type: 'category' as const,
        ...categoryAxisOptions,
        nameGap: 66,
        data: categories,
        axisLabel: { hideOverlap: true },
      }
    : { type: 'value' as const }

  const series = yFields.map((field) => ({
    name: getColumnLabel(config, field),
    type: seriesType,
    data: rows.map((row) => asNumber(row[field])),
    ...(options.stacked ? { stack: 'total' } : {}),
    ...(options.area ? { areaStyle: {} } : {}),
    ...(options.smooth && seriesType === 'line' ? { smooth: true } : {}),
    emphasis: { focus: 'series' as const },
  }))

  return {
    ...cartesianBase(config),
    xAxis,
    yAxis,
    series,
  }
}

const buildPie = (
  config: ChartConfig,
  radius: string | [string, string],
  roseType?: 'radius',
): EChartsOption => {
  const xField = getXField(config)
  const valueField = getValueField(config)
  return {
    title: getTitle(config),
    tooltip: { trigger: 'item' },
    legend: getLegend(config),
    series: [
      {
        type: 'pie',
        radius,
        ...(roseType ? { roseType } : {}),
        center: ['50%', config.title ? '54%' : '50%'],
        data: getRows(config).map((row) => ({
          name: asLabel(row[xField]),
          value: asNumber(row[valueField]),
        })),
        label: { formatter: '{b}: {c}' },
      },
    ],
  }
}

const buildScatter = (config: ChartConfig, bubble = false): EChartsOption => {
  const xField = getXField(config)
  const yFields = getYFields(config)
  const rows = getRows(config)
  const yField = yFields[0] || xField
  const sizeField = yFields[1] || yField
  const maxSize = Math.max(...rows.map((row) => asNumber(row[sizeField])), 1)

  return {
    title: getTitle(config),
    tooltip: { trigger: 'item' },
    legend: getLegend(config),
    grid: { left: 48, right: 24, top: config.title ? 64 : 44, bottom: 38, containLabel: true },
    xAxis: { type: 'value', name: getColumnLabel(config, xField) },
    yAxis: { type: 'value', name: getColumnLabel(config, yField) },
    series: [
      {
        type: 'scatter',
        name: '数据点',
        data: rows.map((row) => [asNumber(row[xField]), asNumber(row[yField])]),
        ...(bubble
          ? {
              symbolSize: (value: unknown[]) => {
                const row = rows.find(
                  (item) =>
                    asNumber(item[xField]) === value[0] && asNumber(item[yField]) === value[1],
                )
                const size = row ? asNumber(row[sizeField]) : 0
                return 10 + (size / maxSize) * 30
              },
            }
          : { symbolSize: 12 }),
        emphasis: { focus: 'series' as const },
      },
    ],
  }
}

const buildFunnel = (config: ChartConfig): EChartsOption => {
  const xField = getXField(config)
  const valueField = getValueField(config)
  return {
    title: getTitle(config),
    tooltip: { trigger: 'item' },
    legend: getLegend(config),
    series: [
      {
        type: 'funnel',
        left: '10%',
        width: '80%',
        ...(config.title ? { top: 64 } : {}),
        data: getRows(config).map((row) => ({
          name: asLabel(row[xField]),
          value: asNumber(row[valueField]),
        })),
      },
    ],
  }
}

// 按「折线 / 柱状 / 饼 / 散点 / 漏斗」五类组织的图表注册表。
const chartDefinitions: Record<ChartType, ChartDefinition> = {
  // --- 折线图类 ---
  line: {
    type: 'line',
    label: '折线图',
    description: '观察数值随时间或顺序的变化趋势',
    buildOption: (config) => buildCartesian(config, 'line', { smooth: config.smooth ?? true }),
  },
  area: {
    type: 'area',
    label: '面积图',
    description: '强调趋势和累计规模',
    buildOption: (config) =>
      buildCartesian(config, 'line', { area: true, smooth: config.smooth ?? true }),
  },
  'stacked-area': {
    type: 'stacked-area',
    label: '堆叠面积图',
    description: '观察多个系列随时间变化的构成',
    buildOption: (config) =>
      buildCartesian(config, 'line', { area: true, stacked: true, smooth: config.smooth ?? true }),
  },

  // --- 柱状图类 ---
  bar: {
    type: 'bar',
    label: '柱状图',
    description: '比较不同类目的数值大小',
    buildOption: (config) => buildCartesian(config, 'bar'),
  },
  'horizontal-bar': {
    type: 'horizontal-bar',
    label: '条形图',
    description: '适合类目较多、文字较长时比较数值',
    buildOption: (config) => buildCartesian(config, 'bar', { horizontal: true }),
  },
  'stacked-bar': {
    type: 'stacked-bar',
    label: '堆叠柱状图',
    description: '观察总量以及各部分构成',
    buildOption: (config) => buildCartesian(config, 'bar', { stacked: true }),
  },

  // --- 饼图类 ---
  pie: {
    type: 'pie',
    label: '饼图',
    description: '展示组成部分占整体的比例',
    buildOption: (config) => buildPie(config, '62%'),
  },
  doughnut: {
    type: 'doughnut',
    label: '环形图',
    description: '强调占比并保留中心信息空间',
    buildOption: (config) => buildPie(config, ['40%', '70%']),
  },
  rose: {
    type: 'rose',
    label: '玫瑰图',
    description: '展示分类数据的占比差异',
    buildOption: (config) => buildPie(config, '65%', 'radius'),
  },

  // --- 散点图类 ---
  scatter: {
    type: 'scatter',
    label: '散点图',
    description: '观察两个数值字段之间的关系',
    buildOption: (config) => buildScatter(config),
  },
  bubble: {
    type: 'bubble',
    label: '气泡图',
    description: '在散点图基础上编码第三个数值字段',
    buildOption: (config) => buildScatter(config, true),
  },

  // --- 漏斗图类 ---
  funnel: {
    type: 'funnel',
    label: '漏斗图',
    description: '展示流程各阶段的转化情况',
    buildOption: buildFunnel,
  },
}

export const chartRegistry = new Map<ChartType, ChartDefinition>(
  Object.entries(chartDefinitions) as [ChartType, ChartDefinition][],
)

export const chartTypeOptions = Object.values(chartDefinitions).map((definition) => ({
  value: definition.type,
  label: definition.label,
  description: definition.description,
}))

export const getChartDefinition = (type: ChartType): ChartDefinition =>
  chartRegistry.get(type) || chartDefinitions.bar

export const buildChartOption = (config: ChartConfig): EChartsOption =>
  getChartDefinition(config.chartType).buildOption(config)

// 已下线图表类型到相近类型的映射，保证旧 IndexedDB 存档升级后仍能正常渲染。
const LEGACY_CHART_TYPE_MAP: Record<string, ChartType> = {
  radar: 'bar',
  gauge: 'funnel',
  candlestick: 'bar',
  boxplot: 'bar',
  heatmap: 'bar',
  treemap: 'pie',
  sunburst: 'pie',
  sankey: 'funnel',
  graph: 'funnel',
}

export const normalizeChartType = (value: unknown): ChartType => {
  if (typeof value === 'string' && chartRegistry.has(value as ChartType)) {
    return value as ChartType
  }
  if (typeof value === 'string' && value in LEGACY_CHART_TYPE_MAP) {
    return LEGACY_CHART_TYPE_MAP[value]!
  }
  return 'bar'
}
