import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { HistoryRecord, CanvasElement } from '@/core/types'
import { generateHistoryId, deepClone } from '@/lib/utils/id'

// 创建一条历史记录
const createRecord = (
  description: string,
  state: Record<string, CanvasElement>,
  type: HistoryRecord['type'],
): HistoryRecord => ({
  id: generateHistoryId(),
  timestamp: Date.now(),
  description,
  state,
  type,
})

/**
 * 撤销/重做：全量快照 + 状态序列（0 基）。
 *
 * records[0] 是「初始状态」——任何操作都还没发生时画布的样子；
 * records[i] 是第 i 次操作之后的状态。
 * 于是 N 次操作只占 N + 1 份快照，而「prevState + nextState 各存一份」要 2N 份。
 *
 * 相比 -1 基方案，这里不需要额外的 initialState 变量：
 * 初始态就是 records[0]，裁剪时 shift() 之后新的 records[0] 天然就是正确基线。
 */
export const useHistoryStore = defineStore('history', () => {
  const maxHistorySize = 50 // 最多保留 50 次操作（外加 1 条初始状态）

  // 历史记录：records[0] 是初始状态，records[i] 是第 i 次操作之后
  const records = ref<HistoryRecord[]>([createRecord('初始状态', {}, 'init')])
  // 当前停在 records 的哪一项：0 = 初始态，i = 第 i 次操作之后
  const currentIndex = ref(0)

  const canUndo = computed(() => currentIndex.value > 0)
  const canRedo = computed(() => currentIndex.value < records.value.length - 1)
  // 可撤销的操作步数（不含那条初始状态）
  const historyCount = computed(() => records.value.length - 1)

  // 建立初始基线并清空历史。应在「画布数据加载完成」之后调用一次。
  const setInitialState = (state: Record<string, CanvasElement>) => {
    // 必须克隆：调用方传进来的通常是 elements.value，之后还会继续被修改
    records.value = [createRecord('初始状态', deepClone(state), 'init')]
    currentIndex.value = 0
  }

  // 提交一次新状态
  const pushHistory = (
    description: string,
    nextState: Record<string, CanvasElement>,
    type: HistoryRecord['type'], // 操作类型（init/add/update/delete...）
  ) => {
    // 当前不在末尾，说明用户撤销过，需要截断「未来」的分支，保证历史是线性的
    if (currentIndex.value < records.value.length - 1) {
      records.value = records.value.slice(0, currentIndex.value + 1)
    }

    // nextState 传的是 elements.value 的引用，调用方之后还会继续改它，
    // 所以这里必须克隆，否则快照会跟着后续修改一起变。
    records.value.push(createRecord(description, deepClone(nextState), type))

    // 上限是「1 条初始状态 + 50 次操作 = 51 条」。
    // shift() 掉最老的一条后，新的 records[0] 自动就是新的基线，无需额外同步。
    if (records.value.length > maxHistorySize + 1) {
      records.value.shift()
    }

    currentIndex.value = records.value.length - 1
  }

  // 撤销：索引前移一位，返回那个位置的状态。
  // 调用方必须 deepClone 之后再赋给 elements，否则 elements 会和历史快照变成
  // 同一个对象，后续修改会把历史也改掉。
  const undo = () => {
    if (!canUndo.value) return null

    currentIndex.value--
    return records.value[currentIndex.value]?.state ?? null
  }

  // 重做：索引后移一位，返回那个位置的状态
  const redo = () => {
    if (!canRedo.value) return null

    currentIndex.value++
    return records.value[currentIndex.value]?.state ?? null
  }

  // 清空历史：以当前状态作为新基线，画布内容不丢
  const clearHistory = () => {
    const current = records.value[currentIndex.value]?.state ?? {}
    setInitialState(current)
  }

  return {
    canUndo,
    canRedo,
    historyCount,
    records,
    currentIndex,
    setInitialState,
    pushHistory,
    undo,
    redo,
    clearHistory,
  }
})
