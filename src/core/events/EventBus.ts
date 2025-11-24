// 使用泛型来避免 any 类型
type EventCallback<T = unknown> = (data?: T) => void

export const EventBus = {
  events: {} as Record<string, EventCallback<unknown>[]>,

  on<T = unknown>(event: string, callback: EventCallback<T>) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback as EventCallback<unknown>)
  },

  off<T = unknown>(event: string, callback: EventCallback<T>) {
    if (!this.events[event]) return

    this.events[event] = this.events[event].filter(cb => cb !== callback)
  },

  emit<T = unknown>(event: string, data?: T) {
    this.events[event]?.forEach(cb => {
      try {
        cb(data)
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error)
      }
    })
  },

  once<T = unknown>(event: string, callback: EventCallback<T>) {
    const onceHandler = (data?: T) => {
      callback(data)
      this.off(event, onceHandler)
    }
    this.on(event, onceHandler)
  }
}

export const CANVAS_EVENTS = {
  // 元素事件
  ELEMENT_ADDED: 'element:added',
  ELEMENT_UPDATED: 'element:updated',
  ELEMENT_DELETED: 'element:deleted',
  ELEMENT_SELECTED: 'element:selected',
  ELEMENTS_MOVED: 'elements:moved',
  ELEMENTS_RESIZED: 'elements:resized',
  ELEMENT_DOUBLE_CLICKED: 'element:double-clicked',

  // 画布事件
  VIEWPORT_CHANGED: 'viewport:changed',
  CANVAS_CLICKED: 'canvas:clicked',
  CANVAS_RESIZED: 'canvas:resized',

  // 工具事件
  TOOL_CHANGED: 'tool:changed',
  TOOL_ACTIVATED: 'tool:activated',

  // 选择事件
  SELECTION_CHANGED: 'selection:changed',
  SELECTION_CLEARED: 'selection:cleared',

  // 历史事件
  HISTORY_CHANGED: 'history:changed',
  HISTORY_RECORD_ADDED: 'history:record-added',

  // 数据事件
  DATA_SAVED: 'data:saved',
  DATA_LOADED: 'data:loaded',
  DATA_CLEARED: 'data:cleared',

  // 渲染事件
  RENDER_REQUESTED: 'render:requested',
  RENDER_COMPLETED: 'render:completed',

  // 键盘事件
  KEY_DOWN: 'key:down',
  KEY_UP: 'key:up'
} as const
