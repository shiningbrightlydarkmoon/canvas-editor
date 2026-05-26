# Bug 记录与修复

## 1. PIXI 画布空白

**现象**：TS 编译通过、PIXI 初始化成功、元素数据存在、stage.children 数量正确，但画布纯白/纯灰，看不到任何图形。

**原因**：Vue DOM 协调与手动 DOM 操作冲突。原始模板 `<div ref="container">` 内无 Vue 子元素，手动 `appendChild(pixi.canvas)` 不受影响。添加 TextEditOverlay 和 viewport-indicator 作为 Vue 子元素后，Vue 在响应式更新时对比 VNode 树和实际 DOM，发现 PIXI canvas 不在 VNode 树中，将其移除。

**修复**：在 Vue 模板中显式声明 `<canvas ref="canvasRef">`，通过 `app.init({ canvas: canvasRef.value })` 传给 PIXI。Vue 管理 canvas 生命周期，不会移除它。

**文件**：[src/modules/rendering/CanvasArea.vue](../src/modules/rendering/CanvasArea.vue)

---

## 2. 锁定元素无法解锁

**现象**：勾选「锁定元素」后，再取消勾选，元素仍处于锁定状态——拖不动、删不掉。

**原因**：`canvasStore.updateElement()` 在开头检查 `if (existingElement.isLocked) return false`，而解锁操作本身也是 `updateElement({ isLocked: false })`。当元素已锁定时，`isLocked` 为 `true`，更新直接被拒绝。

**修复**：改为 `if (existingElement.isLocked && updates.isLocked !== false) return false`，允许 `isLocked: false` 的更新穿透。

**文件**：[src/core/store/canvas.ts](../src/core/store/canvas.ts)

---

## 3. 粘贴元素继承锁定状态

**现象**：复制粘贴一个锁定元素，粘贴出的新元素也是锁定状态，无法直接操作。

**原因**：剪贴板 `copy()` 函数通过 `deepClone(element)` 克隆了所有属性，包括 `isLocked: true`，但没有显式重置。

**修复**：在复制的元素上添加 `isLocked: false` 覆盖（与已有的 `isSelected: false` 同理），粘贴出的元素始终默认可编辑。

**文件**：[src/core/store/clipboard.ts](../src/core/store/clipboard.ts)

---

## 4. 切换元素后属性面板不同步

**现象**：选中元素 A（已锁定）→ 属性面板勾选框显示锁定 → 点击元素 B（未锁定）→ 勾选框仍显示锁定状态。

**原因**：`ElementProperties.vue` 的 `localLocked` 等本地 ref 仅在组件初始化时从 `props.element` 取值，当选中元素变化时未同步更新。

**修复**：添加 `watch(() => props.element.id, () => { ... })`，在元素切换时同步所有本地 ref。

**文件**：[src/modules/ui/components/ElementProperties.vue](../src/modules/ui/components/ElementProperties.vue)

---

## 5. 旋转绕左上角而非中心

**现象**：元素旋转时绕左上角旋转，预期应绕元素中心旋转。

**原因**：PIXI Container 默认 `pivot` 为 `(0, 0)`（容器坐标原点，即左上角），旋转和缩放都围绕 pivot 进行。`container.x/y` 存储的是 pivot 在父坐标系中的位置，默认即左上角。

**修复**：
- `renderElement` 中设置 `container.pivot.set(width/2, height/2)` 并将 `container.x/y` 调整为元素中心
- 所有交互代码（拖拽、缩放、提交）同步做 center ↔ top-left 坐标转换：
  - 渲染时：`container.x = el.x + el.width / 2`
  - 提交时：`store.updateElement(id, { x: container.x - el.width / 2 })`

**文件**：[src/modules/rendering/CanvasArea.vue](../src/modules/rendering/CanvasArea.vue)

---

## 6. 上传图片显示为黑色方块

**现象**：通过侧边栏上传 PNG/JPEG 后，画布上显示黑色矩形而非实际图片。控制台出现 `PixiJS Warning: [Assets] Asset id data:image/png;base64,... was not found in the Cache`。

**原因**：PIXI v8 的 Assets 系统对超长 base64 Data URL 支持不稳定。`PIXI.Texture.from(dataUrl)` 会走 Assets 缓存系统，缓存未命中后无法正确加载 Data URL，导致纹理为空 → 渲染为黑色。

**修复**：绕过 PIXI Assets 系统，直接用浏览器原生 `new Image()` 加载 Data URL（对 Data URL 同步加载），加载完成后通过 `PIXI.Texture.from(img)` 创建纹理赋给 Sprite。初始展示白色占位纹理。

**文件**：[src/modules/rendering/CanvasArea.vue](../src/modules/rendering/CanvasArea.vue)

---

## 7. 拖出画布松手位置丢失

**现象**：拖拽元素到画布外松手，元素弹回原位。

**原因**：`pointerupoutside` 事件直接设置 `dragState.active = false`，未调用 `commitInteraction()` 提交最终位置。

**修复**：将拖拽/缩放/旋转的提交逻辑抽取为 `commitInteraction()` 函数，在 `pointerup` 和 `pointerupoutside` 中均调用。

**文件**：[src/modules/rendering/CanvasArea.vue](../src/modules/rendering/CanvasArea.vue)
