import type { TableConfig } from '@/core/types'

export const MAX_TABLE_PICKER_SIZE = 10
export const DEFAULT_TABLE_CELL_WIDTH = 96
export const DEFAULT_TABLE_CELL_HEIGHT = 34

const normalizeDimension = (value: unknown, fallback: number): number => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(100, Math.round(numeric)))
}

const createEmptyMatrix = (rows: number, columns: number): string[][] =>
  Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''))

const normalizeTrackWeights = (values: unknown, count: number): number[] => {
  const source = Array.isArray(values) ? values : []
  return Array.from({ length: count }, (_, index) => {
    const numeric = typeof source[index] === 'number' ? source[index] : Number(source[index])
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
  })
}

export const createTableConfig = (
  rows: number,
  columns: number,
  cells?: string[][],
  headerRow = false,
  columnWidths?: number[],
  rowHeights?: number[],
): TableConfig => {
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

export const normalizeTableConfig = (table?: Partial<TableConfig> | null): TableConfig =>
  createTableConfig(
    table?.rows ?? 3,
    table?.columns ?? 3,
    table?.cells,
    table?.headerRow ?? false,
    table?.columnWidths,
    table?.rowHeights,
  )

export const getTableColumnWeights = (table: TableConfig): number[] =>
  normalizeTrackWeights(table.columnWidths, table.columns)

export const getTableRowWeights = (table: TableConfig): number[] =>
  normalizeTrackWeights(table.rowHeights, table.rows)

export const cloneTableConfig = (table: TableConfig): TableConfig =>
  createTableConfig(
    table.rows,
    table.columns,
    table.cells,
    table.headerRow,
    table.columnWidths,
    table.rowHeights,
  )

export const appendTableRow = (table: TableConfig): TableConfig => {
  const next = cloneTableConfig(table)
  if (next.rows >= 100) return next
  const existingHeights = getTableRowWeights(next)
  next.rows += 1
  next.cells.push(Array.from({ length: next.columns }, () => ''))
  next.rowHeights = [...existingHeights, 1]
  return next
}

export const appendTableColumn = (table: TableConfig): TableConfig => {
  const next = cloneTableConfig(table)
  if (next.columns >= 100) return next
  const existingWidths = getTableColumnWeights(next)
  next.columns += 1
  next.cells = next.cells.map((row) => [...row, ''])
  next.columnWidths = [...existingWidths, 1]
  return next
}

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
