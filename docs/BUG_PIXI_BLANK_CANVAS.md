# PIXI 画布空白 Bug 记录

## 现象

- TypeScript 类型检查通过，无编译错误
- 浏览器控制台无任何报错
- PIXI Application 初始化成功，canvas 尺寸正常（如 1046 x 438）
- Store 数据正常加载（IndexedDB 读取成功，元素数据存在）
- `renderAllElements` 正常执行，stage.children 数量正确
- **但画布上纯白/纯灰，看不到任何图形**

## 原因

Vue 的 DOM 协调机制与手动 DOM 操作冲突。

**原始代码**（正常工作）：

```html
<!-- 模板中 div 内无任何 Vue 子元素 -->
<div ref="canvasContainer" class="canvas-container"></div>
```

```ts
// JS 中手动添加 PIXI canvas
container.appendChild(pixiApp.canvas)
```

此时 div 的 VNode 树为空，Vue 不做子节点对比，手动添加的 PIXI canvas 不受影响。

**改动后代码**（画布空白）：

```html
<!-- 模板中 div 内有了 Vue 管理的子元素 -->
<div ref="canvasContainer" class="canvas-container">
    <TextEditOverlay v-if="editingElement" ... />
    <div class="viewport-indicator">...</div>
</div>
```

```ts
// JS 中仍然手动添加 PIXI canvas
container.appendChild(pixiApp.canvas)
```

此时 div 的 VNode 树包含 TextEditOverlay 和 viewport-indicator。当 Vue 因响应式数据变化（如 elements 更新）触发 DOM 协调时，会对比 VNode 树和实际 DOM：

1. VNode 期望的子元素：TextEditOverlay（条件渲染）+ viewport-indicator
2. 实际 DOM 的子元素：PIXI canvas + TextEditOverlay + viewport-indicator

Vue 发现 PIXI canvas 不在 VNode 树中，将其视为「多余节点」并从 DOM 中移除。canvas 一旦被移出 DOM，PIXI 的 WebGL 渲染上下文即失效，画布变为空白。

## 解决方案

在 Vue 模板中显式声明 `<canvas>` 元素，让 Vue 管理其生命周期，然后将这个 canvas 传给 PIXI 使用。

**模板**：

```html
<div class="canvas-wrapper">
    <canvas ref="canvasRef" class="pixi-canvas"></canvas>
    <TextEditOverlay v-if="editingElement" ... />
    <div class="viewport-indicator">...</div>
</div>
```

**初始化代码**：

```ts
const canvasRef = ref<HTMLCanvasElement>()

const initPixi = async () => {
  await nextTick()
  const canvas = canvasRef.value
  if (!canvas) return

  const pixiApp = new PIXI.Application()
  await pixiApp.init({
    canvas,  // 关键：把 Vue 管理的 canvas 传给 PIXI
    width: canvas.parentElement!.clientWidth,
    height: canvas.parentElement!.clientHeight,
    // ...
  })

  app = pixiApp
}
```

这样 Vue 知道 canvas 的存在，不会在 DOM 协调时移除它，PIXI 也能正常渲染到这个 canvas 上。

## 教训

在 Vue 组件中使用 PIXI 或其他需要手动操作 DOM 的库时：

1. **避免在 Vue 管理的容器内手动 append DOM 元素**。Vue 的 DOM 协调会移除它不认识的节点。
2. **优先让 Vue 管理 canvas 元素**。用 `<canvas ref="...">` 在模板中声明，传给库使用。
3. 如果必须在 Vue 容器外创建元素，使用 `document.createElement` 并挂载到 Vue 根节点之外，确保 Vue 完全不知道它的存在。
