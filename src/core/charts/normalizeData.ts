import type { ChartData, ChartDataColumn, ChartDataRow } from '@/core/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toCell = (value: unknown): string | number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'boolean') return value ? 1 : 0
  return String(value)
}

const hasNumericValue = (value: unknown): boolean =>
  typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))

const inferColumn = (key: string, rows: Record<string, unknown>[]): ChartDataColumn => {
  let hasValue = false
  let allNumeric = true

  rows.forEach((row) => {
    const value = row[key]
    if (value === null || value === undefined || value === '') return
    hasValue = true
    if (!hasNumericValue(value)) allNumeric = false
  })

  return {
    key,
    label: key,
    type: hasValue && allNumeric ? 'number' : 'string',
  }
}

const normalizeRecordRows = (rows: Record<string, unknown>[]): ChartData => {
  const keys: string[] = []
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!keys.includes(key)) keys.push(key)
    })
  })

  const columns = keys.map((key) => inferColumn(key, rows))
  const normalizedRows = rows.map((row) => {
    const normalized: ChartDataRow = {}
    columns.forEach((column) => {
      const value = toCell(row[column.key])
      normalized[column.key] = column.type === 'number' && value !== null ? Number(value) || 0 : value
    })
    return normalized
  })

  return { columns, rows: normalizedRows }
}

const normalizeMatrixRows = (rows: unknown[][]): ChartData => {
  if (rows.length === 0) return createDefaultChartData()
  const headers = (rows[0] ?? []).map((value, index) => String(value ?? `字段${index + 1}`))
  const body = rows.slice(1).map((row) => {
    const record: Record<string, unknown> = {}
    headers.forEach((header, index) => {
      record[header] = row[index]
    })
    return record
  })
  return normalizeRecordRows(body)
}

/**
 * 把原始数据统一成图表渲染层认识的中间格式。
 * 支持：
 * 1. ChartData 对象
 * 2. 对象数组，例如 [{ month: '1月', sales: 10 }]
 * 3. 二维数组，例如 [['月份', '销量'], ['1月', 10]]
 *
 * AI 返回的数据也应该先经过这里，而不是直接拼 ECharts option。
 */
export const normalizeChartData = (input: unknown): ChartData => {
  if (Array.isArray(input)) {
    if (input.length === 0) return createDefaultChartData()
    if (Array.isArray(input[0])) return normalizeMatrixRows(input as unknown[][])
    if (isRecord(input[0])) return normalizeRecordRows(input as Record<string, unknown>[])
  }

  if (isRecord(input) && Array.isArray(input.columns) && Array.isArray(input.rows)) {
    const columns: ChartDataColumn[] = input.columns.filter(isRecord).map((column) => ({
      key: String(column.key ?? column.label ?? ''),
      label: String(column.label ?? column.key ?? ''),
      type: column.type === 'number' ? 'number' as const : 'string' as const,
    })).filter((column) => column.key)
    const rows = input.rows.filter(isRecord).map((row) => {
      const normalized: ChartDataRow = {}
      columns.forEach((column) => {
        normalized[column.key] = toCell(row[column.key])
      })
      return normalized
    })
    if (columns.length > 0) return { columns, rows }
  }

  return createDefaultChartData()
}

/**
 * 默认示例数据，方便新建图表后立即看到结果。
 */
export const createDefaultChartData = (): ChartData => ({
  columns: [
    { key: 'month', label: '月份', type: 'string' },
    { key: 'sales', label: '销售额', type: 'number' },
    { key: 'profit', label: '利润', type: 'number' },
  ],
  rows: [
    { month: '1月', sales: 120, profit: 30 },
    { month: '2月', sales: 180, profit: 45 },
    { month: '3月', sales: 150, profit: 38 },
    { month: '4月', sales: 240, profit: 62 },
    { month: '5月', sales: 210, profit: 51 },
  ],
})

export const cloneChartData = (data: ChartData): ChartData =>
  JSON.parse(JSON.stringify(data)) as ChartData

export const getFieldKeys = (data: ChartData): string[] =>
  data.columns.map((column) => column.key)

export const getNumericFields = (data: ChartData): string[] =>
  data.columns.filter((column) => column.type === 'number').map((column) => column.key)
