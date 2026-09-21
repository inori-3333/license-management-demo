import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { evaluate, syncIssues } from './engine'
import { makeSeed } from './seed'
import { isDemoSession, setDemoSession } from './demo/runtime'
import type { DB, Evaluation } from './model'
export const STORAGE_KEY = 'license-management-demo.v1'
type Store = {
  db: DB
  demoActive: boolean
  beginDemo: () => void
  endDemo: () => void
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
  const [demoDb, setDemoDb] = useState<DB | null>(null)
  const currentDb = demoDb || db
  const demoActive = demoDb !== null
  const beginDemo = useCallback(() => {
    setDemoSession(true)
    const seed = makeSeed()
    setDemoDb(syncIssues(seed, evaluate(seed)))
    setMessage('')
  }, [])
  const endDemo = useCallback(() => {
    setDemoSession(false)
    setDemoDb(null)
    setMessage('')
  }, [])
  const [message, setMessage] = useState('')
  const result = useMemo(() => evaluate(currentDb), [currentDb])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  }, [db])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])
  const update = (fn: (db: DB) => DB, text = '已保存，统计已更新') => {
    const apply = (previous: DB) => {
      const next = fn(structuredClone(previous))
      return syncIssues(next, evaluate(next))
    }
    if (isDemoSession()) setDemoDb((previous) => (previous ? apply(previous) : previous))
    else setDb(apply)
    setMessage(text)
  }
  const reset = () => update(() => makeSeed(), '已恢复初始演示数据')
  return (
    <Context.Provider
      value={{
        db: currentDb,
        demoActive,
        beginDemo,
        endDemo,
        result,
        update,
        reset,
        notify: setMessage,
      }}
    >
      {children}
      <div className={'toast ' + (message ? 'show' : '')} role="status" aria-live="polite">
        {message}
      </div>
    </Context.Provider>
  )
}
export const useStore = () => useContext(Context)
