import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Users,
  ShieldCheck,
  ClipboardCheck,
  ScanLine,
  CircleAlert,
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useStore } from '../store'
import { metrics, daysBetween } from '../engine'
import { pct } from '../model'
import { buildReport, defaultReport, scopedResults } from '../reports'
import { Badge, CompanyFilter, Empty, Header, Select, useFilters } from '../ui'
export default function Dashboard() {
  const { db, result } = useStore(),
    f = useFilters()
  const [showAllUnits, setShowAllUnits] = useState(false)
  const scopedLink = (to: string) =>
    to +
    (f.get('company')
      ? (to.includes('?') ? '&' : '?') + 'company=' + encodeURIComponent(f.get('company'))
      : '')
  const companies = [
    ...new Set(db.people.flatMap((p) => p.assignments.map((a) => a.company))),
  ].sort()
  const selected = scopedResults(db, result, {
      company: f.get('company'),
      specialty: '',
      category: '',
    }),
    m = metrics(selected)
  const findings = result.findings.filter(
    (i) => !f.get('company') || i.company === f.get('company'),
  )
  const units = buildReport(db, result, { ...defaultReport, company: f.get('company') })
  const unitSort = f.get('unitSort') || 'completion'
  const sortedUnits = [...units].sort((a, b) =>
    unitSort === 'name'
      ? String(a['分组']).localeCompare(String(b['分组']), 'zh-CN')
      : unitSort === 'unknown'
        ? Number(b['待确认人数']) - Number(a['待确认人数'])
        : Number(a['应持证项完成率'] ?? 2) - Number(b['应持证项完成率'] ?? 2),
  )
  const groups = result.groups.filter((g) => !f.get('company') || g.company === f.get('company'))
  const urgent = findings.filter((i) => i.severity === 'danger').slice(0, 5)
  const cards = [
    {
      label: '在统计范围人员',
      value: m.total.toLocaleString('zh-CN'),
      detail:
        db.sources.filter((s) => !f.get('company') || s.company === f.get('company')).length +
        ' 条岗位来源 · ' +
        (f.get('company') ? 1 : companies.length) +
        ' 家公司',
      icon: Users,
      to: '/people?status=active',
    },
    {
      label: '当期个人合规率',
      value: pct(m.compliance),
      detail: '当期强制要求：' + m.compliant + ' / ' + m.eligible + ' 人满足',
      icon: ShieldCheck,
      to: '/people?status=eligible',
    },
    {
      label: '应持证项完成率',
      value: pct(m.completion),
      detail: m.held + ' / ' + m.required + ' 项 · 含过渡期需求',
      icon: ClipboardCheck,
      to: '/reports?type=distribution&group=certificate',
    },
    {
      label: '统计覆盖率',
      value: pct(m.coverage),
      detail: m.unknown + ' 人判定信息待补充',
      icon: ScanLine,
      to: '/people?status=unknown',
    },
  ]
  const expiry = [7, 30, 90, 180].map((days, i) => ({
    name: [0, 8, 31, 91][i] + '–' + days + ' 天',
    count: findings.filter(
      (f) =>
        ['证书临期', '复审提醒'].includes(f.kind) &&
        f.days !== undefined &&
        f.days >= (i ? [0, 8, 31, 91][i] : 0) &&
        f.days <= days,
    ).length,
  }))
  return (
    <>
      <Header title="管理总览">
        <CompanyFilter
          companies={companies}
          value={f.get('company')}
          onChange={(v) => f.set('company', v)}
        />
      </Header>
      <section className="panel attention-panel" aria-labelledby="attention-title">
        <div className="section-heading">
          <div>
            <h2 id="attention-title">
              <CircleAlert size={19} /> 待处理事项
            </h2>
            <p className="muted">{f.get('company') || '全部公司'} · 按当前统计日期</p>
          </div>
          <Link to={scopedLink('/issues')}>
            全部问题 <ArrowRight size={15} />
          </Link>
        </div>
        <div className="attention-actions">
          <Link className="attention-action danger" to={scopedLink('/issues?severity=danger')}>
            <span>当期合规问题</span>
            <strong>
              {findings.filter((i) => i.severity === 'danger').length}
              <small>项</small>
            </strong>
            <span>
              优先处理 <ArrowRight size={15} />
            </span>
          </Link>
          <Link className="attention-action warning" to={scopedLink('/people?status=unknown')}>
            <span>判定信息待补充</span>
            <strong>
              {m.unknown}
              <small>人</small>
            </strong>
            <span>
              完善人员信息 <ArrowRight size={15} />
            </span>
          </Link>
          <Link className="attention-action" to={scopedLink('/reports?type=expiry&days=30')}>
            <span>30 天内临期与复审</span>
            <strong>
              {expiry.slice(0, 2).reduce((sum, item) => sum + item.count, 0)}
              <small>项</small>
            </strong>
            <span>
              查看提醒清单 <ArrowRight size={15} />
            </span>
          </Link>
        </div>
        {urgent.length > 0 && (
          <details className="priority-disclosure">
            <summary>优先关注 {urgent.length} 项问题</summary>
            <div className="priority-preview">
              {urgent.map((i) => (
                <Link
                  className="priority-item"
                  key={i.id}
                  to={scopedLink(
                    '/issues?' + (i.personId ? 'person=' + i.personId : 'kind=群体未达标'),
                  )}
                >
                  <span>
                    <strong>{db.people.find((p) => p.id === i.personId)?.name || i.company}</strong>
                    <small>{i.title}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          </details>
        )}
      </section>
      <div className="overview-strip">
        <div>
          <span className="live-dot" />
          持证数据概览
        </div>
        <span>
          统计日期 <strong>{db.asOf}</strong>
        </span>
        <Link to="/data?tab=source">
          原表完整保留 <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="kpi-grid">
        {cards.map((c) => (
          <Link key={c.label} className="kpi" to={scopedLink(c.to)}>
            <div className="kpi-label">
              <span>{c.label}</span>
              <c.icon size={20} />
            </div>
            <strong>{c.value}</strong>
            <p>{c.detail}</p>
            <ArrowUpRight className="kpi-arrow" size={18} />
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>各单位持证情况</h2>
              <p className="muted">
                {showAllUnits ? units.length : Math.min(units.length, 6)} / {units.length} 家单位 ·
                点击查看人员
              </p>
            </div>
            <Link to={scopedLink('/reports')}>
              完整报表 <ArrowRight size={15} />
            </Link>
          </div>
          <div className="matrix-toolbar">
            <Select
              label="单位排序"
              value={unitSort}
              onChange={(e) => f.set('unitSort', e.target.value)}
            >
              <option value="completion">完成率由低到高</option>
              <option value="unknown">待确认人数由多到少</option>
              <option value="name">单位名称</option>
            </Select>
          </div>
          <div className="company-matrix">
            <div className="matrix-head">
              <span>单位</span>
              <span>应持证项完成率</span>
              <span>合规率</span>
              <span>覆盖率</span>
            </div>
            {(showAllUnits ? sortedUnits : sortedUnits.slice(0, 6)).map((u) => (
              <Link
                key={String(u['分组'])}
                to={'/people?company=' + encodeURIComponent(String(u['分组']))}
              >
                <span>{u['分组']}</span>
                <span className="bar-cell">
                  <span className="track">
                    <i style={{ width: ((u['应持证项完成率'] as number) || 0) * 100 + '%' }} />
                  </span>
                  <strong>{pct(u['应持证项完成率'] as number | null)}</strong>
                </span>
                <span>
                  {u['人员合规率'] === null ? (
                    <span className="muted">暂无样本</span>
                  ) : (
                    pct(u['人员合规率'] as number)
                  )}
                </span>
                <span>{pct(u['统计覆盖率'] as number | null)}</span>
              </Link>
            ))}
          </div>
          {units.length > 6 && (
            <button
              className="matrix-expand text-button"
              aria-expanded={showAllUnits}
              onClick={() => setShowAllUnits(!showAllUnits)}
            >
              {showAllUnits ? '收起单位明细' : `展开全部 ${units.length} 家单位`}
            </button>
          )}
        </section>
        <div className="dashboard-aside">
          <section className="panel">
            <div className="section-heading">
              <h2>临期与复审分布</h2>
              <Badge>未来 180 天</Badge>
            </div>
            <div className="chart">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={expiry} margin={{ left: -25, right: 5, top: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [v + ' 项', '提醒数']}
                    cursor={{ fill: 'var(--blue-soft)' }}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={34}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>阶段目标进度</h2>
            <p className="muted">群体比例独立考核，缺口人数按目标向上取整。</p>
          </div>
          <Link to={scopedLink('/reports?type=groups')}>
            查看阶段报表 <ArrowRight size={15} />
          </Link>
        </div>
        <div className="target-grid">
          {groups.slice(0, 6).map((g) => (
            <div className="target-card" key={g.id}>
              <div className="section-heading">
                <strong>{g.company}</strong>
                <Badge>{db.certTypes.find((c) => c.id === g.certId)?.name}</Badge>
              </div>
              <div className="target-value">
                <strong>{pct(g.ratio)}</strong>
                <span>
                  {g.held} / {g.total} 人有效持证
                </span>
              </div>
              <div className="track">
                <i style={{ width: (g.ratio || 0) * 100 + '%' }} />
              </div>
              <p>
                下一目标 {Math.round(g.nextTarget * 100)}% · {g.deadline}
              </p>
              <small>
                {g.unknown
                  ? '范围内 ' + g.unknown + ' 人信息待确认'
                  : g.gap
                    ? '目标尚缺 ' + g.gap + ' 人'
                    : '已达到下一阶段目标'}
                {daysBetween(db.asOf, g.deadline) >= 0
                  ? ' · 剩余 ' + daysBetween(db.asOf, g.deadline) + ' 天'
                  : ''}
              </small>
            </div>
          ))}
        </div>
        {!groups.length && <Empty text="此范围暂无群体比例目标" />}
      </section>
      <div className="metric-footnote">
        <strong>口径说明</strong>
        　个人合规率仅纳入可判定且存在当期强制要求的人员；未知与无当期强制要求单独列示。当前展示为演示数据，统计日期用于节点推演。
      </div>
    </>
  )
}
