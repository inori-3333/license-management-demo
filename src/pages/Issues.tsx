import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, ArrowUpRight, CheckCircle2, Circle } from 'lucide-react'
import { useStore } from '../store'
import { resolveIssue } from '../engine'
import { activeAssignments, type Issue, type IssueKind } from '../model'
import { exportTable } from '../io'
import {
  Badge,
  CompanyFilter,
  Field,
  BusinessForm,
  Header,
  Modal,
  SearchField,
  Select,
  Status,
  Table,
  Tabs,
  TextAreaField,
  useFilters,
} from '../ui'
export default function Issues() {
  const { db, result, update } = useStore(),
    f = useFilters({ tab: 'open' })
  const [selected, setSelected] = useState<string | null>(null),
    [note, setNote] = useState(''),
    [assignee, setAssignee] = useState(''),
    [reviewer, setReviewer] = useState(''),
    [action, setAction] = useState<'assign' | 'start' | 'submit' | 'reject' | 'close'>('assign')
  const current = db.issues.find((i) => i.id === selected)
  const currentPerson = db.people.find((p) => p.id === current?.personId)
  const currentAssignment =
    currentPerson &&
    activeAssignments(currentPerson, db.asOf).find((a) => a.company === current?.company)
  const live = new Set(result.findings.map((i) => i.id))
  const kinds: IssueKind[] = [
    '缺证',
    '已过期',
    '复审逾期',
    '注册异常',
    '尚未生效',
    '信息待补充',
    '证书临期',
    '复审提醒',
    '过渡期',
    '群体未达标',
  ]
  const companies = [
    ...new Set(db.people.flatMap((p) => p.assignments.map((a) => a.company))),
  ].sort()
  const rows = db.issues
    .filter((i) => {
      const person = db.people.find((p) => p.id === i.personId)
      return (
        (f.get('tab') === 'closed' ? i.state === '已销项' : i.state !== '已销项') &&
        (!f.get('q') ||
          [i.title, person?.name, person?.employeeNo, i.assignee].join(' ').includes(f.get('q'))) &&
        (!f.get('company') || i.company === f.get('company')) &&
        (!f.get('kind') || i.kind === f.get('kind')) &&
        (!f.get('severity') || i.severity === f.get('severity')) &&
        (!f.get('person') || i.personId === f.get('person')) &&
        (!f.get('state') || i.state === f.get('state'))
      )
    })
    .sort(
      (a, b) =>
        Number(live.has(b.id)) - Number(live.has(a.id)) ||
        ['danger', 'warning', 'info'].indexOf(a.severity) -
          ['danger', 'warning', 'info'].indexOf(b.severity),
    )
  function open(i: Issue) {
    setSelected(i.id)
    setNote(i.note)
    setAssignee(i.assignee)
    setReviewer(i.reviewer)
    setAction(
      i.state === '待分派'
        ? 'assign'
        : i.state === '待整改'
          ? 'start'
          : i.state === '整改中'
            ? 'submit'
            : 'close',
    )
  }
  return (
    <>
      <Header title="预警与整改">
        <button
          className="button secondary"
          onClick={() =>
            exportTable(
              '预警整改清单',
              rows.map((i) => ({
                公司: i.company,
                人员: db.people.find((p) => p.id === i.personId)?.name || '群体目标',
                工号: db.people.find((p) => p.id === i.personId)?.employeeNo || '',
                问题: i.title,
                类别: i.kind,
                状态: i.state,
                当前校验: live.has(i.id) ? '仍需处理' : '问题已修复',
                负责人: i.assignee,
                复核人: i.reviewer,
                期限: i.due,
                说明: i.detail,
              })),
            )
          }
        >
          <Download size={16} />
          导出问题清单
        </button>
      </Header>
      <div className="issue-metrics">
        {[
          { label: '合规问题', key: 'danger' },
          { label: '风险提醒', key: 'warning' },
          { label: '信息待补充', key: 'info' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => f.set('severity', f.get('severity') === t.key ? '' : t.key)}
            className={f.get('severity') === t.key ? 'selected' : ''}
          >
            <span className={'status-dot ' + t.key} />
            <span>{t.label}</span>
            <strong>{result.findings.filter((i) => i.severity === t.key).length}</strong>
          </button>
        ))}
      </div>
      <Tabs
        value={f.get('tab')}
        onChange={(v) => f.set('tab', v)}
        items={[
          {
            id: 'open',
            label: '待处理',
            count: db.issues.filter((i) => i.state !== '已销项').length,
          },
          {
            id: 'closed',
            label: '已销项',
            count: db.issues.filter((i) => i.state === '已销项').length,
          },
        ]}
      />
      {f.get('person') && (
        <p className="filter-notice">
          正在查看指定人员的问题{' '}
          <button className="text-button" onClick={() => f.set('person', '')}>
            清除人员筛选
          </button>
        </p>
      )}
      <div className="toolbar">
        <SearchField
          placeholder="搜索人员、问题或负责人"
          value={f.get('q')}
          onChange={(v) => f.set('q', v)}
        />
        <CompanyFilter
          companies={companies}
          value={f.get('company')}
          onChange={(v) => f.set('company', v)}
        />
        <Select
          label="问题类型"
          value={f.get('kind')}
          onChange={(e) => f.set('kind', e.target.value)}
        >
          <option value="">全部类型</option>
          {kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
        <Select
          label="整改阶段"
          value={f.get('state')}
          onChange={(e) => f.set('state', e.target.value)}
        >
          <option value="">全部阶段</option>
          {['待分派', '待整改', '整改中', '待复核', '已销项'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
      </div>
      <Table
        rows={rows}
        rowKey={(i) => i.id}
        mobileRender={(i) => (
          <>
            <div className="mobile-record-heading">
              <strong>{db.people.find((p) => p.id === i.personId)?.name || i.company}</strong>
              <Status value={i.state} />
            </div>
            <p className="record-gap">{i.title}</p>
            <p className="muted">
              {i.company} · 期限 {i.due || '待确认'} · 负责人 {i.assignee || '待分派'}
            </p>
            <div className="mobile-record-footer">
              <Badge tone={live.has(i.id) ? i.severity : 'success'}>
                {live.has(i.id) ? '仍需处理' : '当前问题已修复'}
              </Badge>
              <button className="text-button" onClick={() => open(i)}>
                处理详情 <ArrowUpRight size={14} />
              </button>
            </div>
          </>
        )}
        columns={[
          {
            key: 'title',
            label: '问题与类型',
            pin: 'start',
            value: (i) => i.title,
            render: (i) => (
              <button className="cell-button" onClick={() => open(i)}>
                <strong>{i.title}</strong>
                <small>
                  {i.kind}{' '}
                  {i.days !== undefined
                    ? ' · ' + (i.days < 0 ? '超期 ' + -i.days : '剩余 ' + i.days) + ' 天'
                    : ''}
                </small>
              </button>
            ),
          },
          {
            key: 'person',
            label: '人员／公司',
            render: (i) => (
              <>
                {i.personId ? (
                  <Link to={'/people/' + i.personId}>
                    {db.people.find((p) => p.id === i.personId)?.name}
                  </Link>
                ) : (
                  '单位群体目标'
                )}
                <small>{i.company}</small>
              </>
            ),
          },
          { key: 'due', label: '期限', value: (i) => i.due || '—' },
          { key: 'state', label: '整改状态', render: (i) => <Status value={i.state} /> },
          {
            key: 'live',
            label: '当前校验',
            render: (i) => (
              <Badge tone={live.has(i.id) ? i.severity : 'success'}>
                {live.has(i.id) ? '仍需处理' : i.state === '已销项' ? '已解决' : '已修复，待复核'}
              </Badge>
            ),
          },
          { key: 'owner', label: '负责人', value: (i) => i.assignee || '待分派' },
          {
            key: 'action',
            label: '操作',
            pin: 'end',
            render: (i) => (
              <button className="text-button" onClick={() => open(i)}>
                处理详情
              </button>
            ),
          },
        ]}
      />
      {current && (
        <Modal
          title={'整改处理 · ' + (currentPerson?.name || current.company)}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="issue-context">
            <div className="mobile-record-heading">
              <strong>{currentPerson?.name || '单位群体目标'}</strong>
              <span>{currentPerson?.employeeNo || current.company}</span>
            </div>
            <dl className="object-facts">
              <div>
                <dt>所属单位</dt>
                <dd>
                  {current.company}
                  {currentAssignment?.department ? ' / ' + currentAssignment.department : ''}
                </dd>
              </div>
              <div>
                <dt>当前岗位</dt>
                <dd>
                  {currentPerson ? currentAssignment?.job || '任职信息待确认' : '群体阶段目标'}
                </dd>
              </div>
              <div>
                <dt>处理期限</dt>
                <dd>
                  {current.due || '待确认'}
                  {current.days !== undefined && (
                    <span className={current.days < 0 ? 'deadline-overdue' : ''}>
                      {' '}
                      ·{' '}
                      {current.days < 0
                        ? `已超期 ${-current.days} 天`
                        : current.days === 0
                          ? '今天到期'
                          : `剩余 ${current.days} 天`}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <div className="section-heading">
            <h3>{current.title}</h3>
            <Status value={current.state} />
          </div>
          <p>{current.detail}</p>
          <div className="detail-summary">
            <Badge tone={live.has(current.id) ? 'warning' : 'success'}>
              {live.has(current.id) ? '当前校验仍有此问题' : '当前校验已通过'}
            </Badge>
            {current.personId ? (
              <Link to={'/people/' + current.personId} onClick={() => setSelected(null)}>
                查看并更新人员证书 <ArrowUpRight size={14} />
              </Link>
            ) : (
              <Link to="/rules" onClick={() => setSelected(null)}>
                查看规则
              </Link>
            )}
          </div>
          <div className="workflow-steps">
            {['待分派', '待整改', '整改中', '待复核', '已销项'].map((s, i) => (
              <span
                key={s}
                className={
                  i <= ['待分派', '待整改', '整改中', '待复核', '已销项'].indexOf(current.state)
                    ? 'reached'
                    : ''
                }
              >
                {s === current.state ? <Circle size={15} /> : <CheckCircle2 size={15} />} {s}
              </span>
            ))}
          </div>
          {current.state !== '已销项' && (
            <BusinessForm
              onCancel={() => setSelected(null)}
              submitLabel={
                {
                  assign: '分派整改',
                  start: '开始整改',
                  submit: '提交复核',
                  reject: '退回整改',
                  close: '复核通过并销项',
                }[action]
              }
              onSubmit={() => {
                const actor =
                  action === 'close' || action === 'reject'
                    ? reviewer || current.reviewer || '演示管理员'
                    : assignee || current.assignee || '演示管理员'
                const next = resolveIssue(db, current.id, action, actor, note, assignee, reviewer)
                update(() => next, '整改状态已更新')
                setSelected(null)
              }}
            >
              <div className="form-grid">
                <Field
                  label="整改负责人"
                  value={assignee}
                  required={action === 'assign'}
                  onChange={(e) => setAssignee(e.target.value)}
                />
                <Field
                  label="复核人"
                  value={reviewer}
                  required={action === 'submit' || action === 'close' || action === 'reject'}
                  onChange={(e) => setReviewer(e.target.value)}
                />
              </div>
              <TextAreaField label="整改／复核说明" value={note} onChange={setNote} />
              {current.state === '待复核' && (
                <Select
                  label="复核结论"
                  value={action}
                  onChange={(e) => setAction(e.target.value as 'close' | 'reject')}
                >
                  <option value="close">通过并销项（需要当前校验通过）</option>
                  <option value="reject">退回继续整改</option>
                </Select>
              )}
            </BusinessForm>
          )}
          <h3>处理时间线</h3>
          <ol className="timeline">
            {[...current.history].reverse().map((h, i) => (
              <li key={i}>
                <strong>{h.action}</strong>
                <span>
                  {h.actor} ·{' '}
                  {new Date(h.at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                </span>
                <p>{h.note || '—'}</p>
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </>
  )
}
