import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Printer, Save } from 'lucide-react'
import { useStore } from '../store'
import { uid, pct, type ReportConfig } from '../model'
import { buildReport, defaultReport, reportTypes, groupTypes, unitSummaryColumns } from '../reports'
import { exportTable } from '../io'
import { CompanyFilter, Field, BusinessForm, Header, Modal, Select, Table } from '../ui'
export default function Reports() {
  const { db, result, update, notify } = useStore()
  const [params] = useSearchParams()
  const [config, setConfig] = useState<ReportConfig>({
      ...defaultReport,
      company: params.get('company') || '',
      type: params.get('type') || 'units',
      group: params.get('group') || 'company',
      columns: !params.get('type') || params.get('type') === 'units' ? [...unitSummaryColumns] : [],
      expiryDays: Number(params.get('days')) || 0,
    }),
    [save, setSave] = useState(false),
    [saveName, setSaveName] = useState('')
  const [detail, setDetail] = useState<Record<string, string | number | null> | null>(null)
  const data = useMemo(() => buildReport(db, result, config), [db, result, config])
  const keys = Object.keys(data[0] || {})
  const columns = config.columns.length ? config.columns.filter((k) => keys.includes(k)) : keys
  const rows = data.map((r) => Object.fromEntries(columns.map((k) => [k, r[k]])))
  const formatValue = (key: string, value: string | number | null) =>
    value === null
      ? '—'
      : typeof value === 'number' && /(?:率|比例)$/.test(key)
        ? pct(value)
        : String(value)
  const companies = [
    ...new Set(db.people.flatMap((p) => p.assignments.map((a) => a.company))),
  ].sort()
  const specialties = [...new Set(db.people.flatMap((p) => p.assignments.map((a) => a.specialty)))]
    .filter(Boolean)
    .sort()
  const title = config.name || reportTypes.find((t) => t.id === config.type)!.label
  return (
    <>
      <Header title="统计报表" description="选择统计范围与维度，保存专项分析方案，导出当前结果。">
        <button className="button secondary" onClick={() => window.print()}>
          <Printer size={16} />
          打印
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setSaveName(config.name)
            setSave(true)
          }}
        >
          <Save size={16} />
          保存方案
        </button>
        <button
          className="button secondary"
          disabled={!rows.length}
          onClick={() => exportTable(title, rows, 'csv')}
        >
          CSV
        </button>
        <button
          className="button primary"
          disabled={!rows.length}
          onClick={() => exportTable(title, rows)}
        >
          <Download size={16} />
          导出 Excel
        </button>
      </Header>
      <div className="panel report-controls">
        <div className="form-grid three">
          <Select
            label="报表类型"
            value={config.type}
            onChange={(e) =>
              setConfig({
                ...config,
                type: e.target.value,
                columns: e.target.value === 'units' ? [...unitSummaryColumns] : [],
                name: '',
                id: '',
              })
            }
          >
            {reportTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select
            label="分组维度"
            value={config.type === 'units' ? 'company' : config.group}
            disabled={config.type !== 'distribution'}
            onChange={(e) => setConfig({ ...config, group: e.target.value, columns: [] })}
          >
            {groupTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select
            label="已保存方案"
            value={config.id}
            onChange={(e) => {
              const r = db.reports.find((r) => r.id === e.target.value)
              setConfig(
                r ? structuredClone(r) : { ...defaultReport, columns: [...unitSummaryColumns] },
              )
            }}
          >
            <option value="">临时分析</option>
            {db.reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <CompanyFilter
            companies={companies}
            value={config.company}
            onChange={(company) => setConfig({ ...config, company })}
          />
          <Select
            label="专业筛选"
            value={config.specialty}
            onChange={(e) => setConfig({ ...config, specialty: e.target.value })}
          >
            <option value="">全部专业</option>
            {specialties.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select
            label="证书类别"
            value={config.category}
            onChange={(e) => setConfig({ ...config, category: e.target.value })}
          >
            <option value="">全部类别</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {config.type === 'expiry' && (
            <Select
              label="提醒时间范围"
              value={config.expiryDays || 0}
              onChange={(e) => setConfig({ ...config, expiryDays: Number(e.target.value) })}
            >
              <option value="0">全部临期、复审与逾期</option>
              <option value="7">未来 7 天内临期与复审</option>
              <option value="30">未来 30 天内临期与复审</option>
              <option value="90">未来 90 天内临期与复审</option>
              <option value="180">未来 180 天内临期与复审</option>
            </Select>
          )}
        </div>
        {config.type === 'units' && (
          <div className="report-presets" role="group" aria-label="报表显示列">
            <button
              className="button secondary"
              aria-pressed={columns.join('|') === unitSummaryColumns.join('|')}
              onClick={() => setConfig({ ...config, columns: [...unitSummaryColumns] })}
            >
              概览列
            </button>
            <button
              className="button secondary"
              aria-pressed={columns.length === keys.length}
              onClick={() => setConfig({ ...config, columns: [] })}
            >
              全部指标
            </button>
            <span className="muted">点击单位明细查看分子、分母与统计口径</span>
          </div>
        )}
        <details className="column-options">
          <summary>选择显示与导出的列</summary>
          <div className="choice-tags">
            {keys.map((k) => (
              <label key={k} className="check">
                <input
                  type="checkbox"
                  checked={columns.includes(k)}
                  onChange={() => {
                    const selected = columns.includes(k)
                      ? columns.filter((x) => x !== k)
                      : [...columns, k]
                    if (!selected.length) {
                      notify('至少保留一列')
                      return
                    }
                    setConfig({ ...config, columns: selected })
                  }}
                />
                {k}
              </label>
            ))}
          </div>
        </details>
      </div>
      <section className="panel report-output">
        <div className="section-heading">
          <div>
            <h2>{title}</h2>
            <p className="muted">
              统计日期 {db.asOf} · {config.company || '全部公司'} · {config.specialty || '全部专业'}{' '}
              · {data.length} 条结果
            </p>
          </div>
        </div>
        <Table
          rows={data}
          rowKey={(r) => JSON.stringify(r)}
          mobileRender={(r) => (
            <>
              <div className="mobile-record-heading">
                <strong>{String(r['分组'] || r['姓名'] || r['人员'] || r['公司'] || title)}</strong>
                <button className="text-button" onClick={() => setDetail(r)}>
                  查看明细
                </button>
              </div>
              <dl className="report-facts">
                {columns.map((k) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{formatValue(k, r[k])}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          columns={[
            ...columns.map((k, index) => ({
              key: k,
              label: k,
              pin: index === 0 ? ('start' as const) : undefined,
              value: (r: (typeof data)[number]) => r[k] ?? '—',
              render: (r: (typeof data)[number]) => formatValue(k, r[k]),
            })),
            {
              key: 'detail',
              label: '明细',
              pin: 'end',
              render: (r) => (
                <button className="text-button" onClick={() => setDetail(r)}>
                  查看明细
                </button>
              ),
            },
          ]}
        />
        <div className="print-only">
          <table>
            <thead>
              <tr>
                {columns.map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {columns.map((k) => (
                    <td key={k}>
                      {r[k] === null
                        ? '—'
                        : typeof r[k] === 'number' && /(?:率|比例)$/.test(k)
                          ? pct(r[k] as number)
                          : String(r[k] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="metric-footnote">
          个人合规率按可判定且存在当期强制要求的人员计算；应持证项完成率含过渡期需求；群体比例默认按公司与规则完整范围统计；选择专业后的结果为该专业子集分析，不用于认定公司的制度达标情况。跨组兼岗人员可分别出现在多个组，合计不可简单相加。
        </p>
      </section>
      {detail && (
        <Modal
          title={
            String(detail['分组'] || detail['姓名'] || detail['公司'] || title) + ' · 统计明细'
          }
          onClose={() => setDetail(null)}
        >
          <p className="muted">
            统计日期 {db.asOf} · {config.specialty || '全部专业'} ·{' '}
            {db.categories.find((c) => c.id === config.category)?.name || '全部证书类别'}
          </p>
          <dl className="report-facts">
            {Object.entries(detail).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{formatValue(key, value)}</dd>
              </div>
            ))}
          </dl>
          {config.type === 'units' && (
            <>
              <p className="report-explanation">
                当期个人合规率：{detail['合规人数']} / {detail['纳入合规率人数']}{' '}
                人；应持证项完成率：{detail['有效已持项数']} / {detail['应持项数']} 项。
                {detail['人员合规率'] === null
                  ? '当前没有可判定且存在当期强制要求的人员，合规率不适用。'
                  : ''}
              </p>
              <Link
                className="button primary"
                to={'/people?status=active&company=' + encodeURIComponent(String(detail['分组']))}
              >
                查看该单位全部在岗人员
              </Link>
            </>
          )}
        </Modal>
      )}
      {save && (
        <Modal title="保存报表方案" onClose={() => setSave(false)}>
          <BusinessForm
            onCancel={() => setSave(false)}
            onSubmit={() => {
              if (db.reports.some((r) => r.name === saveName && r.id !== config.id))
                throw new Error('方案名称已存在，请选择已有方案后更新，或使用新名称。')
              const saved = { ...config, name: saveName, id: config.id || uid('report') }
              update(
                (d) => ({
                  ...d,
                  reports: d.reports.some((r) => r.id === saved.id)
                    ? d.reports.map((r) => (r.id === saved.id ? saved : r))
                    : [...d.reports, saved],
                }),
                '报表方案已保存',
              )
              setConfig(saved)
              setSave(false)
            }}
          >
            <Field
              label="方案名称"
              required
              placeholder="例如：储能岗位持证专项分析"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <p>保存当前报表类型、分组维度、筛选条件和列选择。再次打开时使用最新数据重新计算。</p>
          </BusinessForm>
        </Modal>
      )}
    </>
  )
}
