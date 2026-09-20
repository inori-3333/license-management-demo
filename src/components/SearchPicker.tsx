import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Empty, Modal, SearchField, Select } from '../ui'

type Option = { id: string; label: string; group: string }

export function SearchPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.id === value)
  return (
    <div className="search-picker">
      <span className="picker-label">{label}</span>
      <button
        className="picker-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>{selected ? `${selected.label} · ${selected.group}` : '选择岗位'}</span>
        <ChevronDown size={17} />
      </button>
      <small>搜索岗位名称，或按专业筛选</small>
      {open && (
        <PickerDialog
          label={label}
          value={value}
          options={options}
          onClose={() => setOpen(false)}
          onChange={(id) => {
            onChange(id)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function PickerDialog({
  label,
  value,
  options,
  onChange,
  onClose,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [limit, setLimit] = useState(40)
  const groups = [...new Set(options.map((option) => option.group))].sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  )
  const filtered = options
    .filter(
      (option) =>
        (!group || option.group === group) &&
        (!query.trim() ||
          `${option.label} ${option.group}`
            .toLocaleLowerCase('zh-CN')
            .includes(query.trim().toLocaleLowerCase('zh-CN'))),
    )
    .sort(
      (a, b) => a.group.localeCompare(b.group, 'zh-CN') || a.label.localeCompare(b.label, 'zh-CN'),
    )
  const visible = filtered.slice(0, limit)
  return (
    <Modal title={label} onClose={onClose}>
      <div className="picker-controls">
        <SearchField
          autoFocus
          placeholder="搜索岗位名称或专业"
          value={query}
          onChange={(v) => {
            setQuery(v)
            setLimit(40)
          }}
        />
        <Select
          label="按专业筛选岗位"
          value={group}
          onChange={(e) => {
            setGroup(e.target.value)
            setLimit(40)
          }}
        >
          <option value="">全部专业</option>
          {groups.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
      </div>
      <p className="muted picker-count" role="status">
        找到 {filtered.length} 个岗位{filtered.length > limit ? `，已显示 ${limit} 个` : ''}
      </p>
      <div className="picker-results">
        {groups
          .filter((g) => visible.some((o) => o.group === g))
          .map((g) => (
            <section className="picker-group" key={g}>
              <h3>{g}</h3>
              <ul>
                {visible
                  .filter((o) => o.group === g)
                  .map((option) => (
                    <li key={option.id}>
                      <button
                        className="picker-option"
                        aria-pressed={option.id === value}
                        onClick={() => onChange(option.id)}
                      >
                        <span>{option.label}</span>
                        {option.id === value && (
                          <span className="picker-selected">
                            <Check size={16} />
                            已选
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        {!filtered.length && (
          <Empty text="没有找到对应岗位" hint="换个岗位关键词，或选择其他专业。" />
        )}
        {filtered.length > limit && (
          <button className="button secondary picker-more" onClick={() => setLimit(limit + 40)}>
            再显示 40 个岗位
          </button>
        )}
      </div>
      <div className="form-actions">
        <button className="button secondary" onClick={onClose}>
          取消选择
        </button>
      </div>
    </Modal>
  )
}
