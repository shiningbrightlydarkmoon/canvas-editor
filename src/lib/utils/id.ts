// 工具函数
/**
 * 生成唯一ID
 *  格式: el_时间戳_随机数
 */
let idCounter = 0 // 静态计数器

export const generateId = (): string => {
  idCounter = (idCounter + 1) % 1000 // 循环防止溢出
  return `el_${Date.now()}_${idCounter}_${Math.random().toString(36).substring(2, 6)}`
}

/**
 * 生成历史记录ID
 */
export const generateHistoryId = (): string => {
  return `hist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 防抖函数
 * 使用泛型 Args 捕获参数类型，避免使用 any
 */
// <Args extends unknown[]>: 这表示 Args 是一个数组类型（参数列表本质上是元组），但我们不限制数组里具体存什么,可以通过Lint检查
export const debounce = <Args extends unknown[]>(
  func: (...args: Args) => unknown, // 允许函数返回任何值（包括 Promise）
  wait: number
): ((...args: Args) => void) => {
  let timeout: ReturnType<typeof setTimeout> | undefined

  return (...args: Args) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param limit  时间限制
 * @returns 节流后的函数
 */
export const throttle = <T extends (...args: unknown[]) => void>(
  func: T,
  limit: number,
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 深拷贝
 * 递归复制对象的所有属性，包括嵌套对象和数组
 * @param obj  要拷贝的对象
 * @returns 深拷贝后的新对象
 */
export const deepClone = <T>(obj: T): T => {
  // 基本类型和null直接返回
  if (obj === null || typeof obj !== 'object') return obj
  // 处理Date对象
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  // 处理数组
  if (obj instanceof Array) return obj.map((item) => deepClone(item)) as unknown as T
  // 处理普通对象
  const cloned = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  return cloned
}

/**
 * 生成随机颜色
 * @returns 随机颜色的十六进制字符串
 */
export const generateRandomColor = (): string => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// export const generateRandomColor = (): string => {
//   return `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`;
// }

