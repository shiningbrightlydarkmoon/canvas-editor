# Canvas Editor - 单人 + AI 辅助开发计划

## 策略转变

四人团队需要 Manager 类、严格分层来避免代码冲突。**一个人 + AI 不需要这些。**

核心原则：
- **垂直切分**：每次迭代产出可测试的功能，而不是按层开发
- **减少文件**：渲染和交互放同一个文件（PIXI 里它们本来就不分家）
- **先跑起来**：30 分钟内让画布可以拖拽缩放，然后再逐步加功能
- **AI 写样板代码**：PIXI 的啰嗦绘图代码交给 AI，人做决策

## 技术栈详解

### 1. 渲染引擎 — PixiJS v8.14.1

| 项 | 说明 |
|----|------|
| 版本 | `pixi.js: ^8.14.1` |
| 渲染模式 | WebGL（`preference: 'webgl'`），禁用 WebGPU 以保证兼容性 |
| 用途 | 所有画布内容的绘制：图形、文本、图片、选择手柄、滤镜 |

**核心 API（v8 语法，与 v7 完全不同）**：

```ts
// --- Application 初始化 ---
const app = new PIXI.Application()
await app.init({
  width: 800, height: 600,
  backgroundAlpha: 0,        // 透明背景
  antialias: true,           // 抗锯齿
  resolution: devicePixelRatio,
  autoDensity: true,         // CSS 像素与物理像素自动适配
  preference: 'webgl',       // 强制 WebGL
})

// --- Graphics 绘制（v8 链式 API）---
const g = new PIXI.Graphics()
g.rect(x, y, w, h)           // 矩形路径
g.roundRect(x, y, w, h, r)   // 圆角矩形
g.circle(cx, cy, radius)     // 圆形
g.moveTo(x1, y1).lineTo(x2, y2).closePath()  // 多边形
g.fill({ color: 0xff0000, alpha: 0.8 })       // 填充（替代 beginFill）
g.stroke({ width: 2, color: 0x000000 })       // 描边（替代 lineStyle）

// --- 文本 ---
const style = new PIXI.TextStyle({
  fontSize: 16, fontFamily: 'Arial',
  fill: '#2c3e50',           // 文字颜色
  fontWeight: 'bold',        // 加粗
  fontStyle: 'italic',       // 斜体
  wordWrap: true, wordWrapWidth: 200,
})
const text = new PIXI.Text({ text: 'Hello', style })

// --- 图片（Sprite）---
const sprite = PIXI.Sprite.from(imageUrl)
// 或用 Texture
const texture = await PIXI.Assets.load(imageUrl)
const sprite = new PIXI.Sprite(texture)

// --- 滤镜 ---
const grayscale = new PIXI.ColorMatrixFilter()
grayscale.grayscale(0.5)           // 0=无色, 1=全灰
const blur = new PIXI.BlurFilter()
blur.blur = 4                      // 模糊半径
const brightness = new PIXI.ColorMatrixFilter()
brightness.brightness(1.5)         // 1=正常, >1 变亮
g.filters = [grayscale, blur]

// --- 交互事件（v8）---
g.eventMode = 'static'             // 替代 v7 的 interactive = true
g.cursor = 'pointer'
g.on('pointerdown', (e) => { ... })
g.on('pointermove', (e) => { ... })
g.on('pointerup', (e) => { ... })
g.on('pointerupoutside', (e) => { ... })

// --- 舞台变换 ---
app.stage.scale.set(zoom, zoom)    // 缩放
app.stage.position.set(px, py)     // 平移
app.stage.hitArea = new PIXI.Rectangle(0, 0, w, h)  // 点击区域
```

---

### 2. 前端框架 — Vue 3.5 + Composition API

| 项 | 说明 |
|----|------|
| 版本 | `vue: ^3.5.22` |
| 写法 | `<script setup lang="ts">` + Composition API |
| 用途 | 组件逻辑、响应式数据绑定、生命周期管理 |

**核心 API**：

```ts
// --- 响应式 ---
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const count = ref(0)                    // 基础响应式
const doubled = computed(() => count.value * 2)  // 计算属性

watch(source, (newVal, oldVal) => {})  // 侦听变化
watch(source, callback, { deep: true }) // 深度侦听（对象/数组）

// --- 组件通信 ---
const props = defineProps<{ elements: CanvasElement[] }>()  // 父→子
const emit = defineEmits<{ change: [data: Partial<CanvasElement>] }>()  // 子→父

// --- 模板引用 ---
const divRef = ref<HTMLDivElement>()
// <div ref="divRef"></div>
```

---

### 3. 状态管理 — Pinia 3.0

| 项 | 说明 |
|----|------|
| 版本 | `pinia: ^3.0.3` |
| Stores | `canvas`（核心）、`history`（撤销重做）、`clipboard`（复制粘贴）、`app`（工具状态） |
| 用途 | 全局状态管理，所有元素数据、选中状态、历史栈 |

**核心 API**：

```ts
// --- 定义 Store（Options Store 风格）---
import { defineStore } from 'pinia'

export const useCanvasStore = defineStore('canvas', () => {
  const elements = ref<Record<string, CanvasElement>>({})
  const selectedIds = ref<string[]>([])

  const selectedElements = computed(() => { ... })

  const addElement = (data: CreateElementInput): string => { ... }
  const deleteSelectedElements = (): number => { ... }

  return { elements, selectedIds, selectedElements, addElement, deleteSelectedElements }
})

// --- 在组件中使用 ---
import { storeToRefs } from 'pinia'
const store = useCanvasStore()
const { elements, selectedIds } = storeToRefs(store)  // 保持响应性
store.addElement({ ... })                              // 调用 action
```

---

### 4. 类型系统 — TypeScript 5.9

| 项 | 说明 |
|----|------|
| 版本 | `typescript: ~5.9.0` |
| 配置 | `tsconfig.app.json`（extends `@vue/tsconfig`） |
| 用途 | 所有数据结构的类型定义、函数签名、组件 Props/Emits 类型 |

**核心类型（位于 [src/core/types/](src/core/types/)）**：

```ts
// --- 元素类型 ---
type ElementType = 'rect' | 'circle' | 'triangle' | 'text' | 'image'
interface CanvasElement {
  id: string; type: ElementType
  x: number; y: number; width: number; height: number
  rotation?: number; opacity?: number; zIndex?: number
  style: ElementStyle
  content?: string; imageUrl?: string
  filters?: FilterConfig[]
  isSelected?: boolean; isLocked?: boolean
  createdAt: number; updatedAt: number
}

// --- 样式 ---
interface ElementStyle {
  fill: string; stroke: string; strokeWidth: number
  fontSize?: number; fontFamily?: string; color?: string
  fontWeight?: FontWeight; fontStyle?: FontStyle
  textDecoration?: TextDecoration
  cornerRadius?: number
}

// --- 历史记录 ---
interface HistoryRecord {
  id: string; timestamp: number; description: string
  prevState: Record<string, CanvasElement>
  nextState: Record<string, CanvasElement>
  type: 'add' | 'delete' | 'update' | 'move' | 'resize'
}

// --- 视口 ---
interface ViewportState { zoom: number; x: number; y: number }
```

---

### 5. 构建工具 — Vite 7.1

| 项 | 说明 |
|----|------|
| 版本 | `vite: ^7.1.11` |
| 插件 | `@vitejs/plugin-vue`、`vite-plugin-vue-devtools` |
| 别名 | `@` → `./src` |
| 用途 | 开发服务器（HMR 热更新）、生产构建 |

---

### 6. 数据持久化 — IndexedDB

| 项 | 说明 |
|----|------|
| 封装 | [src/lib/utils/storage.ts](src/lib/utils/storage.ts) |
| 数据库 | `CanvasEditorDB`，Store：`snapshots`，Key：`current_canvas` |
| 策略 | 500ms 防抖后自动保存整个 `elements` 对象（`Record<string, CanvasElement>`） |

```ts
// API（已封装好，直接调用即可）
import { saveToDB, loadFromDB } from '@/lib/utils/storage'
await saveToDB(elements)              // 保存
const data = await loadFromDB()       // 读取 → Record<string, CanvasElement> | null
```

---

### 7. 事件通信 — EventBus

| 项 | 说明 |
|----|------|
| 文件 | [src/core/events/EventBus.ts](src/core/events/EventBus.ts) |
| 模式 | 发布-订阅（Pub/Sub） |
| 事件 | `ELEMENT_ADDED/DELETED/UPDATED/SELECTED`、`VIEWPORT_CHANGED`、`HISTORY_CHANGED` 等 |

```ts
import { EventBus, CANVAS_EVENTS } from '@/core/events/EventBus'

// 订阅
EventBus.on(CANVAS_EVENTS.ELEMENT_SELECTED, (elements) => { ... })
// 发布
EventBus.emit(CANVAS_EVENTS.ELEMENT_ADDED, newElement)
// 取消订阅
EventBus.off(CANVAS_EVENTS.ELEMENT_SELECTED, callback)
```

---

### 8. 快捷键 — useShortcuts

| 项 | 说明 |
|----|------|
| 文件 | [src/core/composables/useShortcuts.ts](src/core/composables/useShortcuts.ts) |
| 支持 | Ctrl+Z/Y（撤销/重做）、Ctrl+C/V（复制/粘贴）、Ctrl+X（剪切）、Ctrl+A（全选）、Delete（删除）、Ctrl+S（阻止保存） |

---

### 9. UI 图标 — Lucide Vue Next

| 项 | 说明 |
|----|------|
| 版本 | `lucide-vue-next: ^0.554.0` |
| 用途 | 浮动工具栏的图标按钮 |
| 可用 | `Trash2`, `Copy`, `Layers`, `Bold`, `Italic`, `Underline`, `Strikethrough` 等 |

---

### 10. 工具函数 — lib/utils

| 文件 | 导出 | 用途 |
|------|------|------|
| [id.ts](src/lib/utils/id.ts) | `generateId()`, `deepClone()`, `debounce()`, `throttle()` | ID生成、深拷贝、防抖节流 |
| [storage.ts](src/lib/utils/storage.ts) | `saveToDB()`, `loadFromDB()` | IndexedDB 读写 |
| [file.ts](src/lib/utils/file.ts) | `fileToBase64()` | 图片文件→Base64 |

---

### 11. CSS 样式 — Scoped + Grid/Flexbox

| 项 | 说明 |
|----|------|
| 方案 | Vue SFC `<style scoped>` |
| 布局 | CSS Grid（左侧栏）+ Flexbox（工具栏/面板） |
| 全局 | [src/style.css](src/style.css) — reset 样式 |

---

### 技术栈总览图

```
┌─────────────────────────────────────────────────────┐
│                    App.vue (根组件)                  │
│  布局：Header + 左侧栏 + 画布 + 右侧栏                │
│  快捷键：useShortcuts()                              │
├─────────────────────────────────────────────────────┤
│  CanvasArea.vue (画布核心)                           │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │  PixiJS v8    │  │  交互层       │                 │
│  │  (WebGL渲染)  │  │  (pointer事件) │                 │
│  └──────────────┘  └──────────────┘                 │
├─────────────────────────────────────────────────────┤
│  Pinia Stores                                       │
│  canvas.ts │ history.ts │ clipboard.ts │ app.ts     │
├─────────────────────────────────────────────────────┤
│  core/types/   │  core/events/   │  lib/utils/      │
│  TypeScript    │  EventBus       │  ID/Clone/DB     │
├─────────────────────────────────────────────────────┤
│  IndexedDB (自动保存，500ms防抖)                      │
│  CanvasEditorDB / snapshots / current_canvas         │
└─────────────────────────────────────────────────────┘
```

---

## 迭代计划

### 迭代 1：画布动起来（目标：能拖拽、能缩放）

**只改 2 个文件**：

| 文件 | 改什么 |
|------|--------|
| [CanvasArea.vue](src/modules/rendering/CanvasArea.vue) | 1. 完善渲染（圆角矩形、文本BIUS）2. 画布平移（中键/Space拖拽）3. 缩放（滚轮，以光标为中心）4. 元素拖拽移动（pointerdown/move/up，松手提交store）5. 选择手柄绘制（蓝色边框+8个缩放手柄） |
| [FloatingToolbar.vue](src/modules/ui/components/FloatingToolbar.vue) | 修复 emit（补充 duplicate/bringToFront/sendToBack），事件正确传递给 App.vue |

**产出**：矩形/圆形/三角形/圆角矩形/文本都能画，能拖拽移动，能缩放画布，基础工具栏可用。

### 迭代 2：元素编辑（目标：能缩放、能框选、能改属性）

| 文件 | 改什么 |
|------|--------|
| [CanvasArea.vue](src/modules/rendering/CanvasArea.vue) | 1. 缩放手柄交互（拖拽8个手柄改变元素尺寸）2. 框选（空白区域拖出选择矩形）3. 旋转手柄+交互 |
| [ElementProperties.vue](src/modules/ui/components/ElementProperties.vue) | 补全字段：旋转、透明度、圆角、文本BIUS切换、锁定、名称 |
| [FloatingToolbar.vue](src/modules/ui/components/FloatingToolbar.vue) | 根据选中元素类型显示不同按钮（文本→BIUS、图形→颜色圆角、图片→滤镜） |

**产出**：元素可缩放、可旋转、可框选，属性面板完整，工具栏按类型切换。

### 迭代 3：文本编辑 + 图片（目标：双击打字、图片滤镜）

| 文件 | 改什么 |
|------|--------|
| [CanvasArea.vue](src/modules/rendering/CanvasArea.vue) | 1. 图片渲染（PIXI.Sprite + 3种滤镜）2. 双击文本→弹出编辑框 |
| `TextEditOverlay.vue`（新建） | HTML textarea 覆盖层，定位在文本上方，Enter/Esc 控制提交/取消 |

**产出**：双击文本直接编辑、图片加载并支持滤镜。

### 迭代 4：收尾（目标：修复小问题、验证性能）

| 事项 | 说明 |
|------|------|
| [element.ts](src/core/types/element.ts) | TextDecoration 加 `line-through` |
| [App.vue](src/App.vue) | 确认所有事件绑定正确 |
| 性能验证 | 100元素渲染 < 3s，拖拽 50+ FPS |
| 全流程测试 | 对照需求文档逐项验证 |

---

## 为什么不拆 Manager 类

| 四人团队 | 单人+AI |
|---------|---------|
| 拆文件防止 merge conflict | 无 conflict，拆文件只增加跳转成本 |
| 每人只懂自己那层 | 一个人需要看到全貌 |
| 接口先行，各自开发 | 直接写，AI 帮忙重构 |
| 4 个 Manager 互不信任 | 一个文件里数据流一目了然 |

**CanvasArea.vue 承载渲染+交互，正好符合 PIXI 的设计哲学**（Graphics 对象同时负责绘制和事件）。

---

## 关键技术点

### PixiJS v8 API（与 v7 不同）

```ts
// v8: 链式调用，fill()/stroke() 替代 beginFill()/endFill()
graphics.rect(x, y, w, h).fill({ color: 0xff0000 }).stroke({ width: 2, color: 0x000000 })

// v8: roundRect 原生支持
graphics.roundRect(x, y, w, h, radius)

// v8: eventMode 替代 interactive
graphics.eventMode = 'static'
graphics.on('pointerdown', callback)

// v8: 滤镜
const grayscale = new PIXI.ColorMatrixFilter()
grayscale.grayscale(0.5) // 0~1
```

### 坐标转换（画布缩放平移后的关键）

```ts
// 屏幕坐标 → 画布坐标（用于点击命中判断）
const canvasX = (screenX - stage.x) / stage.scale.x
const canvasY = (screenY - stage.y) / stage.scale.y

// 画布坐标 → 屏幕坐标（用于定位 HTML 覆盖层）
const screenX = canvasX * stage.scale.x + stage.x
const screenY = canvasY * stage.scale.y + stage.y
```

### 拖拽性能关键

```
pointerdown → 记录拖拽起点
pointermove → 直接改 PIXI 对象的 x/y（不触发 store，不触发 watch）
pointerup   → 调 canvasStore.updateElement() 提交到 store
```

**拖拽中绝不调 store**，否则每个像素移动都会触发深拷贝+历史记录+IndexedDB 写入，直接卡死。

---

## 验证清单

完成所有迭代后，按以下顺序验证：

1. `npm run dev`，页面正常加载
2. 点击左侧图形添加 → 画布出现图形
3. 点击图形 → 选中高亮，右侧属性面板显示
4. 拖拽图形 → 移动流畅，松手后位置保存
5. 滚轮缩放 → 以光标为中心缩放
6. 中键/Space拖拽 → 画布平移
7. 拖拽缩放手柄 → 元素尺寸改变
8. 空白区域拖拽 → 框选多个元素
9. 修改属性面板 → 元素实时更新
10. 浮动工具栏按钮 → 删除/复制/置顶生效
11. Ctrl+Z/Y → 撤销重做正常
12. Ctrl+C/V → 复制粘贴正常
13. 刷新页面 → 数据恢复
14. 100个元素 → 渲染 < 3s，拖拽流畅
