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
  const rows = getRows(config)
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
        data: rows.map((row) => ({
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
    xAxis: { type: 'value', name: xField },
    yAxis: { type: 'value', name: yField },
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
          : {}),
      },
    ],
  }
}

const buildRadar = (config: ChartConfig): EChartsOption => {
  const xField = getXField(config)
  const yFields = getYFields(config)
  const rows = getRows(config)
  const indicators = rows.map((row) => ({
    name: asLabel(row[xField]),
    max: Math.max(...yFields.map((field) => asNumber(row[field])), 1) * 1.2,
  }))
  return {
    title: getTitle(config),
    tooltip: {},
    legend: getLegend(config),
    radar: { indicator: indicators, radius: config.title ? '58%' : '65%' },
    series: [
      {
        type: 'radar',
        data: yFields.map((field) => ({
          name: getColumnLabel(config, field),
          value: rows.map((row) => asNumber(row[field])),
        })),
      },
    ],
  }
}

const buildGauge = (config: ChartConfig): EChartsOption => {
  const xField = getXField(config)
  const valueField = getValueField(config)
  const row = getRows(config)[0] || {}
  const value = asNumber(row[valueField])
  return {
    title: getTitle(config),
    series: [
      {
        type: 'gauge',
        min: 0,
        max: Math.max(value * 1.5, 100),
        progress: { show: true },
        detail: { formatter: '{value}' },
        data: [{ value, name: asLabel(row[xField]) }],
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
        data: getRows(config).map((row) => ({
          name: asLabel(row[xField]),
          value: asNumber(row[valueField]),
        })),
      },
    ],
  }
}

const buildCandlestick = (config: ChartConfig): EChartsOption => {
  const xField = getXField(config)
  const yFields = getYFields(config)
  const rows = getRows(config)
  return {
    ...cartesianBase(config),
    xAxis: { type: 'category', data: rows.map((row) => asLabel(row[xField])) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'candlestick',
        data: rows.map((row) => {
          const values = yFields.slice(0, 4).map((field) => asNumber(row[field]))
          return values.length === 4 ? values : [0, 0, 0, 0]
        }),
      },
    ],
  }
}

const buildBoxplot = (config: ChartConfig): EChartsOption => {
  const xField = getXField(config)
  const yFields = getYFields(config)
  const rows = getRows(config)
  return {
    ...cartesianBase(config),
    xAxis: { type: 'category', data: rows.map((row) => asLabel(row[xField])) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'boxplot',
        data: rows.map((row) => {
          const values = yFields.slice(0, 5).map((field) => asNumber(row[field]))
          return values.length === 5 ? values : [0, 0, 0, 0, 0]
        }),
      },
    ],
  }
}

const buildHeatmap = (config: ChartConfig): EChartsOption => {
  const xField = getXField(config)
  const yFields = getYFields(config)
  const yField = yFields[0] || xField
  const valueField = yFields[1] || yField
  const rows = getRows(config)
  const xValues = [...new Set(rows.map((row) => asLabel(row[xField])))]
  const yValues = [...new Set(rows.map((row) => asLabel(row[yField])))]
  return {
    title: getTitle(config),
    tooltip: { position: 'top' },
    grid: { left: 60, right: 30, top: config.title ? 64 : 44, bottom: 50, containLabel: true },
    xAxis: { type: 'category', data: xValues },
    yAxis: { type: 'category', data: yValues },
    visualMap: {
      min: 0,
      max: Math.max(...rows.map((row) => asNumber(row[valueField])), 1),
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
    },
    series: [
      {
        type: 'heatmap',
        data: rows.map((row) => [
          xValues.indexOf(asLabel(row[xField])),
          yValues.indexOf(asLabel(row[yField])),
          asNumber(row[valueField]),
        ]),
      },
    ],
  }
}

const buildHierarchy = (config: ChartConfig, type: 'treemap' | 'sunburst'): EChartsOption => {
  const xField = getXField(config)
  const valueField = getValueField(config)
  return {
    title: getTitle(config),
    tooltip: { trigger: 'item' },
    series: [
      {
        type,
        radius: type === 'sunburst' ? ['15%', '75%'] : undefined,
        data: getRows(config).map((row) => ({
          name: asLabel(row[xField]),
          value: asNumber(row[valueField]),
        })),
      },
    ],
  }
}

const buildSankey = (config: ChartConfig, type: 'sankey' | 'graph'): EChartsOption => {
  const xField = getXField(config)
  const yFields = getYFields(config)
  const targetField = yFields[0] || xField
  const valueField = yFields[1] || yFields[0] || xField
  const rows = getRows(config)
  const nodeNames = [
    ...new Set(rows.flatMap((row) => [asLabel(row[xField]), asLabel(row[targetField])])),
  ]
  const nodes = nodeNames.map((name) => ({ name }))
  const links = rows.map((row) => ({
    source: asLabel(row[xField]),
    target: asLabel(row[targetField]),
    value: asNumber(row[valueField]),
  }))

  return {
    title: getTitle(config),
    tooltip: { trigger: 'item' },
    series: [
      type === 'sankey'
        ? { type: 'sankey', data: nodes, links, emphasis: { focus: 'adjacency' } }
        : { type: 'graph', layout: 'force', data: nodes, links, roam: true, label: { show: true } },
    ],
  }
}

const chartDefinitions: Record<ChartType, ChartDefinition> = {
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
  pie: {
    type: 'pie',
    label: '饼图',
    description: '展示组成部分占整体的比例',
    buildOption: (config) => buildPie(config, '60%'),
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
  radar: {
    type: 'radar',
    label: '雷达图',
    description: '比较多维指标的表现',
    buildOption: buildRadar,
  },
  gauge: {
    type: 'gauge',
    label: '仪表盘',
    description: '展示单指标当前值',
    buildOption: buildGauge,
  },
  funnel: {
    type: 'funnel',
    label: '漏斗图',
    description: '展示流程各阶段的转化情况',
    buildOption: buildFunnel,
  },
  candlestick: {
    type: 'candlestick',
    label: 'K线图',
    description: '展示开高低收等金融数据',
    buildOption: buildCandlestick,
  },
  boxplot: {
    type: 'boxplot',
    label: '箱线图',
    description: '观察数据分布与异常值',
    buildOption: buildBoxplot,
  },
  heatmap: {
    type: 'heatmap',
    label: '热力图',
    description: '观察两个维度下的数值密度',
    buildOption: buildHeatmap,
  },
  treemap: {
    type: 'treemap',
    label: '矩形树图',
    description: '展示层级数据的占比',
    buildOption: (config) => buildHierarchy(config, 'treemap'),
  },
  sunburst: {
    type: 'sunburst',
    label: '旭日图',
    description: '展示层级结构和占比关系',
    buildOption: (config) => buildHierarchy(config, 'sunburst'),
  },
  sankey: {
    type: 'sankey',
    label: '桑基图',
    description: '展示节点之间的流向和流量',
    buildOption: (config) => buildSankey(config, 'sankey'),
  },
  graph: {
    type: 'graph',
    label: '关系图',
    description: '展示实体之间的网络关系',
    buildOption: (config) => buildSankey(config, 'graph'),
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
