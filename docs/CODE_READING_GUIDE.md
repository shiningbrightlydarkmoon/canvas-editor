# Canvas Editor 精读地图（2 天速通版）

> 目标不是"读完"，而是**合上文件能画出链路、能答出为什么**。
> 用法：按顺序读，每块结束时完成「产出物」，做不出就不要进入下一块。

## 时间表

| 时段 | 模块 | 产出物 |
|---|---|---|
| Day1 上午 | 可视化内核：坐标 + 渲染 | 手推坐标系公式 + 画「元素渲染」流程图 |
| Day1 下午 | 交互状态机 + 图表桥接 | 画「拖拽/缩放/旋转」三张时序图 |
| Day2 上午 | 表格全链路 | 画「表格数据模型」图 + 说清权重制 |
| Day2 下午 | Agent 全链路 | 画「一次 AI 操作」端到端链路图 |

---

# 模块 0：先建立心智模型（30 分钟，必做）

在读任何渲染代码之前，先记住这一句话：

> **Store 是唯一真相，PIXI 对象只是"临时视图"。**

由此推出整个项目最重要的一条设计规则（README_INTEGRATION 里也强调了）：

- **拖拽过程中（pointermove）：直接改 PIXI 对象的 `x/y/scale/rotation`，绝不碰 Store**
- **松手时（pointerup）：只调用一次 `store.updateElement()`**

为什么？如果每帧调 `updateElement`，会发生：`deepClone(整个 elements)` → `pushHistory`（又 clone 两次）→ 触发 `watch(elements, deep)` → 500ms 防抖写 IndexedDB。每移动一像素就做一次全场深拷贝，直接卡死。

**这就是你面试时第一个要能讲的东西。**

先读这三个文件建立 Store 侧认知（都读过一遍了，这里只看关键部分）：

1. [src/core/store/canvas.ts](src/core/store/canvas.ts)
   - `elements` (L44)：`Record<string, CanvasElement>`，用对象而不是数组，便于 O(1) 按 id 查
   - `elementsArray` (L70)：转数组给渲染层遍历
   - `updateElement` (L105)：唯一的属性写入口，内部 `deepClone` + `pushHistory`
   - `applyElementBatch` (L137)：**Agent 专用**，一批变更只写一条历史
2. [src/core/store/history.ts](src/core/store/history.ts)：快照式历史栈
3. [src/modules/rendering/CanvasArea.vue](src/modules/rendering/CanvasArea.vue) L50-124：props / refs / 坐标变换函数

**产出物**：用一句话说清「Store 变化 → 画布重绘」的通路，以及「指针事件 → Store」的通路。这两条通路方向相反，是单向数据流。

---

# 模块 1：可视化内核（Day1 上午）

## 1.1 坐标系（最重要，必须能手推）

文件：[CanvasArea.vue](src/modules/rendering/CanvasArea.vue) L114-124

```ts
screenToCanvas(sx, sy) => { x: (sx - panX) / zoom, y: (sy - panY) / zoom }
canvasToScreen(cx, cy) => { x: cx * zoom + panX, y: cy * zoom + panY }
```

- **世界坐标（canvas）**：元素的逻辑位置，存在 Store 里
- **屏幕坐标（screen）**：鼠标事件的 `clientX/Y` 相对 canvas 左上角
- 变换由 `stage.scale = zoom` + `stage.position = (panX, panY)` 施加

**必须能答**：
- 鼠标事件的 `event.globalX/globalY` 是屏幕坐标还是世界坐标？（屏幕）
- 所以 `container.toLocal(event.global)` 得到的是什么？（相对于元素左上角的本地坐标，用于手柄命中）

### pivot 中心化（第二重要）

`renderElement` L336-339：

```ts
container.pivot.set(el.width / 2, el.height / 2)   // 旋转/缩放绕中心
container.x = el.x + el.width / 2                  // 但 x/y 存的是中心！
container.y = el.y + el.height / 2
```

为什么？PIXI 的旋转和缩放都围绕 `pivot`，默认 pivot 是 (0,0) 即左上角 → 旋转会"甩出去"。所以把 pivot 设为中心，**代价是 `container.x` 的含义从"左上角"变成了"中心"**。

因此所有提交回 Store 的地方都要做补偿：

```ts
store.updateElement(id, { x: c.x - el.width / 2, y: c.y - el.height / 2 })
```

见 `commitInteraction` L907-953。**这是本项目最容易写错的地方，也是面试官最爱问的"说下你的坐标变换"。**

**自测**：不用看代码，写出「元素中心在 (300,200)，宽 100 高 60，求 container.x/y」。答案：250 / 170。

## 1.2 渲染管线

阅读顺序（同一个文件，按函数跳读）：

| 函数 | 行号 | 回答什么问题 |
|---|---|---|
| `initPixi` | L128 | 为什么用 `<canvas ref>` 而不是 `appendChild`？→ BUGS #1：Vue 会移除不在 VNode 树里的 DOM |
| `hexToNumber` | L169 | `'#3498db' → 0x3498db` |
| `drawShape` | L172 | rect/circle/triangle 的路径绘制；注意 circle 用的是 `ellipse`（BUGS #8：曾经被写死成正圆） |
| `drawSelectionHandles` | L199 | 8 个手柄 + 旋转手柄 + 连接线；尺寸用 `HANDLE_SIZE / zoom` 抵消缩放 |
| `renderElement` | L333 | **核心入口**：按 type 分支渲染，最后挂交互与选中态 |
| `renderAllElements` | L480 | 全量 diff：删掉不存在的，重建存在的 |

**关键分支**：`renderElement` 里 text/image/chart/table 各有专属逻辑，其余图形走 `drawShape` + fill/stroke。

## 1.3 三个必须知道的实现细节

1. **文字装饰线是手画的**（L377-384）：PIXI.Text 不支持 underline，所以用 Graphics 画一条线。
2. **图片不走 PIXI Assets**（L389-403）：BUGS #6 —— PIXI v8 的 Assets 对超长 base64 DataURL 不稳定，所以用原生 `new Image()` 加载后 `PIXI.Texture.from(img)`。
3. **`renderAllElements` 有交互保护**（L482-488）：拖拽/缩放/旋转进行中直接 return，防止 Store 的响应式重渲染打断正在进行的交互。这解决了"拖到一半画面闪回去"。

**产出物**：画出「Store.elements → renderAllElements → renderElement → stage」的流程图，并标出哪一步销毁旧容器。

---

# 模块 2：交互状态机（Day1 下午）

这个模块的核心是**五个状态对象**，全部是普通对象（不是 ref），因为它们只在事件回调里用，不需要触发 Vue 渲染。

| 状态 | 行号 | 用途 |
|---|---|---|
| `dragState` | L688 | 单选/多选拖拽，`targets[]` 存多选时的起点 |
| `resizeState` | L703 | 8 向缩放，记录起始 x/y/w/h |
| `rotateState` | L718 | 旋转，记录起始角度 |
| `tableResizeState` | L729 | 表格分隔线拖拽（只改两列的权重） |
| `boxSelectState` | L742 | 框选矩形 |

## 2.1 舞台级事件 `setupCanvasInteraction` (L960)

- **滚轮以光标为中心缩放**（L970-991）：这是必考题，公式是
  ```
  worldBefore = screenToCanvas(mouse)      // 用旧 zoom/pan 算
  zoom *= delta                            // 改缩放
  worldAfter  = screenToCanvas(mouse)      // 用新 zoom/pan 算
  panX += (worldAfter.x - worldBefore.x) * zoom   // 补偿平移，使光标下的世界点不动
  ```
- **空格/中键平移**（L995-1029）：`spaceHeld` 用 document 级 keydown/keyup 控制
- **框选**（L1181-1241）：默认"部分重叠即选中"，按住 Shift 是"完全包含"

## 2.2 元素级事件 `setupElementInteraction` (L1265)

`pointerdown` 的判定优先级链（**必须能背下来**）：

```
双击检测（时间戳）
  → 中键/空格 → 忽略（交给平移）
  → 表格分隔线命中 → tableResizeState
  → 旋转手柄命中 → rotateState
  → 缩放手柄命中 → resizeState
  → 未选中 + 无 Shift → 选中它 + 开始 dragState
  → Shift + 未选中 → 追加选中
  → 已选中 → 多选拖拽 or 单选拖拽
```

**双击为什么不用 `pointerdblclick`**（L1279-1283）：PixiJS 的 dblclick 在容器重建后不可靠（因为每次重渲染都新建 Container），所以手动用时间戳（300ms 内两次）= 双击。

## 2.3 唯一的提交入口 `commitInteraction` (L893)

拖拽、缩放、旋转、表格调宽**全都在这里提交**，而且 `pointerup` 和 `pointerupoutside` 都调用它。

- BUGS #7：曾经只有 `pointerup` 调，导致"拖出画布松手位置丢失"
- 缩放提交时是反算：`newW = resizeState.startW * c.scale.x`（L934）

## 2.4 对齐吸附 `applyAlignSnap` (L814)

对每个其他元素检查 5 种 X 对齐 + 5 种 Y 对齐，取最小偏差，画红色辅助线。**注意 BUGS #12**：多选拖拽分支没有调用它（L1087-1095），只有单选分支调了（L1110）。

**产出物**：画三张时序图（拖拽 / 8向缩放 / 旋转），横轴是 pointerdown → pointermove → pointerup，标出每步改了哪个 PIXI 属性、什么时候写 Store。

---

# 模块 3：图表桥接（Day1 下午剩余时间）

这是本项目的**技术亮点**，也是剪映方向最值得讲的部分。

## 3.1 两条链路

```
配置：ChartConfig → buildChartOption() → EChartsOption
渲染：ECharts 渲染到离屏 <canvas> → PIXI.CanvasSource → PIXI.Texture → PIXI.Sprite
```

- [charts/registry.ts](src/core/charts/registry.ts)：图表注册表 —— 按「折线 / 柱状 / 饼 / 散点 / 漏斗」分 5 类共 12 种，每类一个构造器，是典型的**注册表 + 策略模式**（`chartDefinitions` L220 起，`normalizeChartType` L335）
- 注意 `normalizeChartType()`：把已下线类型（雷达/仪表盘/K线…）映射到相近类型，用于旧 IndexedDB 存档升级
- [charts/runtime.ts](src/core/charts/runtime.ts)：**桥接层**，重点读 `createChartRuntime`

## 3.2 runtime.ts 里三个必须能讲的设计

1. **为什么手动构造 `CanvasSource` 而不是 `Texture.from(canvas)`**（L31-40）：
   ```ts
   new PIXI.CanvasSource({ resource: canvas, width, height, resolution: pixelRatio, autoDensity: true })
   ```
   显式管理逻辑尺寸与 DPR，避免 PIXI 把物理像素二次解释导致图表模糊/错位。

2. **为什么监听 `rendered` / `finished` 事件**（L52-66）：
   ECharts 的 `setOption` 与真实绘制**不在同一个同步阶段**。如果在 `setOption` 后立刻上传纹理，拿到的是空白 canvas。所以要等 ECharts 自己报"画完了"，再 `textureSource.update()`，并且用 `requestAnimationFrame` 再刷一次兜底。

3. **销毁链路**（`destroy` L~115）：`chart.dispose()` + `sprite.destroy()` + `texture.destroy(true)`。因为 `renderAllElements` 每次都会重建容器，不销毁就内存泄漏。

## 3.3 数据归一化

[charts/normalizeData.ts](src/core/charts/normalizeData.ts) 的 `normalizeChartData`：把 AI/用户给的三种格式（ChartData 对象 / 对象数组 / 二维数组）统一成中间格式，并**推断列类型**（全是数字 → number 列）。这是"防脏数据"的第一道防线。

**产出物**：用一句话讲清「为什么 ECharts 和 PIXI 两个渲染引擎能共存」。

---

# 模块 4：表格全链路（Day2 上午）

## 4.1 数据模型 [core/tables/index.ts](src/core/tables/index.ts)

```ts
interface TableConfig {
  rows, columns: number
  cells: string[][]          // 二维数组，直接内嵌
  headerRow?: boolean
  columnWidths?: number[]    // ★ 权重，不是像素！
  rowHeights?: number[]
}
```

**为什么用权重而不是像素**：元素本身可以被缩放（`el.width` 会变）。如果存像素，缩放后单元格比例会失真；存权重，渲染时按 `el.width * weight / sum(weights)` 分配（见 `renderTable` L264-269），**缩放元素时行列比例自动保持**。

**为什么用二维数组内嵌而不是外置 datasetId**：元素要能整体被快照、撤销、持久化。数据外置会让历史记录和 IndexedDB 保存变得复杂。

## 4.2 四层职责

| 层 | 文件 | 职责 |
|---|---|---|
| 模型 | [tables/index.ts](src/core/tables/index.ts) | 创建/归一化/加行加列/取权重 |
| 渲染 | [CanvasArea.vue](src/modules/rendering/CanvasArea.vue) `renderTable` L251 | Graphics 画网格线 + 每个非空单元格一个 `PIXI.Text` |
| 编辑 | [TableEditOverlay.vue](src/modules/ui/components/TableEditOverlay.vue) | HTML 表格浮层覆盖在元素上方，`draft` 副本编辑 |
| 快捷操作 | [TableQuickActions.vue](src/modules/ui/components/TableQuickActions.vue) | 选中时显示的"+行/+列"浮动按钮 |

**渲染细节**：
- 网格线是一次性 `moveTo/lineTo` 批量画的，然后一次 `stroke()`
- 单元格文本用 `truncateTableText`（L233）按**字符宽度估算**截断加省略号（中文算 1，英文算 0.58）
- 字号自适应行高：`Math.min(fontSize, rowHeight * 0.46)`

## 4.3 编辑浮层的三态模式（**通用设计模式，值得单独记**）

`preview` / `commit` / `cancel`：

- 编辑中 → `emit('preview', draft)` → `handleTablePreview` (L1501) → `replaceElementContainer` 只替换这一个容器（预览用的临时元素）
- 关闭 → `emit('commit', draft)` → `handleTableCommit` (L1512) → 一次 `store.updateElement`（一条历史）
- 取消 → `handleTableCancel` (L1527) → `renderAllElements()` 从 Store 恢复

这个模式在 `ChartDataOverlay` 里也一样（`handleChartPreview` L1442 / `handleChartCommit` L1456）。
**面试可以讲**：编辑期间只改运行时预览，不写 Store，避免每输入一个字产生一条历史。

## 4.4 拖拽调列宽（进阶）

- `getTableTrackSizes` (L564)：权重 → 像素
- `getTableResizeHandleAt` (L578)：命中检测，找最近的内部边界
- `resizeTableTracks` (L643)：**只调整相邻两列**，保持总宽不变，最小 18px
- 旋转元素上的拖拽做了坐标系修正（L1061-1066）：把世界位移根据元素旋转角旋转到本地坐标系

**产出物**：画出 TableConfig 的数据结构图，并解释「缩放表格元素时，为什么列宽比例不会乱」。

---

# 模块 5：Agent 全链路（Day2 下午）

**这是简历上最值钱的部分**，因为它是「LLM 工程化落地」而不是"调了个 API"。

## 5.1 完整链路（必须能画出）

```
AgentPanel.vue (用户输入)
  → createAgentCanvasContext()  [core/agent/context.ts]      组装上下文
  → agentStore.sendMessage()    [core/store/agent.ts]
  → runAgent()                  [lib/api/agent.ts]            fetch /api/agent/run
  → Vite proxy → server/index.ts
      → SYSTEM_PROMPT + history + canvasContext → LLM
      → parseModelJson()        容错解析，白名单校验
  → 前端 normalizeOperation()   二次校验
  → 消息入列表，operationStatus = 'pending'   ★ 不自动执行！
  → 用户点「应用修改」
  → applyAgentOperations()      [core/agent/operations.ts]
  → store.applyElementBatch()   ★ 一批只写一条历史
```

## 5.2 五个设计决策（面试就是问这些）

1. **为什么让模型输出结构化 JSON operation，而不是生成代码？**
   安全：代码可以访问 `window`、发网络请求、读文件。结构化操作只能影响画布数据，能力被严格限制在 7 种 op 里（[types/agent.ts](src/core/types/agent.ts)）。

2. **三道校验**：
   - 服务端 `ALLOWED_OPERATION_TYPES` 白名单（[server/index.ts](server/index.ts)）
   - 前端 `OPERATION_TYPES` 再校验（[lib/api/agent.ts](src/lib/api/agent.ts)）
   - 应用时 `sanitizeElementPatch` 只允许 14 个字段（[core/agent/operations.ts](src/core/agent/operations.ts)）

3. **人机确认（Human-in-the-loop）**：op 不直接执行，先 `pending`，用户点「应用」才生效，可取消。同时 `hasPendingOperations` 会**阻塞新请求**（agent store 里 `isRunning || hasPendingOperations` 就 return），防止多次 AI 操作叠加。

4. **上下文压缩**：`createAgentCanvasContext` 只传 `elementSummaries`（id/type/位置/尺寸/图表类型），**不传完整元素数据**。因为完整数据可能几十 KB，token 成本高且没必要。selectedElements 才给完整数据。

5. **原子撤销**：`applyAgentOperations` 把 7 种 op 归约成 `additions / updates / deletions` 三组，一次性交给 `applyElementBatch`，**只写一条历史**。用户按一次 Ctrl+Z 就能撤销整个 AI 操作。

## 5.3 容错细节（体现工程成熟度）

- `parseModelJson`：剥掉 markdown code fence，从第一个 `{` 到最后一个 `}` 切片再 parse（防止模型输出解释性文字）
- `normalizeChartData` / `createTableConfig`：把模型的脏数据归一化
- `getDefaultPosition`：AI 没给坐标时自动排布到现有元素右侧
- `AGENT_MOCK=1`：无 key 也能离线演示（面试 demo 用这个！）
- 图片/代码/网络请求在 SYSTEM_PROMPT 里被明令禁止

**产出物**：画出上面那条端到端链路，并标出"三道校验"和"一次确认"的位置。

---

# 读完的验收标准

能不看代码回答下面全部问题，就算通了：

**渲染**
1. 为什么拖拽时不写 Store？写了的后果是什么？
2. pivot 设中心后，`container.x` 是什么含义？提交回 Store 要怎么换算？
3. 滚轮以光标为中心缩放的公式怎么推？

**交互**
4. pointerdown 的判定优先级是什么？
5. 双击为什么不用 PIXI 的 pointerdblclick？
6. `pointerupoutside` 为什么也要调 `commitInteraction`？

**图表**
7. ECharts（DOM Canvas）怎么进 PIXI？为什么要监听 `rendered`？

**表格**
8. 行列宽高为什么存权重而不是像素？
9. 编辑浮层的 preview/commit/cancel 三态解决什么问题？

**Agent**
10. 为什么不让模型生成代码？
11. 一次 AI 操作怎么保证只产生一条历史？上下文为什么只传摘要？

答不上来的，回到对应行号精读。

---

# 附：读完顺手做（可选，但强烈建议）

Day2 下午如果还剩时间，按性价比做这三件事，你会立刻多出可讲的素材：

1. **修 `history.ts` 的 off-by-one**（[history.ts#L50-L58](src/core/store/history.ts#L50-L58)）：`undo()` 先自减再取记录，导致单条历史时撤销无效、多条时一次退两步。改为先返回 `stack[currentIndex].prevState` 再自减。
2. **给 `renderAllElements` 加增量渲染**：目前任何变化都销毁重建全部容器（[CanvasArea.vue#L480-L530](src/modules/rendering/CanvasArea.vue#L480-L530)），且 chart 会重建整个 ECharts 实例。改成按 id diff + 复用 `ChartRuntime`。
3. **测真实性能数字**：`performance.now()` 包住 `renderAllElements`，记录 10/50/100 元素耗时，填进简历。
