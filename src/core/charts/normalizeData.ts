import type { ChartData, ChartDataColumn, ChartDataRow } from '@/core/types'

// 判断一个值是否为对象
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// 将任意值转换为图表单元格可接受的值类型（string | number | null）
const toCell = (value: unknown): string | number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'boolean') return value ? 1 : 0
  return String(value)
}

// 判断一个值是否为数字类型，或者是可以转换为数字的字符串
const hasNumericValue = (value: unknown): boolean =>
  typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))

// 根据对象数组推断每一列的类型，返回 ChartDataColumn 对象，判断这列是 number 还是 string
const inferColumn = (key: string, rows: Record<string, unknown>[]): ChartDataColumn => {
  let hasValue = false      // 这列有没有有效值
  let allNumeric = true     // 目前扫过的值是不是全是数值

  // 遍历每一行数据，检查该列的值是否为数字类型，如果有任何一个值不是数字类型，则该列被认为是字符串类型
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

// 把对象数组转成标准的 ChartData 格式，列类型根据值类型推断
const normalizeRecordRows = (rows: Record<string, unknown>[]): ChartData => {
  const keys: string[] = []
  // 收集keys，保证顺序，避免后续列顺序不一致
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!keys.includes(key)) keys.push(key)
    })
  })

  // 判断每一列的类型，生成 ChartDataColumn 对象
  const columns = keys.map((key) => inferColumn(key, rows))
  // 逐行处理数据，转换每个单元格的值为 string | number | null 类型
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

// 把二维数组转成对象数组，然后转换成标准的 ChartData 格式
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
  // 1. 如果是数组，判断是空数组、二维数组还是对象数组
  if (Array.isArray(input)) {
    if (input.length === 0) return createDefaultChartData()
    if (Array.isArray(input[0])) return normalizeMatrixRows(input as unknown[][])
    if (isRecord(input[0])) return normalizeRecordRows(input as Record<string, unknown>[])
  }

  // 2. 如果是对象，判断是否符合 ChartData 格式
  if (isRecord(input) && Array.isArray(input.columns) && Array.isArray(input.rows)) {
    // 过滤掉非对象的列和行，并且确保每一列都有 key 和 label，类型为 'string' 或 'number'
    const columns: ChartDataColumn[] = input.columns.filter(isRecord).map((column) => ({
      key: String(column.key ?? column.label ?? ''),
      label: String(column.label ?? column.key ?? ''),
      type: column.type === 'number' ? 'number' as const : 'string' as const,
    })).filter((column) => column.key)
    // 过滤掉非对象的行，并且确保每一行的值类型符合列定义
    const rows = input.rows.filter(isRecord).map((row) => {
      const normalized: ChartDataRow = {}
      columns.forEach((column) => {
        normalized[column.key] = toCell(row[column.key])
      })
      return normalized
    })
    // 如果有有效的列，返回标准化后的 ChartData，否则返回默认示例数据
    if (columns.length > 0) return { columns, rows }
  }
  // 3. 如果都不符合，返回默认示例数据
  return createDefaultChartData()
}

/**
 * 默认示例数据，方便新建图表后立即看到结果。
 * 为什么是函数而不是常量？因为 ChartData 是引用类型，如果直接使用常量，可能会被修改，导致后续新建图表时数据不一致。
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

// 克隆 ChartData，避免修改原始数据
export const cloneChartData = (data: ChartData): ChartData =>
  JSON.parse(JSON.stringify(data)) as ChartData

// 获取 ChartData 中所有列的 key
export const getFieldKeys = (data: ChartData): string[] =>
  data.columns.map((column) => column.key)

// 获取 ChartData 中所有数值类型的列的 key
export const getNumericFields = (data: ChartData): string[] =>
  data.columns.filter((column) => column.type === 'number').map((column) => column.key)
