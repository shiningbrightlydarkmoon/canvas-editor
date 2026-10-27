import type { TableConfig } from '@/core/types'

export const MAX_TABLE_PICKER_SIZE = 10                 // 表格选择器的最大行数和列数
export const DEFAULT_TABLE_CELL_WIDTH = 96              // 表格单元格的默认宽度，单位 px
export const DEFAULT_TABLE_CELL_HEIGHT = 34             // 表格单元格的默认高度，单位 px

// 把任意值转换为 1~100 的整数，非数字值返回 fallback
const normalizeDimension = (value: unknown, fallback: number): number => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(100, Math.round(numeric)))
}

// 创建 rows x columns 的二维数组，所有元素初始化为空字符串''
const createEmptyMatrix = (rows: number, columns: number): string[][] =>
  Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''))

// 把任意值数组转换为指定长度的数字数组，非数字值或小于等于 0 的值返回 1
const normalizeTrackWeights = (values: unknown, count: number): number[] => {
  const source = Array.isArray(values) ? values : []
  return Array.from({ length: count }, (_, index) => {
    const numeric = typeof source[index] === 'number' ? source[index] : Number(source[index])
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
  })
}

// 计算表格的总宽度和总高度，返回对象 { width, height }，表格配置的唯一创建入口
export const createTableConfig = (
  rows: number,
  columns: number,
  cells?: string[][],                       // 单元格内容，二维数组，长度应与 rows 和 columns 相同，缺失的单元格填充为空字符串
  headerRow = false,                        // 首行是否作为表头行，默认 false
  columnWidths?: number[],                  // 列宽权重
  rowHeights?: number[],                    // 行高权重
): TableConfig => {
  // 规整行数和列数，确保在 1~100 之间
  const safeRows = normalizeDimension(rows, 3)
  const safeColumns = normalizeDimension(columns, 3)
  const matrix = createEmptyMatrix(safeRows, safeColumns)

  for (let row = 0; row < safeRows; row++) {
    for (let column = 0; column < safeColumns; column++) {
      const value = cells?.[row]?.[column]
      matrix[row]![column] = value == null ? '' : String(value)
    }
  }

  return {
    rows: safeRows,
    columns: safeColumns,
    cells: matrix,
    headerRow,
    columnWidths: normalizeTrackWeights(columnWidths, safeColumns),
    rowHeights: normalizeTrackWeights(rowHeights, safeRows),
  }
}

// 把可能不完整/非法的表格配置对象规整为合法的 TableConfig 对象
export const normalizeTableConfig = (table?: Partial<TableConfig> | null): TableConfig =>
  createTableConfig(
    table?.rows ?? 3,
    table?.columns ?? 3,
    table?.cells,
    table?.headerRow ?? false,
    table?.columnWidths,
    table?.rowHeights,
  )

// 从 TableConfig 中获取列宽权重数组，并保证其合法
export const getTableColumnWeights = (table: TableConfig): number[] =>
  normalizeTrackWeights(table.columnWidths, table.columns)

// 从 TableConfig 中获取行高权重数组，并保证其合法
export const getTableRowWeights = (table: TableConfig): number[] =>
  normalizeTrackWeights(table.rowHeights, table.rows)

// 深拷贝
export const cloneTableConfig = (table: TableConfig): TableConfig =>
  createTableConfig(
    table.rows,
    table.columns,
    table.cells,
    table.headerRow,
    table.columnWidths,
    table.rowHeights,
  )

// 表格末尾添加一行空单元格
export const appendTableRow = (table: TableConfig): TableConfig => {
  const next = cloneTableConfig(table)
  if (next.rows >= 100) return next
  const existingHeights = getTableRowWeights(next)
  next.rows += 1
  next.cells.push(Array.from({ length: next.columns }, () => ''))
  next.rowHeights = [...existingHeights, 1]
  return next
}

// 表格末尾添加一列空单元格
export const appendTableColumn = (table: TableConfig): TableConfig => {
  const next = cloneTableConfig(table)
  if (next.columns >= 100) return next
  const existingWidths = getTableColumnWeights(next)
  next.columns += 1
  next.cells = next.cells.map((row) => [...row, ''])
  next.columnWidths = [...existingWidths, 1]
  return next
}

// 算出表格的总宽度和总高度，返回对象 { width, height }
export const getTableDimensions = (
  rows: number,
  columns: number,
): { width: number; height: number } => ({
  width: Math.max(
    DEFAULT_TABLE_CELL_WIDTH,
    normalizeDimension(columns, 3) * DEFAULT_TABLE_CELL_WIDTH,
  ),
  height: Math.max(
    DEFAULT_TABLE_CELL_HEIGHT * 2,
    normalizeDimension(rows, 3) * DEFAULT_TABLE_CELL_HEIGHT,
  ),
})
