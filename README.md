# Canvas Editor

一个基于 Vue 3 与 PixiJS 的 Web 画布编辑器。支持图形、文本、图片、表格、图表等元素的绘制与编辑，并接入大模型，用自然语言修改画布；画布数据自动保存到浏览器本地，刷新不丢失。

<!-- 建议补一张界面截图：把图片放到 docs/screenshot.png，然后取消下面这行的注释 -->
<!-- ![界面截图](docs/screenshot.png) -->

## 功能

| 模块 | 能力 |
|---|---|
| 基础元素 | 矩形 / 圆形 / 三角形 / 文本 / 图片 / 表格 / 图表 |
| 画布操作 | 平移、缩放（以光标为锚点）、转屏适配、框选、Shift 加选 |
| 元素操作 | 拖拽、八向缩放、旋转、对齐辅助线吸附、层级调整、锁定、复制粘贴、快捷键 |
| 表格 | 单元格编辑、行列增减、列宽拖拽（列宽按权重存储，缩放后比例不变） |
| 图表 | 5 类 12 种图表，ECharts 离屏渲染后转为纹理参与画布变换，支持数据编辑 |
| AI Agent | 自然语言生成结构化操作，人工确认后批量应用，一次操作一次撤销 |
| 撤销重做 | 命令栈实现，一次用户意图 = 一条历史 |
| 持久化 | IndexedDB 自动保存（500ms 防抖），刷新不丢 |

## 技术栈

Vue 3 · TypeScript · Pinia · PixiJS v8 · ECharts · Vite · IndexedDB · Node.js（本地 Agent 代理）

## 快速开始

```bash
# Node.js >= 20.19
npm install

# 配置模型（可选，见 .env.example）
cp .env.example .env
#   AGENT_BASE_URL=https://api.deepseek.com
#   AGENT_API_KEY=...
#   AGENT_MODEL=deepseek-chat

npm run dev     # 前端 5173 + Agent 服务 8787
npm run build   # 类型检查 + 构建
```

没有模型 Key 时，在 `.env` 里设置 `AGENT_MOCK=1`，Agent 会走本地 Mock 返回，
「输入指令 → 生成操作 → 确认应用 → 撤销」的完整链路依然可以跑通。

## 目录结构

```
src/
├── core/                # 领域层：类型、状态、算法，不依赖视图
│   ├── types/           # CanvasElement / ChartData / TableConfig / 命令与历史
│   ├── store/           # Pinia：canvas / history / clipboard / agent / app
│   ├── agent/           # 操作协议解析与批量应用
│   ├── charts/          # 图表注册表、数据归一化、ECharts ↔ PixiJS 桥接
│   └── tables/          # 表格数据模型（权重、归一化）
├── lib/                 # 基础能力：请求、工具、IndexedDB
├── modules/
│   ├── rendering/       # PixiJS 场景图渲染与交互（CanvasArea.vue）
│   └── ui/              # 工具栏、属性面板、Overlay、Agent 面板
└── App.vue              # 布局与全局快捷键
server/                  # Agent 服务：组装 Prompt、调用模型、校验输出
docs/                    # 架构说明与已知问题记录
```

## 设计要点

- **单向数据流**：`store → 渲染层`；交互期间只改 PixiJS 对象坐标，松手才回写 store，
  避免高频操作触发响应式重算与场景图重建。
- **撤销栈**：命令（`added / removed / updated`）+ 元素不可变，历史里存元素引用而非拷贝。
- **跨引擎桥接**：ECharts 画在离屏 canvas 上，用 `PIXI.CanvasSource` 显式管理 DPR 生成纹理，
  再作为 Sprite 进入场景图，从而复用统一的拖拽 / 缩放 / 旋转 / 命中检测。

更详细的模块划分与数据流见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，
开发过程中踩到的问题与修复记录见 [docs/BUGS.md](docs/BUGS.md)。

## 已知限制

- 未支持多人协同编辑（当前为单机）。
- 一次提交仍会重建整个场景图，200+ 元素时单次提交约 88ms，尚未做按 id 的增量渲染。
- 图片以 base64 存进元素，大图会显著放大存储体积。
- 暂不支持导入导出（pptx / 图片）。

## License

MIT
