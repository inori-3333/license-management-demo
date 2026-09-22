import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Upload, Check, ArrowRight } from 'lucide-react'
import { useStore } from '../store'
import {
  applyImport,
  exportTable,
  fields,
  mapRows,
  previewImport,
  readSheet,
  type ImportKind,
} from '../io'
import { canonical } from '../engine'
import { uid } from '../model'
import { Badge, Field, Header, SearchField, Select, Table, Tabs, useFilters } from '../ui'
const suggestions: Record<string, string> = {
  电修技术员: '电气检修技术员',
  电气检修: '电气检修技术员',
  电修班: '电气检修班',
  注安师: '注册安全工程师证',
  注安: '注册安全工程师证',
  注册安全工程师: '注册安全工程师证',
  生技部: '生产技术部',
  财务资产部: '财务部',
}
function distance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
  return rows[a.length][b.length]
}
export default function Data() {
  const { db, update, notify } = useStore(),
    f = useFilters({ tab: 'import' })
  const [kind, setKind] = useState<ImportKind>('people'),
    [headers, setHeaders] = useState<string[]>([]),
    [rows, setRows] = useState<string[][]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [fileName, setFileName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [applied, setApplied] = useState(false)
  const [nameKind, setNameKind] = useState<'job' | 'cert' | 'department'>('job'),
    [raw, setRaw] = useState(''),
    [standard, setStandard] = useState('')
  const preview = useMemo(
    () => previewImport(db, kind, mapRows(rows, headers, mapping)),
    [db, kind, rows, headers, mapping],
  )
  const counts = {
    new: preview.filter((p) => p.action === '新增').length,
    update: preview.filter((p) => p.action === '更新').length,
    invalid: preview.filter((p) => p.action === '待修正').length,
    existing: preview.filter((p) => p.action === '已存在').length,
  }
  const rawNames = [
    ...new Set(
      nameKind === 'cert'
        ? db.credentials.map((c) => c.rawName)
        : db.people.flatMap((p) =>
            p.assignments.map((a) => (nameKind === 'job' ? a.job : a.department)),
          ),
    ),
  ].filter(Boolean)
  const standardNames = [
    ...new Set(
      nameKind === 'cert'
        ? db.certTypes.map((c) => c.name)
        : [...rawNames, ...Object.values(suggestions)],
    ),
  ]
  const candidates = raw
    ? [
        suggestions[raw],
        ...standardNames
          .filter((n) => n !== raw)
          .sort((a, b) => distance(raw, a) - distance(raw, b))
          .slice(0, 3),
      ].filter((v, i, a) => v && a.indexOf(v) === i)
    : []
  const pending = rawNames
    .filter((n) => !db.aliases.some((a) => a.kind === nameKind && a.raw === n))
    .filter((n) => !f.get('q') || n.includes(f.get('q')))
    .sort((a, b) => Number(Boolean(suggestions[b])) - Number(Boolean(suggestions[a])))
  function template() {
    const sample =
      kind === 'positions'
        ? { 公司: 'A公司', 部门: '储能运维部', 班组: '一班', 岗位: '储能值班员' }
        : kind === 'people'
          ? {
              工号: 'IMPORT001',
              姓名: '导入示例人员',
              公司: 'A公司',
              部门: '生产技术部',
              班组: '电气班',
              岗位: '电修技术员',
              专业: '电气检修',
              职责: '生产岗位，安全生产相关',
              作业范围: '高压电气作业',
              范围已确认: '是',
              任职日期: '2024-01-01',
            }
          : {
              记录编号: 'IMPORT-CERT-001',
              工号: 'SCENE001',
              证书名称: '高压电工作业证',
              证书编号: 'IMPORT-001',
              生效日期: '2026-09-13',
              有效期方式: '指定日期',
              到期日期: '2028-09-13',
              复审方式: '指定日期',
              复审日期: '2027-09-13',
              注册状态: '正常',
            }
    exportTable(
      kind === 'positions' ? '岗位导入模板' : kind === 'people' ? '人员导入模板' : '持证导入模板',
      [sample],
    )
  }
  async function load(file?: File) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const sheet = await readSheet(file)
      setHeaders(sheet.headers)
      setRows(sheet.rows)
      setMapping(
        Object.fromEntries(
          fields[kind].map((field) => [field, sheet.headers.includes(field) ? field : '']),
        ),
      )
      setFileName(file.name)
      setApplied(false)
    } catch {
      setError('无法读取表格，请选择 XLSX 或 CSV 文件。')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Header title="数据导入与名称归并" />
      <Tabs
        value={f.get('tab')}
        onChange={(v) => f.set('tab', v)}
        items={[
          { id: 'import', label: '批量导入' },
          { id: 'normalize', label: '名称归并', count: db.aliases.length },
          { id: 'source', label: '岗位原表', count: db.sources.length },
        ]}
      />
      {f.get('tab') === 'import' && (
        <>
          <div className="panel">
            <div className="section-heading">
              <h2>选择数据类型</h2>
              <button className="button secondary" onClick={template}>
                <Download size={16} />
                下载对应模板
              </button>
            </div>
            <div className="import-types">
              {(
                [
                  {
                    id: 'positions',
                    title: '原始岗位表',
                    note: '公司、部门、班组、岗位；允许空班组、空岗位',
                  },
                  {
                    id: 'people',
                    title: '人员与任职',
                    note: '按工号新增或更新，保留已有兼岗和原始来源',
                  },
                  {
                    id: 'credentials',
                    title: '持证记录',
                    note: '按记录编号新增或更新，关联已有员工工号',
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  className={kind === t.id ? 'selected' : ''}
                  aria-pressed={kind === t.id}
                  onClick={() => {
                    setKind(t.id)
                    setRows([])
                    setFileName('')
                    setApplied(false)
                  }}
                >
                  <strong>{t.title}</strong>
                  <span>{t.note}</span>
                </button>
              ))}
            </div>
            <label className="upload-zone">
              <Upload size={28} />
              <strong>{busy ? '正在读取表格…' : fileName || '选择 XLSX 或 CSV 文件'}</strong>
              <span>读取第一个工作表，首行作为表头</span>
              <input
                aria-label="选择导入文件"
                type="file"
                accept=".xlsx,.csv"
                disabled={busy}
                onChange={(e) => {
                  void load(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
          {rows.length > 0 && (
            <>
              <section className="panel">
                <div className="section-heading">
                  <h2>确认列映射</h2>
                  <Badge>{rows.length} 条数据</Badge>
                </div>
                <div className="mapping-grid">
                  {fields[kind].map((field) => (
                    <Select
                      key={field}
                      label={field}
                      value={mapping[field] || ''}
                      onChange={(e) => {
                        setMapping({ ...mapping, [field]: e.target.value })
                        setApplied(false)
                      }}
                    >
                      <option value="">不映射（留空）</option>
                      {headers.map((h, i) => (
                        <option key={i}>{h}</option>
                      ))}
                    </Select>
                  ))}
                </div>
              </section>
              <section className="panel">
                <div className="section-heading">
                  <h2>导入预览</h2>
                  <div className="actions">
                    <Badge tone="success">新增 {counts.new}</Badge>
                    <Badge>更新 {counts.update}</Badge>
                    <Badge>已存在 {counts.existing}</Badge>
                    <Badge tone={counts.invalid ? 'warning' : 'neutral'}>
                      待修正 {counts.invalid}
                    </Badge>
                    <button
                      className="button primary"
                      disabled={applied || (!counts.new && !counts.update)}
                      onClick={() => {
                        update(
                          (d) => applyImport(d, kind, preview),
                          '导入完成：新增 ' + counts.new + ' 条，更新 ' + counts.update + ' 条',
                        )
                        setApplied(true)
                      }}
                    >
                      <Check size={16} />
                      {applied ? '本批次已导入' : '导入可用记录'}
                    </button>
                  </div>
                </div>
                <Table
                  rows={preview}
                  rowKey={(r) => String(r.line)}
                  columns={[
                    { key: 'line', label: '文件行号', value: (r) => r.line },
                    {
                      key: 'action',
                      label: '处理方式',
                      render: (r) => (
                        <Badge tone={r.error ? 'warning' : 'neutral'}>{r.action}</Badge>
                      ),
                    },
                    ...fields[kind].slice(0, 4).map((field) => ({
                      key: field,
                      label: field,
                      value: (r: (typeof preview)[number]) => r.data[field] || '（空白）',
                    })),
                    { key: 'error', label: '说明', value: (r) => r.error || '可导入' },
                  ]}
                />
              </section>
            </>
          )}
        </>
      )}
      {f.get('tab') === 'normalize' && (
        <>
          <div className="split-layout">
            <section className="panel">
              <div className="section-heading">
                <h2>待确认的原始名称</h2>
              </div>
              <div className="toolbar">
                <Select
                  label="归并类型"
                  value={nameKind}
                  onChange={(e) => {
                    setNameKind(e.target.value as typeof nameKind)
                    setRaw('')
                    setStandard('')
                  }}
                >
                  <option value="job">岗位名称</option>
                  <option value="cert">证书名称</option>
                  <option value="department">部门名称</option>
                </Select>
                <SearchField
                  placeholder="搜索原始名称"
                  value={f.get('q')}
                  onChange={(v) => f.set('q', v)}
                />
              </div>
              <Table
                rows={pending}
                rowKey={(n) => n}
                columns={[
                  { key: 'name', label: '原始名称', value: (n) => n },
                  {
                    key: 'count',
                    label: '涉及记录',
                    value: (n) =>
                      nameKind === 'cert'
                        ? db.credentials.filter((c) => c.rawName === n).length
                        : db.people
                            .flatMap((p) => p.assignments)
                            .filter((a) => (nameKind === 'job' ? a.job : a.department) === n)
                            .length,
                  },
                  {
                    key: 'action',
                    label: '操作',
                    render: (n) => (
                      <button
                        className="text-button"
                        onClick={() => {
                          setRaw(n)
                          setStandard(suggestions[n] || '')
                        }}
                      >
                        选择归并
                      </button>
                    ),
                  },
                ]}
                pageKey="namesPage"
              />
            </section>
            <section className="panel sticky-panel">
              <h2>确认标准名称</h2>
              <p className="muted">本地词典与文字相似度只提供建议，确认后才用于统计。</p>
              <Field
                label="原始名称"
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value)
                  setStandard(suggestions[e.target.value] || '')
                }}
              />
              <div className="candidate-list">
                {candidates.map((n) => (
                  <button
                    key={n}
                    onClick={() => setStandard(n)}
                    className={standard === n ? 'selected' : ''}
                  >
                    <span>{n}</span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
              {nameKind === 'cert' ? (
                <Select
                  label="标准证书名称"
                  value={standard}
                  onChange={(e) => setStandard(e.target.value)}
                >
                  <option value="">请选择</option>
                  {db.certTypes.map((t) => (
                    <option key={t.id}>{t.name}</option>
                  ))}
                </Select>
              ) : (
                <Field
                  label="确认采用的标准名称"
                  value={standard}
                  onChange={(e) => setStandard(e.target.value)}
                />
              )}
              <button
                className="button primary full"
                disabled={!raw || !standard}
                onClick={() => {
                  update(
                    (d) => ({
                      ...d,
                      aliases: [
                        ...d.aliases.filter((a) => !(a.kind === nameKind && a.raw === raw)),
                        { id: uid('alias'), kind: nameKind, raw, standard },
                      ],
                    }),
                    '名称映射已确认，相关统计已更新',
                  )
                  setRaw('')
                  setStandard('')
                }}
              >
                确认名称映射
              </button>
            </section>
          </div>
          <section className="panel">
            <div className="section-heading">
              <h2>已确认映射</h2>
              <Badge>{db.aliases.length} 条</Badge>
            </div>
            <Table
              pageKey="aliasPage"
              rows={db.aliases}
              rowKey={(a) => a.id}
              columns={[
                {
                  key: 'kind',
                  label: '类型',
                  value: (a) => ({ job: '岗位', cert: '证书', department: '部门' })[a.kind],
                },
                { key: 'raw', label: '原始名称', value: (a) => a.raw },
                { key: 'standard', label: '标准名称', value: (a) => a.standard },
                {
                  key: 'action',
                  label: '操作',
                  render: (a) => (
                    <button
                      className="text-button"
                      onClick={() => {
                        setNameKind(a.kind)
                        setRaw(a.raw)
                        setStandard(a.standard)
                        notify('已载入映射，可修改后再次确认')
                      }}
                    >
                      修改映射
                    </button>
                  ),
                },
              ]}
            />
          </section>
        </>
      )}
      {f.get('tab') === 'source' && (
        <>
          <div className="source-summary">
            <strong>初始岗位表 1,315 行 · 15 家公司</strong>
            <span>124 处班组空白 · 4 处岗位空白 · 原始值完整保留</span>
            <button
              className="button secondary"
              onClick={() =>
                exportTable(
                  '岗位来源数据',
                  db.sources.map((s) => ({
                    来源编号: s.id,
                    原始行号: s.row,
                    公司: s.company,
                    部门: s.department,
                    班组: s.team,
                    岗位: s.job,
                  })),
                )
              }
            >
              <Download size={16} />
              导出原始值
            </button>
          </div>
          <SearchField
            placeholder="搜索原始公司、部门、岗位"
            value={f.get('q')}
            onChange={(v) => f.set('q', v)}
          />
          <Table
            rows={db.sources.filter((s) =>
              [s.company, s.department, s.team, s.job].join(' ').includes(f.get('q')),
            )}
            rowKey={(s) => s.id}
            columns={[
              { key: 'row', label: '原始行号', value: (s) => s.row },
              { key: 'company', label: '公司', value: (s) => s.company },
              { key: 'department', label: '部门', value: (s) => s.department },
              { key: 'team', label: '班组', render: (s) => s.team ?? <Badge>原表空白</Badge> },
              {
                key: 'job',
                label: '岗位',
                render: (s) => s.job ?? <Badge tone="warning">原表空白</Badge>,
              },
              {
                key: 'person',
                label: '关联人员',
                render: (s) => {
                  const p = db.people.find((p) => p.assignments.some((a) => a.sourceId === s.id))
                  return p ? (
                    <Link className="text-button" to={'/people/' + p.id}>
                      查看人员
                    </Link>
                  ) : (
                    '—'
                  )
                },
              },
            ]}
          />
        </>
      )}
    </>
  )
}
