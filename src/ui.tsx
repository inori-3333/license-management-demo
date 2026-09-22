import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type FormEvent,
} from 'react'
import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown, Inbox } from 'lucide-react'
import { split } from './model'
import { useLocation, useSearchParams } from 'react-router-dom'

type ListScroll = { top: number; tables: { key: string; top: number; left: number }[] }
const listScroll = new Map<string, ListScroll>()
export function useListContext(active: boolean) {
  const location = useLocation()
  const previousPath = useRef<string>()
  const returnTo = location.pathname + location.search
  useLayoutEffect(() => {
    const changedPage = previousPath.current !== location.pathname
    previousPath.current = location.pathname
    if (!active) {
      if (changedPage) window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    const saved = listScroll.get(returnTo)
    if (!saved) {
      if (changedPage) window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    const restore = () => {
      document.querySelectorAll<HTMLElement>('[data-table-key]').forEach((table) => {
        const position = saved.tables.find((p) => p.key === table.dataset.tableKey)
        if (position) {
          table.scrollTop = position.top
          table.scrollLeft = position.left
        }
      })
      window.scrollTo({ top: saved.top, behavior: 'instant' })
    }
    restore()
    // 表格溢出提示在布局测量后挂载，下一帧再恢复，避免被初始高度截短。
    const frame = requestAnimationFrame(() => {
      restore()
      listScroll.delete(returnTo)
    })
    return () => cancelAnimationFrame(frame)
  }, [active, returnTo])
  return {
    state: { returnTo },
    remember: () => {
      listScroll.set(returnTo, {
        top: window.scrollY,
        tables: Array.from(document.querySelectorAll<HTMLElement>('[data-table-key]')).map(
          (table) => ({
            key: table.dataset.tableKey!,
            top: table.scrollTop,
            left: table.scrollLeft,
          }),
        ),
      })
    },
    backTo:
      typeof location.state?.returnTo === 'string' &&
      /^\/people(?:\?|$)/.test(location.state.returnTo)
        ? location.state.returnTo
        : '/people',
  }
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} {...props} />
      {hint && <small>{hint}</small>}
    </label>
  )
}
export function ListField({
  label,
  values,
  onChange,
  hint,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  hint?: string
}) {
  const [text, setText] = useState(values.join('，')),
    focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(values.join('，'))
  }, [values.join('，')])
  return (
    <Field
      label={label}
      value={text}
      hint={hint}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={() => {
        focused.current = false
        setText(values.join('，'))
      }}
      onChange={(e) => {
        setText(e.target.value)
        onChange(split(e.target.value))
      }}
    />
  )
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} aria-label={label} {...props}>
        {children}
      </select>
    </label>
  )
}
export function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <textarea
        className="resize-none"
        id={id}
        style={{ resize: 'none' }}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>
}
export function Status({ value }: { value: string }) {
  const tone = /不合规|已过期|缺证|逾期|异常|未达标/.test(value)
    ? 'danger'
    : /合规|有效|已销项/.test(value)
      ? 'success'
      : /临期|提醒|过渡|整改|复核/.test(value)
        ? 'warning'
        : 'neutral'
  return <Badge tone={tone}>{value}</Badge>
}
export function Header({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  useEffect(() => {
    document.title = title + ' · 持证上岗统计分析系统'
  }, [title])
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  )
}
export function SearchField({
  value,
  onChange,
  placeholder = '搜索姓名、工号、岗位',
  autoFocus = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    if (!composing.current) setDraft(value)
  }, [value])
  return (
    <div className="search">
      <Search size={17} />
      <input
        ref={ref}
        autoFocus={autoFocus}
        data-dialog-autofocus={autoFocus || undefined}
        aria-label={placeholder}
        placeholder={placeholder}
        value={draft}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={(e) => {
          composing.current = false
          onChange(e.currentTarget.value)
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          if (!composing.current) onChange(e.target.value)
        }}
      />
      {draft && (
        <button
          type="button"
          className="icon-button"
          aria-label="清空搜索"
          onClick={() => {
            composing.current = false
            setDraft('')
            onChange('')
            ref.current?.focus()
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null),
    closeRef = useRef(onClose),
    id = useId()
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    ref.current?.showModal()
    ref.current?.querySelector<HTMLElement>('[data-dialog-autofocus]')?.focus()
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = old
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={'modal ' + (wide ? 'wide' : '')}
      onCancel={(e) => {
        e.preventDefault()
        closeRef.current()
      }}
    >
      <div className="modal-heading">
        <h2 id={id}>{title}</h2>
        <button className="icon-button" aria-label="关闭弹窗" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  )
}
export function BusinessForm({
  children,
  onSubmit,
  submitLabel = '保存',
  onCancel,
}: {
  children: ReactNode
  onSubmit: () => void
  submitLabel?: string
  onCancel: () => void
}) {
  const [error, setError] = useState(''),
    ref = useRef<HTMLFormElement>(null)
  function submit(e: FormEvent) {
    e.preventDefault()
    const invalid = ref.current?.querySelector<HTMLInputElement | HTMLSelectElement>(
      'input:invalid,select:invalid',
    )
    if (invalid) {
      setError('请检查必填项及日期、数值格式。')
      invalid.setAttribute('aria-invalid', 'true')
      invalid.setAttribute('aria-describedby', 'form-error')
      invalid.focus()
      return
    }
    try {
      onSubmit()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <form
      ref={ref}
      noValidate
      onSubmit={submit}
      onChange={() => {
        setError('')
        ref.current?.querySelectorAll('[aria-invalid]').forEach((e) => {
          e.removeAttribute('aria-invalid')
          e.removeAttribute('aria-describedby')
        })
      }}
    >
      {children}
      {error && (
        <p id="form-error" className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          取消
        </button>
        <button className="button primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string
  description: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{description}</p>
      <div className="form-actions">
        <button className="button secondary" autoFocus onClick={onClose}>
          取消
        </button>
        <button
          className="button danger"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {title}
        </button>
      </div>
    </Modal>
  )
}
export function Empty({
  text = '暂无匹配结果',
  hint = '调整筛选条件，或添加一条记录。',
}: {
  text?: string
  hint?: string
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <strong>{text}</strong>
      <p>{hint}</p>
    </div>
  )
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; count?: number }[]
  value: string
  onChange: (s: string) => void
}) {
  return (
    <div className="tabs" role="group" aria-label="切换视图">
      {items.map((t) => (
        <button
          key={t.id}
          aria-pressed={value === t.id}
          className={value === t.id ? 'active' : ''}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && <span>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
export type Column<T> = {
  key: string
  label: string
  render?: (row: T) => ReactNode
  value?: (row: T) => string | number
  pin?: 'start' | 'end'
}
export function Table<T>({
  rows,
  columns,
  rowKey,
  emptyText,
  pageKey = 'page',
  mobileRender,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (r: T) => string
  emptyText?: string
  pageKey?: string
  mobileRender?: (row: T) => ReactNode
}) {
  const [params, setParams] = useSearchParams()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  useLayoutEffect(() => {
    const node = scrollRef.current!
    const update = () =>
      setOverflowing(node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1)
    const observer = new ResizeObserver(update)
    observer.observe(node)
    if (node.firstElementChild) observer.observe(node.firstElementChild)
    update()
    return () => observer.disconnect()
  }, [])
  const size = Number(params.get(pageKey + 'Size')) || 20
  const page = Math.max(
    1,
    Math.min(Number(params.get(pageKey)) || 1, Math.ceil(rows.length / size) || 1),
  )
  const sort = params.get(pageKey + 'Sort') || '',
    reverse = params.get(pageKey + 'Dir') === 'desc'
  const column = columns.find((c) => c.key === sort)
  const sorted = column?.value
    ? [...rows].sort((a, b) => {
        const av = column.value!(a),
          bv = column.value!(b)
        return (
          (typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv), 'zh-CN')) * (reverse ? -1 : 1)
        )
      })
    : rows
  const change = (k: string, v: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set(k, v)
        if (k === pageKey + 'Size') p.set(pageKey, '1')
        return p
      },
      { replace: true },
    )
  return (
    <div className={'table-panel' + (mobileRender ? ' has-mobile-cards' : '')}>
      {overflowing && (
        <div className="table-scroll-hint">
          <ChevronLeft size={14} /> 横向滚动查看全部字段 <ChevronRight size={14} />
        </div>
      )}
      <div
        ref={scrollRef}
        className="table-scroll"
        data-table-key={pageKey}
        tabIndex={0}
        role="region"
        aria-label="数据表格，可滚动查看"
      >
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={c.pin ? 'pinned-' + c.pin : undefined}
                  aria-sort={sort === c.key ? (reverse ? 'descending' : 'ascending') : undefined}
                >
                  {c.value ? (
                    <button
                      onClick={() => {
                        setParams(
                          (prev) => {
                            const p = new URLSearchParams(prev)
                            p.set(pageKey + 'Sort', c.key)
                            p.set(pageKey + 'Dir', sort === c.key && !reverse ? 'desc' : 'asc')
                            return p
                          },
                          { replace: true },
                        )
                      }}
                    >
                      {c.label}
                      <ArrowUpDown size={12} />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice((page - 1) * size, page * size).map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.pin ? 'pinned-' + c.pin : undefined}>
                    {c.render ? c.render(r) : String(c.value?.(r) ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text={emptyText} />}
      </div>
      {mobileRender && (
        <div className="table-mobile-list">
          <div className="mobile-sort">
            <Select
              label="排序依据"
              value={sort}
              onChange={(e) => change(pageKey + 'Sort', e.target.value)}
            >
              <option value="">默认顺序</option>
              {columns
                .filter((c) => c.value)
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
            </Select>
            <button
              className="button secondary"
              disabled={!sort}
              onClick={() => change(pageKey + 'Dir', reverse ? 'asc' : 'desc')}
            >
              <ArrowUpDown size={14} />
              {reverse ? '降序' : '升序'}
            </button>
          </div>
          {sorted.slice((page - 1) * size, page * size).map((row) => (
            <article className="mobile-record" key={rowKey(row)}>
              {mobileRender(row)}
            </article>
          ))}
          {!rows.length && <Empty text={emptyText} />}
        </div>
      )}
      <div className="pagination">
        <span>
          共 {rows.length.toLocaleString('zh-CN')} 条
          {rows.length > 0
            ? ' · ' + ((page - 1) * size + 1) + '–' + Math.min(page * size, rows.length)
            : ''}
        </span>
        <div>
          <label>
            每页{' '}
            <select
              aria-label="每页条数"
              value={size}
              onChange={(e) => change(pageKey + 'Size', e.target.value)}
            >
              {[10, 20, 50].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>{' '}
            条
          </label>
          <button
            className="icon-button"
            aria-label="上一页"
            disabled={page === 1}
            onClick={() => change(pageKey, String(page - 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {page} / {Math.ceil(rows.length / size) || 1}
          </span>
          <button
            className="icon-button"
            aria-label="下一页"
            disabled={page * size >= rows.length}
            onClick={() => change(pageKey, String(page + 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
export function useFilters(defaults: Record<string, string> = {}) {
  const [params, setParams] = useSearchParams()
  const get = (key: string) => params.get(key) || defaults[key] || ''
  const set = (key: string, value: string) =>
    setParams(
      (previous) => {
        const p = new URLSearchParams(previous)
        if (value) p.set(key, value)
        else p.delete(key)
        p.delete('page')
        return p
      },
      { replace: true },
    )
  return { get, set }
}
export function CompanyFilter({
  companies,
  value,
  onChange,
}: {
  companies: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Select label="所属公司" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">全部公司</option>
      {companies.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </Select>
  )
}
