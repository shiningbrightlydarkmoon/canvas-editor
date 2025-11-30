// 复制粘贴功能
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CanvasElement } from '@/core/types'
import { generateId, deepClone } from '@/lib/utils/id'
import { EventBus } from '@/core/events/EventBus'

export const useClipboardStore = defineStore('clipboard', () => {
  // 状态定义
  const clipboardData = ref<CanvasElement[]>([])
  const lastAction = ref<'copy' | 'cut' | null>(null)
  const pasteCount = ref(0)

  // 复制选中元素
  const copy = (elements: CanvasElement[]) => {
    if (elements.length === 0) return false

    // 重置粘贴计数，这样新复制的一组元素会从头开始偏移
    pasteCount.value = 0

    // 深拷贝并生成新ID
    clipboardData.value = elements.map(element => ({
      ...deepClone(element),
      id: generateId(),
      x: element.x + 20, // 粘贴时偏移，避免重叠
      y: element.y + 20,
      isSelected: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))

    lastAction.value = 'copy'

    EventBus.emit('clipboard:copied', {
      elementCount: elements.length
    })

    return true
  }

  // 剪切选中元素
  const cut = (elements: CanvasElement[]) => {
    if (elements.length === 0) return false

    // 先复制到剪贴板
    copy(elements)
    lastAction.value = 'cut'

    EventBus.emit('clipboard:cut', {
      elementCount: elements.length,
      elementIds: elements.map(el => el.id)
    })

    return true
  }

  // 粘贴元素
  const paste = () => {
    if (clipboardData.value.length === 0) return []

    pasteCount.value++ // 每次粘贴计数 +1
    const offset = pasteCount.value * 20 // 每次偏移 20px

    // 创建新的元素实例
    const pastedElements = clipboardData.value.map(element => ({
      ...deepClone(element),
      id: generateId(), // 新ID
      x: element.x + offset,
      y: element.y + offset,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))

    EventBus.emit('clipboard:pasted', {
      elements: pastedElements
    })

    return pastedElements
  }

  // 检查剪贴板是否有数据
  const hasData = () => clipboardData.value.length > 0

  // 清空剪贴板
  const clear = () => {
    clipboardData.value = []
    lastAction.value = null
  }

  return {
    // 状态
    hasData,

    // 方法
    copy,
    cut,
    paste,
    clear
  }
})
