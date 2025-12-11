import { onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '@/core/store/canvas'

export const useShortcuts = () => {
  const canvasStore = useCanvasStore()

  const handleKeydown = (e: KeyboardEvent) => {
    // 防误触：如果在输入框里打字，别触发快捷键
    const target = e.target as HTMLElement
    if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return

    // 统一处理 Ctrl (Windows) 和 Command (Mac)
    const isCtrl = e.ctrlKey || e.metaKey

    switch (e.key.toLowerCase()) {
      // 删除功能
      case 'delete':
      case 'backspace':
        canvasStore.deleteSelectedElements()
        break

      // 全选
      case 'a':
        if (isCtrl) {
          e.preventDefault()
          // 获取所有元素 ID 并全选
          const allIds = canvasStore.getAllElements().map(el => el.id)
          canvasStore.selectMultiple(allIds)
        }
        break

      // 复制
      case 'c':
        if (isCtrl) canvasStore.copySelectedElements()
        break

      // 剪切
      case 'x':
        if (isCtrl) canvasStore.cutSelectedElements()
        break

      // 粘贴
      case 'v':
        if (isCtrl) canvasStore.pasteElements()
        break

      // 撤销与重做
      case 'z':
        if (isCtrl) {
          e.preventDefault() // 阻止默认浏览器行为
          if (e.shiftKey) {
            // 如果同时按住了 Shift (Ctrl + Shift + Z)，则是"重做"
            canvasStore.redo()
          } else {
            // 否则是普通的"撤销"
            canvasStore.undo()
          }
        }
        break


      // 重做 (Ctrl+Y)
      case 'y':
        if (isCtrl) {
          e.preventDefault()
          canvasStore.redo()
        }
        break

      // 保存 (Ctrl+S)
      // 注意：通常浏览器会拦截 Ctrl+S 来触发保存页面，这里我们阻止默认行为
      case 's':
        if (isCtrl) e.preventDefault()
        break
    }
  }

  // 挂载与卸载
  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}
