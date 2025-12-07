/**
 * 将 File 对象转换为 Base64 字符串
 * @param file 用户上传的文件对象
 * @returns 包含文件内容的 Base64 字符串的 Promise
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    // 转换完成后的回调
    reader.onload = () => {
      resolve(reader.result as string)
    }

    // 出错的回调
    reader.onerror = (error) => {
      reject(error)
    }

    // 开始读取文件并转为 DataURL (即 Base64)
    reader.readAsDataURL(file)
  })
}

