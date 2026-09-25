import type { ChartConfig, ChartType } from '@/core/types'
import { getNumericFields } from './normalizeData'

export interface ChartAdvice {
  recommendedType: ChartType
  reason: string
  warnings: string[]
}

const TEMPORAL_FIELD_PATTERN = /date|time|month|day|year|日期|时间|月|日|年/i

const isTemporalField = (field: string): boolean => TEMPORAL_FIELD_PATTERN.test(field)

/**
 * 根据数据形态给出安全、可解释的图表建议。
 * 这里的规则不是替代业务判断，而是先挡住明显的误导性组合。
 */
export const getChartAdvice = (config: ChartConfig): ChartAdvice => {
  const rows = config.data.rows
  const xField = config.xField || config.data.columns[0]?.key || ''
  const numericFields = getNumericFields(config.data)
  const categoryFields = config.data.columns.filter((column) => column.type === 'string')
  const warnings: string[] = []

  let recommendedType: ChartType = 'bar'
  let reason = '分类字段配合数值字段时，柱状图最适合做类目比较。'

  if (rows.length === 1 && numericFields.length === 1) {
    recommendedType = 'gauge'
    reason = '只有一行单指标数据时，仪表盘可以直观传达当前值。'
  } else if (numericFields.length >= 2 && categoryFields.length <= 1) {
    recommendedType = numericFields.length >= 3 ? 'bubble' : 'scatter'
    reason = '两个以上数值字段优先观察相关关系，散点图或气泡图比柱状图更合适。'
  } else if (isTemporalField(xField)) {
    recommendedType = 'line'
    reason = '字段名包含时间语义时，优先使用折线图表达趋势。'
  } else if (categoryFields.length === 1 && numericFields.length === 1) {
    recommendedType = rows.length > 12 ? 'horizontal-bar' : 'bar'
    reason = rows.length > 12 ? '分类较多时使用条形图可以减少标签拥挤。' : '单分类加单数值适合柱状图比较。'
  } else if (categoryFields.length === 1 && numericFields.length >= 2) {
    recommendedType = 'stacked-bar'
    reason = '同一分类下存在多个数值系列时，堆叠柱状图可以同时看总量和构成。'
  }

  if (['pie', 'doughnut', 'rose'].includes(config.chartType) && rows.length > 8) {
    warnings.push('饼图分类超过 8 项时辨识度较低，建议改用条形图。')
  }

  if (['pie', 'doughnut', 'rose'].includes(config.chartType)) {
    const valueField = config.yFields?.[0] || numericFields[0] || ''
    const hasNegative = rows.some((row) => Number(row[valueField]) < 0)
    if (hasNegative) warnings.push('饼图不能表达负数，请确认数据是否适合占比分析。')
  }

  if (['line', 'area', 'stacked-area'].includes(config.chartType) && !isTemporalField(xField)) {
    warnings.push('折线图适合连续顺序或时间趋势，当前分类字段可能更适合柱状图。')
  }

  if (['bar', 'line', 'area'].includes(config.chartType) && (config.yFields?.length ?? 0) > 2) {
    warnings.push('同一张图超过 2 个数值系列时容易造成视觉拥挤，谨慎使用双轴。')
  }

  if (config.chartType === 'scatter' && numericFields.length < 2) {
    warnings.push('散点图至少需要两个数值字段。')
  }

  if (config.chartType === 'gauge' && rows.length > 1) {
    warnings.push('仪表盘只建议展示单个指标，当前数据包含多行。')
  }

  return {
    recommendedType,
    reason,
    warnings,
  }
}

export const isChartTypeValid = (type: ChartType, data: ChartConfig['data']): boolean => {
  const numericFields = getNumericFields(data)
  if (type === 'scatter' || type === 'bubble') return numericFields.length >= 2
  if (type === 'gauge') return data.rows.length === 1
  return data.rows.length > 0 && data.columns.length > 0
}
