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
    // 散点 / 气泡：两个数值轴，气泡额外用第三个字段编码大小
    case 'scatter':
    case 'bubble':
      return createConfig(chartType, createScatterData(), 'input', ['output', 'scale'])

    // 饼 / 环形 / 玫瑰 / 漏斗：单系列占比数据
    case 'pie':
    case 'doughnut':
    case 'rose':
    case 'funnel':
      return createConfig(chartType, createSingleSeriesData(), 'category', ['value'])

    // 折线 / 面积 / 堆叠面积 / 柱状 / 条形 / 堆叠柱状：双系列对比数据
    default:
      return createConfig(chartType, createComparisonData(), 'category', ['valueA', 'valueB'])
  }
}
