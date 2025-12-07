import { onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '@/core/store/canvas'

export const useShortcuts = () => {
  const canvasStore = useCanvasStore()

  const handleKeydown = (e: KeyboardEvent) => {
    // 🛡️ 1. 防误触：如果在输入框里打字，别触发快捷键
    const target = e.target as HTMLElement
    if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return

    // ⌨️ 2. 统一处理 Ctrl (Windows) 和 Command (Mac)
    const isCtrl = e.ctrlKey || e.metaKey

    switch (e.key.toLowerCase()) {
      case 'delete':
      case 'backspace':
        canvasStore.deleteSelectedElements()
        break

      case 'a': // 全选
        if (isCtrl) {
          e.preventDefault()
          const allIds = canvasStore.getAllElements().map(el => el.id)
          canvasStore.selectMultiple(allIds)
        }
        break

      case 'c': // 复制
        if (isCtrl) canvasStore.copySelectedElements()
        break

      case 'x': // 剪切
        if (isCtrl) canvasStore.cutSelectedElements()
        break

      case 'v': // 粘贴
        if (isCtrl) canvasStore.pasteElements()
        break

      case 'z': // 撤销 / 重做 (Ctrl+Shift+Z)
        if (isCtrl) {
          e.preventDefault()
          if (e.shiftKey) {
            canvasStore.redo()
          } else {
            canvasStore.undo()
          }
        }
        break

      case 'y': // 重做 (Ctrl+Y)
        if (isCtrl) {
          e.preventDefault()
          canvasStore.redo()
        }
        break

      case 's': // 阻止默认保存
        if (isCtrl) e.preventDefault()
        break
    }
  }

  // 3. 挂载与卸载
  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}
