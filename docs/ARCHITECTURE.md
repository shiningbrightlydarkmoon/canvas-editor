# 架构说明

本文说明 Canvas Editor 的分层、数据流和几个关键设计决策。行号不写死，按文件名检索即可。

## 1. 分层

```
┌─────────────────────────────────────────────┐
│  UI 层  modules/ui + App.vue                │  工具栏 / 属性面板 / Overlay / Agent 面板
├─────────────────────────────────────────────┤
│  状态层  core/store（Pinia）                 │  canvas / history / clipboard / agent / app
├─────────────────────────────────────────────┤
│  渲染层  modules/rendering/CanvasArea.vue    │  PixiJS 场景图 + 指针交互
├─────────────────────────────────────────────┤
│  领域层  core/types · charts · tables · agent│  纯类型与算法，不依赖视图
├─────────────────────────────────────────────┤
│  持久层  lib/utils/storage.ts                │  IndexedDB
└─────────────────────────────────────────────┘
```

约束：`core/` 不 import `modules/`，渲染层只读 store、只通过 store 暴露的方法写。

## 2. 数据流

```
指针事件 → 改 PixiJS 对象（交互期间不入 store）
        → pointerup 一次性 commit
        → store.updateElement / updateElements
        → runCommand 事务：diff 出 CanvasCommand → history.record
        → Vue 响应式通知 → renderAllElements()
        → watch(elements) 500ms 防抖 → IndexedDB
```

两条方向相反的通路：

- **交互通路**：屏幕坐标 → PixiJS 对象，不经过响应式系统。
- **数据通路**：store → 渲染层，单向。

## 3. 坐标系

- 世界坐标：元素逻辑位置，存进 store 的 `x / y / width / height`。
- 屏幕坐标：指针相对 canvas 的位置。
- 变换：`stage.scale = zoom`，`stage.position = (panX, panY)`。

```
screenToCanvas(sx, sy) = ((sx - panX) / zoom, (sy - panY) / zoom)
canvasToScreen(cx, cy) = (cx * zoom + panX, cy * zoom + panY)
```

**pivot 中心化**：容器 `pivot` 设为 `(w/2, h/2)`，使旋转/缩放围绕中心进行；
代价是 `container.x/y` 的含义从「左上角」变成「中心」，因此提交回 store 时要减回半宽半高。

**以光标为锚点的缩放**：缩放前记录光标下的世界点，缩放后反算平移补偿，
使该世界点在屏幕上保持不动。

## 4. 交互状态机

`CanvasArea.vue` 内有五个普通对象（不是 ref，避免触发渲染）：
`dragState` / `resizeState` / `rotateState` / `tableResizeState` / `boxSelectState`。

`pointerdown` 的判定顺序：

```
双击检测（手写 300ms 时间戳）
→ 中键 / 空格（交给平移）
→ 表格分隔线 → 旋转手柄 → 缩放手柄
→ 未选中且无 Shift：选中并准备拖拽
→ Shift：追加选中
→ 已选中：单选 / 多选拖拽
```

所有交互都在 `commitInteraction()` 收口，`pointerup` 与 `pointerupoutside` 都调用它。

## 5. 撤销重做（命令栈）

历史不是快照栈，而是命令栈。一次事务产出一条命令：

```ts
interface CanvasCommand {
  added: CanvasElement[]
  removed: CanvasElement[]
  updated: Array<{ before: CanvasElement; after: CanvasElement }>
}
```

三个关键点：

1. **事务入口**：`runCommand(description, () => { ...mutations... })`。
   入口记一份元素引用的浅拷贝，出口用引用比较推导命令——**漏写记录也不会丢命令**，
   因为命令是从状态差异推导出来的，不是手工声明的。
2. **元素不可变**：更新时整体替换对象，不原地改字段。未变的元素保持原引用，
   于是「引用相同 ⇔ 内容相同」，diff 和撤销都不需要序列化。
3. **空操作不入栈**：字段级（`isSameValue`）、语义级（已置顶再置顶）、
   引用级（diff 为空）三层判定。

撤销 = 反向应用命令（`updated` 换回 `before`、`added` 删除、`removed` 加回）；
重做 = 正向应用。

## 6. 图表桥接

ECharts 与 PixiJS 是两个互不兼容的渲染引擎，桥接方式是：

```
ECharts 画到离屏 canvas
→ new PIXI.CanvasSource({ resource, resolution: DPR, autoDensity: true })
→ PIXI.Texture → PIXI.Sprite → 进入场景图
```

两个坑：

- `setOption` 是异步的，`rendered` 触发时像素可能还没落盘，需要
  `rendered` + `requestAnimationFrame` 双次刷新，并用 `cancelAnimationFrame` 去重。
- 高 DPI 屏下必须显式声明 `resolution`，否则纹理模糊。
  DPR 上限取 2，避免离屏 canvas 面积按平方增长。

## 7. 表格

- `TableConfig` 内嵌在元素里（二维字符串数组），保证元素可以被整体快照、撤销、持久化。
- `columnWidths` / `rowHeights` 存**权重**而不是像素：元素缩放后按权重重新分配宽度，
  行列比例自然保持。
- 拖拽调宽只调整相邻两条轨道，总宽不变，最小 18px。
- 编辑态用 HTML 浮层（`TableEditOverlay`），采用 preview / commit / cancel 三态：
  编辑期间只改临时草稿，提交时才写一条历史。

## 8. AI Agent

```
AgentPanel → 组装上下文（元素摘要，不含完整数据）
→ POST /api/agent/run（Vite 代理到本地 Node 服务）
→ 服务端拼 SYSTEM_PROMPT，调用 OpenAI 兼容接口
   （temperature 0.2 + response_format: json_object）
→ parseModelJson：去掉代码块、截取首个 { 到末个 }、校验操作类型
→ 前端二次校验类型 + 字段白名单
→ 操作进入 pending 状态，等用户确认
→ 确认后 applyElementBatch：整批一次事务、一条历史
```

安全边界：

- 模型只输出受约束的 JSON 操作，**不生成可执行代码**，能力被限制在 7 种操作内。
- 字段白名单限制 `patch` 能改哪些属性。
- API Key 只在服务端，前端不接触。

## 9. 持久化

- IndexedDB 单仓库（`canvases`）单 key（`current_canvas`）存整份画布。
- 保存前 500ms 防抖；事务结束即关闭连接。
- 保存的对象必须是普通对象（Vue 的响应式 Proxy 无法被结构化克隆）。
- v2 版本把仓库从 `snapshots` 改名为 `canvases`，读取时若新仓库为空会回退读旧仓库并迁移。
