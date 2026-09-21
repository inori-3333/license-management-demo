import 'react'
// React 18 的类型声明早于浏览器 Popover API。
declare module 'react' {
  interface HTMLAttributes<T> {
    popover?: 'manual' | 'auto'
  }
}
