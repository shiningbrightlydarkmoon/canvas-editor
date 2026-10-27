import type { EChartsOption } from 'echarts'
import type { ChartConfig, ChartDataRow, ChartType } from '@/core/types'
import { getNumericFields } from './normalizeData'          // 获取数据中数值类型的字段列表

// 第一层 ：契约：图表类型、标签、描述、构建图表选项的函数，定义一种图表长什么样

// 定义图表的配置信息
export interface ChartDefinition {
  type: ChartType
  label: string
  description: string                                   // UI 提示的图表类型描述
  buildOption: (config: ChartConfig) => EChartsOption   // 构建图表选项的函数
}

// 第二层 ：取值：从 config 里获取图表类型、x 字段、y 字段、值字段、数据行等信息，构建图表选项

// 获取图表配置中的 x 字段
const getXField = (config: ChartConfig): string =>
  // 三级降级：配置的 xField > 数据列的第一个字段 > 空字符串
  config.xField || config.data.columns[0]?.key || ''

// 获取图表配置中的 y 字段列表
const getYFields = (config: ChartConfig): string[] => {
  // 优先用配置里的 yFileds, filter(Boolean) 过滤掉空字符串或 undefined/null/''
  const configured = config.yFields?.filter(Boolean) ?? []
  if (configured.length > 0) return configured

  // 如果没有配置 yFields，则使用数据中的数值字段
  const numericFields = getNumericFields(config.data)
  return numericFields.length > 0
    ? numericFields
    : config.data.columns.slice(1).map((column) => column.key)
}

// 获取图表配置中的值字段
const getValueField = (config: ChartConfig): string => getYFields(config)[0] || getXField(config)

// 获取图表配置中的数据行
const getRows = (config: ChartConfig): ChartDataRow[] => config.data.rows

// 把任意值转换为可接受的类型，转不了的就返回0
const asNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

// 把任意值转换为可接受的类型，转不了的就返回空字符串
const asLabel = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

// 获取图表标题
const getTitle = (config: ChartConfig) =>
  config.title
    ? {
        text: config.title,
        left: 12,
        top: 8,
        textStyle: { fontSize: 14, fontWeight: 600 },
      }
    : undefined

// 获取图例配置
const getLegend = (config: ChartConfig) =>
  config.showLegend === false
    ? undefined
    : {
        top: config.title ? 28 : 8,
        right: 12,
        type: 'plain' as const,        // 图例类型：plain（普通）或 scroll（可滚动）
      }

// 获取图表数据列的标签，如果没有标签就返回字段名
const getColumnLabel = (config: ChartConfig, key: string): string => {
  const column = config.data.columns.find((item) => item.key === key)
  return column ? column.label : key
}

// 获取图表分类轴的轴名配置，如果没有标签就不显示轴名称
const getCategoryAxisOptions = (config: ChartConfig, key: string) => {
  const label = getColumnLabel(config, key)
  return label.trim()
    ? {
        name: label,
        nameLocation: 'middle' as const,
      }
    : {}
}

// 第三层： 绘图：根据图表类型，构建不同的 EChartsOption 配置，最终渲染图表,4个构造器覆盖12个图

// 构建直角坐标系底座
const cartesianBase = (config: ChartConfig): EChartsOption => ({
  title: getTitle(config),                  // 标题
  tooltip: { trigger: 'axis' },             // 提示框
  legend: getLegend(config),                // 图例
  grid: {
    left: 48,
    right: 24,
    top: config.title ? 64 : 44,
    bottom: 52,
    containLabel: true,
  },                                        // 绘图区域
})

// 柱状 / 条形 / 堆叠 / 折线 / 面积共用直角坐标系底座，差异只在 series 配置。
// 饼图 / 玫瑰图 / 环形图共用饼图底座，差异只在 series 配置。
// 散点图 / 气泡图共用散点图底座，差异只在 series 配置。
// 漏斗图共用漏斗图底座，差异只在 series 配置。

// 构建直角坐标系图表选项
const buildCartesian = (
  config: ChartConfig,
  seriesType: 'bar' | 'line',       // bar：柱状图，line：折线图
  options: {
    stacked?: boolean;              // 堆叠
    area?: boolean;                 // 面积填充
    horizontal?: boolean;           // 水平柱状图
    smooth?: boolean                // 平滑曲线
  } = {},
): EChartsOption => {
  const xField = getXField(config)                                       // 获取 x 字段
  const yFields = getYFields(config)                                     // 获取 y 字段列表
  const rows = getRows(config)                                           // 获取数据行
  // categories 是“按行顺序”取出的类目数组。记住这条规则：类目轴上，series 的数据是按【下标】对应类目的。所以后面每条 series 的 data 也必须按 rows 的顺序生成
  const categories = rows.map((row) => asLabel(row[xField]))             // 获取分类轴的类别列表
  const categoryAxisOptions = getCategoryAxisOptions(config, xField)     // 获取分类轴的轴名配置
  const xAxis = options.horizontal                                       // 如果是水平柱状图，x 轴是数值轴，否则是分类轴
    ? { type: 'value' as const }
    : {
        type: 'category' as const,
        ...categoryAxisOptions,
        nameGap: 30,
        data: categories,
        axisLabel: { hideOverlap: true },    // 分类轴标签重叠时隐藏部分标签
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

// 构建饼图选项
const buildPie = (
  config: ChartConfig,
  radius: string | [string, string],                          // 实心/环形
  roseType?: 'radius',                                        // 玫瑰图
): EChartsOption => {
  const xField = getXField(config)                            // 获取 x 字段，扇区的名字
  const valueField = getValueField(config)                    // 获取值字段，扇区的大小（数值）
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

// 构建散点图选项
const buildScatter = (config: ChartConfig, bubble = false): EChartsOption => {
  const xField = getXField(config)
  const yFields = getYFields(config)
  const rows = getRows(config)
  const yField = yFields[0] || xField
  const sizeField = yFields[1] || yField
  const maxSize = Math.max(...rows.map((row) => asNumber(row[sizeField])), 1)   // 最大气泡尺寸，避免除以零

  return {
    title: getTitle(config),
    tooltip: { trigger: 'item' },
    legend: getLegend(config),
    // 图表布局，bug：x，y轴标签自动换行没有做
    grid: { left: 0, right: 40, top: config.title ? 64 : 44, bottom: 38, containLabel: true },
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

// 构建漏斗图选项，非直角坐标系图表
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

// 第四层：注册表：把图表类型、标签、描述、构建图表选项的函数注册到图表注册表中，供外部使用
// 表 + 查询 + 迁移

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

// 图表注册表,把 chartDefinitions 转换为 Map<ChartType, ChartDefinition>，方便按类型查找图表定义
export const chartRegistry = new Map<ChartType, ChartDefinition>(
  Object.entries(chartDefinitions) as [ChartType, ChartDefinition][],
)

// 图表类型选项列表，用于下拉选择图表类型,把 chartDefinitions 转换为 { value: ChartType, label: string, description: string }[]，方便在 UI 中显示
export const chartTypeOptions = Object.values(chartDefinitions).map((definition) => ({
  value: definition.type,
  label: definition.label,
  description: definition.description,
}))

// 获取图表定义，如果没有找到就返回柱状图定义
export const getChartDefinition = (type: ChartType): ChartDefinition =>
  chartRegistry.get(type) || chartDefinitions.bar

// 整个图表模块对外的渲染入口，从 ChartConfig 构建 EChartsOption，供 ECharts 渲染图表
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

// 把任意值转换为可接受的图表类型，如果没有找到就返回柱状图类型
export const normalizeChartType = (value: unknown): ChartType => {
  // 如果是字符串且在 chartRegistry 中有定义，就返回该类型
  if (typeof value === 'string' && chartRegistry.has(value as ChartType)) {
    return value as ChartType
  }
  // 如果是字符串且在 LEGACY_CHART_TYPE_MAP 中有映射，就返回映射后的类型
  if (typeof value === 'string' && value in LEGACY_CHART_TYPE_MAP) {
    return LEGACY_CHART_TYPE_MAP[value]!
  }
  // 否则返回柱状图类型
  return 'bar'
}
