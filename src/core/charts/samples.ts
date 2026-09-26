import type { ChartConfig, ChartData, ChartType } from '@/core/types'
import { getChartDefinition } from './registry'

const createComparisonData = (): ChartData => ({
  columns: [
    { key: 'category', label: '分类', type: 'string' },
    { key: 'valueA', label: '数值 A', type: 'number' },
    { key: 'valueB', label: '数值 B', type: 'number' },
  ],
  rows: [
    { category: '一月', valueA: 120, valueB: 48 },
    { category: '二月', valueA: 168, valueB: 62 },
    { category: '三月', valueA: 142, valueB: 54 },
    { category: '四月', valueA: 210, valueB: 82 },
    { category: '五月', valueA: 186, valueB: 71 },
    { category: '六月', valueA: 238, valueB: 96 },
  ],
})

const createSingleSeriesData = (): ChartData => ({
  columns: [
    { key: 'category', label: '分类', type: 'string' },
    { key: 'value', label: '数值', type: 'number' },
  ],
  rows: [
    { category: '产品 A', value: 42 },
    { category: '产品 B', value: 28 },
    { category: '产品 C', value: 18 },
    { category: '产品 D', value: 12 },
  ],
})

const createScatterData = (): ChartData => ({
  columns: [
    { key: 'input', label: '投入', type: 'number' },
    { key: 'output', label: '产出', type: 'number' },
    { key: 'scale', label: '规模', type: 'number' },
  ],
  rows: [
    { input: 18, output: 42, scale: 26 },
    { input: 25, output: 58, scale: 38 },
    { input: 31, output: 66, scale: 46 },
    { input: 38, output: 84, scale: 58 },
    { input: 46, output: 91, scale: 72 },
    { input: 55, output: 118, scale: 86 },
  ],
})

const createCandlestickData = (): ChartData => ({
  columns: [
    { key: 'date', label: '日期', type: 'string' },
    { key: 'open', label: '开盘', type: 'number' },
    { key: 'high', label: '最高', type: 'number' },
    { key: 'low', label: '最低', type: 'number' },
    { key: 'close', label: '收盘', type: 'number' },
  ],
  rows: [
    { date: '第 1 日', open: 42, high: 48, low: 39, close: 46 },
    { date: '第 2 日', open: 46, high: 52, low: 44, close: 49 },
    { date: '第 3 日', open: 49, high: 51, low: 43, close: 45 },
    { date: '第 4 日', open: 45, high: 57, low: 44, close: 55 },
    { date: '第 5 日', open: 55, high: 60, low: 51, close: 53 },
    { date: '第 6 日', open: 53, high: 58, low: 49, close: 57 },
  ],
})

const createBoxplotData = (): ChartData => ({
  columns: [
    { key: 'group', label: '分组', type: 'string' },
    { key: 'min', label: '最小值', type: 'number' },
    { key: 'q1', label: '下四分位', type: 'number' },
    { key: 'median', label: '中位数', type: 'number' },
    { key: 'q3', label: '上四分位', type: 'number' },
    { key: 'max', label: '最大值', type: 'number' },
  ],
  rows: [
    { group: '样本 A', min: 12, q1: 24, median: 36, q3: 48, max: 62 },
    { group: '样本 B', min: 18, q1: 31, median: 44, q3: 57, max: 72 },
    { group: '样本 C', min: 9, q1: 22, median: 39, q3: 54, max: 68 },
    { group: '样本 D', min: 21, q1: 35, median: 47, q3: 61, max: 78 },
  ],
})

const createHeatmapData = (): ChartData => {
  const days = ['周一', '周二', '周三', '周四', '周五']
  const periods = ['上午', '下午', '晚间']
  const rows = days.flatMap((day, dayIndex) =>
    periods.map((period, periodIndex) => ({
      day,
      period,
      value: 24 + dayIndex * 11 + periodIndex * 15,
    })),
  )
  return {
    columns: [
      { key: 'day', label: '日期', type: 'string' },
      { key: 'period', label: '时段', type: 'string' },
      { key: 'value', label: '数值', type: 'number' },
    ],
    rows,
  }
}

const createFlowData = (): ChartData => ({
  columns: [
    { key: 'source', label: '来源', type: 'string' },
    { key: 'target', label: '去向', type: 'string' },
    { key: 'value', label: '流量', type: 'number' },
  ],
  rows: [
    { source: '访问', target: '注册', value: 860 },
    { source: '访问', target: '离开', value: 420 },
    { source: '注册', target: '试用', value: 610 },
    { source: '注册', target: '流失', value: 250 },
    { source: '试用', target: '付费', value: 328 },
    { source: '试用', target: '流失', value: 282 },
  ],
})

const createConfig = (
  chartType: ChartType,
  data: ChartData,
  xField: string,
  yFields: string[],
): ChartConfig => ({
  chartType,
  data,
  xField,
  yFields,
  title: getChartDefinition(chartType).label,
  showLegend: true,
})

export const createChartSampleConfig = (chartType: ChartType): ChartConfig => {
  switch (chartType) {
    case 'scatter':
    case 'bubble':
      return createConfig(chartType, createScatterData(), 'input', ['output', 'scale'])
    case 'gauge':
      return createConfig(
        chartType,
        {
          columns: [
            { key: 'metric', label: '指标', type: 'string' },
            { key: 'value', label: '当前值', type: 'number' },
          ],
          rows: [{ metric: '完成率', value: 76 }],
        },
        'metric',
        ['value'],
      )
    case 'candlestick':
      return createConfig(chartType, createCandlestickData(), 'date', [
        'open',
        'close',
        'low',
        'high',
      ])
    case 'boxplot':
      return createConfig(chartType, createBoxplotData(), 'group', [
        'min',
        'q1',
        'median',
        'q3',
        'max',
      ])
    case 'heatmap':
      return createConfig(chartType, createHeatmapData(), 'day', ['period', 'value'])
    case 'sankey':
    case 'graph':
      return createConfig(chartType, createFlowData(), 'source', ['target', 'value'])
    case 'pie':
    case 'doughnut':
    case 'rose':
    case 'funnel':
    case 'treemap':
    case 'sunburst':
      return createConfig(chartType, createSingleSeriesData(), 'category', ['value'])
    default:
      return createConfig(chartType, createComparisonData(), 'category', ['valueA', 'valueB'])
  }
}
