import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { evaluate, syncIssues } from './engine'
import { makeSeed } from './seed'
import type { DB, Evaluation } from './model'
export const STORAGE_KEY = 'license-management-demo.v1'
type Store = {
  db: DB
  result: Evaluation
  update: (fn: (db: DB) => DB, message?: string) => void
  reset: () => void
  notify: (message: string) => void
}
const Context = createContext<Store>(null!)
export function Provider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const initial = saved ? (JSON.parse(saved) as DB) : makeSeed()
    return syncIssues(initial, evaluate(initial))
  })
  const [message, setMessage] = useState('')
  const result = useMemo(() => evaluate(db), [db])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  }, [db])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])
  const update = (fn: (db: DB) => DB, text = '已保存，统计已更新') => {
    setDb((previous) => {
      const next = fn(structuredClone(previous))
      return syncIssues(next, evaluate(next))
    })
    setMessage(text)
  }
  const reset = () => update(() => makeSeed(), '已恢复初始演示数据')
  return (
    <Context.Provider value={{ db, result, update, reset, notify: setMessage }}>
      {children}
      <div className={'toast ' + (message ? 'show' : '')} role="status" aria-live="polite">
        {message}
      </div>
    </Context.Provider>
  )
}
export const useStore = () => useContext(Context)
