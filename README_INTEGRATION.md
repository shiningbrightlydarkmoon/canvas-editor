# 画布编辑器 - 核心代码合并与开发接入指南

发布人：D同学 (邓 - 数据层负责人) 适用对象：全员 (A潘, B孙, C余) 当前进度： ✅ 核心状态管理 (Store) 已就绪 ✅ 数据类型定义 (Types) 已就绪 ✅ 工具函数与事件总线 已就绪

📂 1. 目录结构对照 (请严格遵守)
开发前，请确保你们本地的 src 目录结构与下表一致。标有 ⭐ 的是我的核心代码，请不要随意修改；标有 🟢 的是你们各自的主战场。

Plaintext

src/
├── core/  ⭐ [核心逻辑层 - D同学维护]
│   ├── types/              # 所有TS类型定义 (引用时: import ... from '@/core/types')
│   ├── store/              # Pinia状态管理
│   │   ├── canvas.ts       # 画布数据、图层、选择逻辑
│   │   ├── history.ts      # 撤销重做
│   │   ├── clipboard.ts    # 复制粘贴
│   │   └── app.ts          # 工具状态
│   └── events/             # EventBus
├── lib/   ⭐ [工具库 - D同学维护]
│   └── utils/              # id.ts 等工具
├── modules/
│   ├── rendering/
│   │   └── CanvasArea.vue  🟢 [主战场：A潘 & B孙] 负责绘图和交互
│   └── ui/
│       └── components/
│           ├── ElementProperties.vue 🟢 [主战场：C余] 属性面板
│           └── FloatingToolbar.vue   🟢 [主战场：C余] 悬浮工具栏
└── App.vue                 🟢 [主战场：C余] 整体布局
👨‍💻 2. 分工接入指南
🎨 给 A同学 (潘) - 图形渲染
你的任务：在 src/modules/rendering/CanvasArea.vue 中，把 Store 里的数据画出来。

如何获取数据？ 不要自己定义数组，直接监听 Store 数据。

TypeScript

import { useCanvasStore } from '@/core/store/canvas'
import { storeToRefs } from 'pinia'

const canvasStore = useCanvasStore()
// elementsArray 是已经转好的数组，直接遍历渲染
const { elementsArray } = storeToRefs(canvasStore)
关于类型定义： 渲染不同图形时，请使用我定义好的类型，不要用 any。

TypeScript

import type { CanvasElement } from '@/core/types'

// 示例：判断类型渲染
if (element.type === 'rect') { ... }
else if (element.type === 'text') { ... }
🖱️ 给 B同学 (孙) - 交互功能
你的任务：在 src/modules/rendering/CanvasArea.vue 中，处理拖拽、缩放、选择。

点击选中： 在 PIXI 的事件里调用我的 selectElement 方法。

TypeScript

graphics.on('pointerdown', (e) => {
  e.stopPropagation()
  // id: 元素ID
  // e.shiftKey: 是否按住Shift (true=多选/反选, false=单选)
  canvasStore.selectElement(element.id, e.shiftKey)
})
拖拽性能关键点 (⚠️重要)：

拖拽中 (pointermove)：千万不要调用 Store 的 updateElement！ 这会导致每一帧都记录历史，卡死浏览器。请直接修改 PIXI 对象的 x, y。

松手时 (pointerup)：调用一次 Store 进行保存。

TypeScript

onDragEnd() {
  // 只有松手这一刻才存数据
  canvasStore.updateElement(currentId, { x: newX, y: newY })
}
工具状态： 判断当前是“选择模式”还是“画矩形模式”，请读取 appStore。

TypeScript

import { useAppStore } from '@/core/store/app'
const appStore = useAppStore()

if (appStore.currentTool === 'rect') { ... }
🧩 给 C同学 (余) - 界面组件
你的任务：完善 src/modules/ui/components/ 下的面板，绑定数据和操作。

1. 属性面板 (ElementProperties.vue)
获取选中元素：

TypeScript

const { singleSelectedElement } = storeToRefs(canvasStore)
// 如果 singleSelectedElement 为 null，说明没选中或选中了多个，面板应隐藏或置灰
修改属性： 监听表单变化，直接调用 update。

TypeScript

const onColorChange = (val) => {
  if(!singleSelectedElement.value) return
  canvasStore.updateElement(singleSelectedElement.value.id, {
    style: { ...singleSelectedElement.value.style, fill: val }
  })
}
2. 悬浮工具栏 (FloatingToolbar.vue)
图层控制： 直接绑定按钮点击。

TypeScript

<button @click="canvasStore.bringToFront()">置顶</button>
<button @click="canvasStore.sendToBack()">置底</button>
撤销重做：

TypeScript

<button @click="canvasStore.undo()" :disabled="!canvasStore.canUndo">撤销</button>
3. 全局快捷键 (App.vue 或 main.ts)
建议在根组件监听键盘事件，调用我的 API：

TypeScript

window.addEventListener('keydown', (e) => {
  if (e.key === 'Delete') canvasStore.deleteSelectedElements()
  if (e.ctrlKey && e.key === 'c') canvasStore.copySelectedElements()
  if (e.ctrlKey && e.key === 'v') canvasStore.pasteElements()
})
⚡️ 3. 常见问题 (FAQ)
“我怎么创建一个新矩形？”

❌ 错误：自己 new Element() 然后 push 到数组。

✅ 正确：canvasStore.addElement({ type: 'rect', x: 0, y: 0, width: 100, height: 100, style: {...} })。Store 会自动生成 ID、处理图层并记录历史。

“代码报错说属性不存在？”

请检查是否引入了类型定义。

import type { CanvasElement } from '@/core/types'。

“刷新页面数据没了？”

目前 MVP 阶段暂未开启 LocalStorage 持久化，这是正常的。等你们功能联调完，我一键开启即可。

“如何协作？”

A潘 & B孙：你们都在操作 CanvasArea.vue，建议 A 负责写 render 函数，B 负责写 event listeners，避免冲突。

C余：你的工作与他们解耦，只需关注 Store 的数据变化即可。
