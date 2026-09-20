import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Plus, Pencil, Trash2, ArrowUpRight } from 'lucide-react'
import {
  activeAssignments,
  uid,
  split,
  type Assignment,
  type Credential,
  type Person,
} from '../model'
import { useStore } from '../store'
import { canonical, credentialStatus } from '../engine'
import { exportTable, personnelExport } from '../io'
import { specialties, scopeOptions, dutyOptions } from '../policy'
import {
  Badge,
  CompanyFilter,
  Confirm,
  Field,
  BusinessForm,
  Header,
  ListField,
  Modal,
  SearchField,
  Select,
  Status,
  Table,
  useFilters,
  useListContext,
} from '../ui'
const blankAssignment = (): Assignment => ({
  id: uid('assignment'),
  company: '',
  department: '',
  team: '',
  job: '',
  standardJob: '',
  specialty: '',
  duties: [],
  scopes: [],
  scopeConfirmed: false,
  start: '',
  end: '',
})
export function AssignmentFields({
  a,
  onChange,
}: {
  a: Assignment
  onChange: (a: Assignment) => void
}) {
  const set = (key: keyof Assignment, value: unknown) => onChange({ ...a, [key]: value })
  return (
    <>
      <div className="form-grid">
        <Field
          label="公司"
          required
          value={a.company}
          onChange={(e) => set('company', e.target.value)}
        />
        <Field
          label="部门"
          required
          value={a.department}
          onChange={(e) => set('department', e.target.value)}
        />
        <Field
          label="班组"
          value={a.team}
          onChange={(e) => set('team', e.target.value)}
          hint="可留空，直接归属部门"
        />
        <Field label="岗位" value={a.job} onChange={(e) => set('job', e.target.value)} />
        <Field
          label="标准岗位"
          value={a.standardJob}
          onChange={(e) => set('standardJob', e.target.value)}
          hint="留空时使用岗位或已确认名称映射"
        />
        <Select label="专业" value={a.specialty} onChange={(e) => set('specialty', e.target.value)}>
          <option value="">待补充</option>
          {[...new Set([...specialties, a.specialty])].filter(Boolean).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Field
          label="任职开始日期"
          type="date"
          value={a.start}
          onChange={(e) => set('start', e.target.value)}
        />
        <Field
          label="任职结束日期"
          type="date"
          value={a.end}
          onChange={(e) => set('end', e.target.value)}
        />
      </div>
      <ListField
        label="职责标签"
        values={a.duties}
        onChange={(v) => set('duties', v)}
        hint="用中文逗号分隔，也可点击下方标签"
      />
      <div className="choice-tags">
        {dutyOptions.map((s) => (
          <button
            type="button"
            key={s}
            aria-pressed={a.duties.includes(s)}
            onClick={() =>
              set(
                'duties',
                a.duties.includes(s) ? a.duties.filter((x) => x !== s) : [...a.duties, s],
              )
            }
          >
            {s}
          </button>
        ))}
      </div>
      <ListField
        label="实际作业范围"
        values={a.scopes}
        onChange={(v) => set('scopes', v)}
        hint="填写明确的实际作业，可点击下方标签"
      />
      <div className="choice-tags">
        {scopeOptions.map((s) => (
          <button
            type="button"
            key={s}
            aria-pressed={a.scopes.includes(s)}
            onClick={() =>
              set(
                'scopes',
                a.scopes.includes(s) ? a.scopes.filter((x) => x !== s) : [...a.scopes, s],
              )
            }
          >
            {s}
          </button>
        ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={a.scopeConfirmed}
          onChange={(e) => set('scopeConfirmed', e.target.checked)}
        />
        已确认职责和实际作业范围（可明确为无需特殊作业）
      </label>
    </>
  )
}
function PersonEditor({ person, onClose }: { person?: Person; onClose: () => void }) {
  const { db, update } = useStore()
  const [draft, setDraft] = useState<Person>(
    person
      ? structuredClone(person)
      : {
          id: uid('person'),
          name: '',
          employeeNo: '',
          simulated: true,
          assignments: [blankAssignment()],
        },
  )
  return (
    <Modal title={person ? '编辑人员' : '新增演示人员'} onClose={onClose} wide>
      <BusinessForm
        onCancel={onClose}
        onSubmit={() => {
          if (db.people.some((p) => p.employeeNo === draft.employeeNo && p.id !== draft.id))
            throw new Error('此工号已经存在。')
          if (draft.assignments.some((a) => a.start && a.end && a.end < a.start))
            throw new Error('结束日期不能早于开始日期。')
          update((d) => ({
            ...d,
            people: person
              ? d.people.map((p) => (p.id === draft.id ? draft : p))
              : [...d.people, draft],
          }))
          onClose()
        }}
      >
        <div className="form-grid">
          <Field
            label="姓名"
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Field
            label="工号"
            required
            value={draft.employeeNo}
            onChange={(e) => setDraft({ ...draft, employeeNo: e.target.value })}
          />
        </div>
        {draft.assignments.map((a, i) => (
          <section className="form-section" key={a.id}>
            <h3>
              {i === 0 ? '主要任职' : '兼岗 ' + i}
              {a.sourceId && <Badge>关联原表</Badge>}
            </h3>
            <AssignmentFields
              a={a}
              onChange={(a) =>
                setDraft({
                  ...draft,
                  assignments: draft.assignments.map((old, k) => (k === i ? a : old)),
                })
              }
            />
          </section>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            setDraft({ ...draft, assignments: [...draft.assignments, blankAssignment()] })
          }
        >
          <Plus size={16} />
          添加兼岗
        </button>
      </BusinessForm>
    </Modal>
  )
}
export function CredentialEditor({
  personId,
  credential,
  typeId,
  onClose,
}: {
  personId: string
  credential?: Credential
  typeId?: string
  onClose: () => void
}) {
  const { db, update } = useStore()
  const [draft, setDraft] = useState<Credential>(
    credential
      ? { ...credential }
      : {
          id: uid('credential'),
          personId,
          typeId: typeId || db.certTypes[0].id,
          rawName: db.certTypes.find((t) => t.id === typeId)?.name || db.certTypes[0].name,
          number: '',
          issued: '',
          expires: '',
          review: '',
          expiryMode: 'dated',
          reviewMode: 'dated',
          registration: '正常',
        },
  )
  const set = (key: keyof Credential, value: string) => setDraft({ ...draft, [key]: value })
  return (
    <Modal title={credential ? '编辑持证记录' : '补录证书'} onClose={onClose}>
      <BusinessForm
        onCancel={onClose}
        onSubmit={() => {
          if (draft.expiryMode === 'dated' && (!draft.expires || draft.expires < draft.issued))
            throw new Error('请填写不早于生效日期的到期日期。')
          if (draft.reviewMode === 'dated' && !draft.review)
            throw new Error('请填写复审日期，或选择无需复审／待确认。')
          update((d) => ({
            ...d,
            credentials: credential
              ? d.credentials.map((c) => (c.id === draft.id ? draft : c))
              : [...d.credentials, draft],
          }))
          onClose()
        }}
      >
        <Select
          label="标准证书"
          value={draft.typeId}
          onChange={(e) =>
            setDraft({
              ...draft,
              typeId: e.target.value,
              rawName: db.certTypes.find((t) => t.id === e.target.value)?.name || draft.rawName,
            })
          }
        >
          <option value="">名称待归并</option>
          {db.certTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Field
          label="原始证书名称"
          required
          value={draft.rawName}
          onChange={(e) => set('rawName', e.target.value)}
        />
        <div className="form-grid">
          <Field
            label="证书编号"
            required
            value={draft.number}
            onChange={(e) => set('number', e.target.value)}
          />
          <Field
            label="生效日期"
            type="date"
            required
            value={draft.issued}
            onChange={(e) => set('issued', e.target.value)}
          />
          <Select
            label="有效期方式"
            value={draft.expiryMode}
            onChange={(e) => set('expiryMode', e.target.value)}
          >
            <option value="dated">指定到期日期</option>
            <option value="permanent">长期有效</option>
            <option value="active">统计日期在岗</option>
            <option value="unknown">待确认</option>
          </Select>
          <Field
            label="到期日期"
            type="date"
            disabled={draft.expiryMode !== 'dated'}
            value={draft.expires}
            onChange={(e) => set('expires', e.target.value)}
          />
          <Select
            label="复审方式"
            value={draft.reviewMode}
            onChange={(e) => set('reviewMode', e.target.value)}
          >
            <option value="dated">指定复审日期</option>
            <option value="none">无需复审</option>
            <option value="active">统计日期在岗</option>
            <option value="unknown">待确认</option>
          </Select>
          <Field
            label="复审日期"
            type="date"
            disabled={draft.reviewMode !== 'dated'}
            value={draft.review}
            onChange={(e) => set('review', e.target.value)}
          />
          <Select
            label="注册状态"
            value={draft.registration}
            onChange={(e) => set('registration', e.target.value)}
          >
            {['正常', '异常', '未知'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            setDraft({
              ...draft,
              number: draft.number || 'DEMO-' + draft.id,
              issued: db.asOf,
              expires: String(Number(db.asOf.slice(0, 4)) + 2) + db.asOf.slice(4),
              review: String(Number(db.asOf.slice(0, 4)) + 1) + db.asOf.slice(4),
              expiryMode: 'dated',
              reviewMode: 'dated',
              registration: '正常',
            })
          }
        >
          填入演示有效日期
        </button>
        <p className="muted">
          日期及注册状态来自录入记录；填入的演示日期不代表制度规定的证书期限。
        </p>
      </BusinessForm>
    </Modal>
  )
}
export default function People() {
  const { db, result, update } = useStore()
  const { id } = useParams(),
    filters = useFilters()
  const listContext = useListContext(!id)
  const [editor, setEditor] = useState<Person | 'new' | null>(null)
  const [credential, setCredential] = useState<{
    personId: string
    credential?: Credential
    typeId?: string
  } | null>(null)
  const [removing, setRemoving] = useState<Credential | null>(null)
  const person = id ? db.people.find((p) => p.id === id) : undefined
  const companies = [
    ...new Set(db.people.flatMap((p) => p.assignments.map((a) => a.company))),
  ].sort()
  if (id && !person)
    return (
      <>
        <Header title="人员不存在" description="返回台账选择其他人员。" />
        <Link className="button secondary" to="/people">
          返回人员台账
        </Link>
      </>
    )
  const pResult = person ? result.people.find((r) => r.personId === person.id)! : undefined
  const rows = db.people.filter((p) => {
    const as = activeAssignments(p, db.asOf),
      s = result.people.find((r) => r.personId === p.id)!
    return (
      (!filters.get('q') ||
        [p.name, p.employeeNo, ...p.assignments.flatMap((a) => [a.company, a.department, a.job])]
          .join(' ')
          .includes(filters.get('q'))) &&
      (!filters.get('company') || as.some((a) => a.company === filters.get('company'))) &&
      (!filters.get('status') ||
        (filters.get('status') === 'active'
          ? as.length > 0
          : filters.get('status') === 'unknown'
            ? s.unknown
            : filters.get('status') === 'eligible'
              ? s.hasMandatory && !s.unknown
              : s.status === filters.get('status')))
    )
  })
  return (
    <>
      {person ? (
        <>
          <Link className="back-link" to={listContext.backTo}>
            <ArrowLeft size={16} />
            人员台账
          </Link>
          <Header
            title={person.name}
            description={person.employeeNo + ' · 模拟人员 · 任职与证书可编辑'}
          >
            <button className="button secondary" onClick={() => setEditor(person)}>
              <Pencil size={16} />
              编辑人员与任职
            </button>
            <button
              className="button primary"
              onClick={() => setCredential({ personId: person.id })}
            >
              <Plus size={16} />
              补录证书
            </button>
          </Header>
          <div className="detail-summary">
            <Status value={pResult!.status} />
            <span>
              {pResult!.requirements.filter((r) => r.result === '有效').length} /{' '}
              {pResult!.requirements.length} 项要求已满足
            </span>
            <Link to={'/issues?person=' + person.id}>
              查看相关问题 <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="assignment-grid">
            {person.assignments.map((a, i) => {
              const source = db.sources.find((s) => s.id === a.sourceId)
              return (
                <section className="panel" key={a.id}>
                  <div className="section-heading">
                    <h2>{i ? '兼岗' : '主要任职'}</h2>
                    <Badge>{a.specialty || '专业待补充'}</Badge>
                  </div>
                  <h3>{canonical(db, 'job', a.standardJob || a.job) || '岗位待补充'}</h3>
                  <p>
                    {a.company} / {canonical(db, 'department', a.department)}
                    {a.team ? ' / ' + a.team : ''}
                  </p>
                  <p className="muted">
                    {a.start || '日期待补充'} 起{a.end ? ' 至 ' + a.end : ''}
                  </p>
                  <div className="tag-list">
                    {a.duties.map((d) => (
                      <Badge key={d}>{d}</Badge>
                    ))}
                  </div>
                  <p>
                    <strong>实际作业：</strong>
                    {a.scopeConfirmed
                      ? a.scopes.join('、') || '无特殊作业'
                      : a.scopes.length
                        ? a.scopes.join('、') + '（待确认）'
                        : '作业范围待确认'}{' '}
                    <Badge tone={a.scopeConfirmed ? 'success' : 'warning'}>
                      {a.scopeConfirmed ? '已确认' : '待确认'}
                    </Badge>
                  </p>
                  {source ? (
                    <details>
                      <summary>查看岗位表原始数据 · 第 {source.row} 行</summary>
                      <dl className="source-grid">
                        {Object.entries({
                          公司: source.company,
                          部门: source.department,
                          班组: source.team,
                          岗位: source.job,
                        }).map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v ?? '（原表空白）'}</dd>
                          </div>
                        ))}
                      </dl>
                      <small>以上为原表内容，其余人员与持证信息均为演示补充。</small>
                    </details>
                  ) : (
                    <Badge>新增演示场景</Badge>
                  )}
                </section>
              )
            })}
          </div>
          <section className="panel">
            <div className="section-heading">
              <h2>应持证要求</h2>
              <span className="muted">同一证书合并显示，保留所有依据</span>
            </div>
            <Table
              pageKey="requirementsPage"
              rows={pResult!.requirements}
              rowKey={(r) => r.certId}
              columns={[
                {
                  key: 'cert',
                  label: '证书要求',
                  render: (r) => (
                    <strong>{db.certTypes.find((t) => t.id === r.certId)?.name}</strong>
                  ),
                },
                {
                  key: 'mode',
                  label: '适用口径',
                  render: (r) => (
                    <Badge>
                      {r.development
                        ? '培养建议'
                        : r.mandatory
                          ? '当期强制'
                          : r.group
                            ? '群体阶段目标'
                            : '过渡期要求'}
                    </Badge>
                  ),
                },
                { key: 'result', label: '已持状态', render: (r) => <Status value={r.result} /> },
                {
                  key: 'basis',
                  label: '判定依据',
                  render: (r) => (
                    <details>
                      <summary>{r.ruleIds.length} 条规则</summary>
                      {r.ruleIds.map((id) => {
                        const rule = db.rules.find((r) => r.id === id)!
                        return (
                          <p key={id}>
                            {rule.title}
                            <br />
                            {rule.basis}
                            {rule.difference && (
                              <>
                                <br />
                                {rule.difference}
                              </>
                            )}
                          </p>
                        )
                      })}
                    </details>
                  ),
                },
                {
                  key: 'action',
                  label: '操作',
                  render: (r) => (
                    <button
                      className="text-button"
                      onClick={() =>
                        setCredential({
                          personId: person.id,
                          credential: r.credential,
                          typeId: r.certId,
                        })
                      }
                    >
                      {r.credential ? '编辑证书' : '补录证书'}
                    </button>
                  ),
                },
              ]}
            />
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>全部持证记录</h2>
            </div>
            <Table
              pageKey="credentialsPage"
              rows={db.credentials.filter((c) => c.personId === person.id)}
              rowKey={(c) => c.id}
              columns={[
                { key: 'name', label: '原始证书名称', value: (c) => c.rawName },
                { key: 'number', label: '证书编号', value: (c) => c.number },
                {
                  key: 'status',
                  label: '状态',
                  render: (c) => <Status value={credentialStatus(c, db.asOf)} />,
                },
                {
                  key: 'expiry',
                  label: '到期／复审',
                  render: (c) => (
                    <>
                      {c.expiryMode === 'permanent' ? '长期有效' : c.expires || '到期待确认'}
                      <small>
                        {c.reviewMode === 'none' ? '无需复审' : c.review || '复审待确认'}
                      </small>
                    </>
                  ),
                },
                {
                  key: 'edit',
                  label: '操作',
                  render: (c) => (
                    <div className="actions">
                      <button
                        className="text-button"
                        onClick={() => setCredential({ personId: person.id, credential: c })}
                      >
                        编辑
                      </button>
                      <button
                        className="icon-button danger-text"
                        aria-label={'删除证书 ' + c.rawName}
                        onClick={() => setRemoving(c)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </section>
        </>
      ) : (
        <>
          <Header
            title="人岗证台账"
            description="关联人员、实际任职与持证记录，从每一项缺口追溯到原始岗位。"
          >
            <button
              className="button secondary"
              onClick={() => exportTable('人员岗位台账', personnelExport({ ...db, people: rows }))}
            >
              <Download size={16} />
              导出筛选结果
            </button>
            <button className="button primary" onClick={() => setEditor('new')}>
              <Plus size={17} />
              新增人员
            </button>
          </Header>
          <div className="toolbar">
            <SearchField value={filters.get('q')} onChange={(v) => filters.set('q', v)} />
            <CompanyFilter
              companies={companies}
              value={filters.get('company')}
              onChange={(v) => filters.set('company', v)}
            />
            <Select
              label="判定状态"
              value={filters.get('status')}
              onChange={(e) => filters.set('status', e.target.value)}
            >
              <option value="">全部状态</option>
              {['合规', '不合规', '待确认', '无当期强制要求'].map((s) => (
                <option key={s}>{s}</option>
              ))}
              <option value="active">统计日期在岗</option>
              <option value="unknown">判定信息不足</option>
              <option value="eligible">纳入当期个人合规率</option>
            </Select>
          </div>
          <Table
            rows={rows}
            rowKey={(p) => p.id}
            mobileRender={(p) => {
              const r = result.people.find((r) => r.personId === p.id)!
              const missing = r.requirements.filter((q) => q.result !== '有效')
              return (
                <>
                  <div className="mobile-record-heading">
                    <Link
                      className="person-cell"
                      to={'/people/' + p.id}
                      state={listContext.state}
                      onClick={listContext.remember}
                    >
                      <span className="avatar">{p.name.slice(0, 1)}</span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.employeeNo}</small>
                      </span>
                    </Link>
                    <Status value={r.status} />
                  </div>
                  <p className="record-position">
                    {p.assignments[0]?.company} · {p.assignments[0]?.job || '岗位待补充'}
                  </p>
                  <p className="record-gap">
                    {r.unknown
                      ? '先补充判定信息'
                      : missing.length
                        ? `${missing.length} 项要求尚未满足`
                        : r.requirements.length
                          ? '已满足全部已配置要求'
                          : '暂无已配置要求'}
                  </p>
                  {missing.length > 0 && (
                    <p className="muted">
                      {missing
                        .slice(0, 2)
                        .map(
                          (q) =>
                            (db.certTypes.find((c) => c.id === q.certId)?.name || '证书') +
                            ' · ' +
                            q.result,
                        )
                        .join('；')}
                      {missing.length > 2 ? ` 等 ${missing.length} 项` : ''}
                    </p>
                  )}
                  <div className="mobile-record-footer">
                    <span className="muted">
                      满足 {r.requirements.length - missing.length}/{r.requirements.length} 项 ·
                      含培养要求
                    </span>
                    <Link
                      className="text-button"
                      to={'/people/' + p.id}
                      state={listContext.state}
                      onClick={listContext.remember}
                    >
                      查看详情 <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </>
              )
            }}
            columns={[
              {
                key: 'person',
                label: '人员',
                pin: 'start',
                value: (p) => p.name,
                render: (p) => (
                  <Link
                    className="person-cell"
                    to={'/people/' + p.id}
                    state={listContext.state}
                    onClick={listContext.remember}
                  >
                    <span className="avatar">{p.name.slice(0, 1)}</span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.employeeNo}</small>
                    </span>
                  </Link>
                ),
              },
              {
                key: 'company',
                label: '公司／部门',
                value: (p) => p.assignments[0]?.company,
                render: (p) => (
                  <>
                    {p.assignments[0]?.company}
                    <small>{canonical(db, 'department', p.assignments[0]?.department || '')}</small>
                  </>
                ),
              },
              {
                key: 'job',
                label: '岗位／专业',
                value: (p) => p.assignments[0]?.job,
                render: (p) => (
                  <>
                    {p.assignments[0]?.job || <Badge>岗位待补充</Badge>}
                    <small>
                      {p.assignments[0]?.specialty || '专业待补充'}
                      {p.assignments.length > 1 ? ' · ' + p.assignments.length + ' 个任职' : ''}
                    </small>
                  </>
                ),
              },
              {
                key: 'coverage',
                label: '已满足／应满足',
                render: (p) => {
                  const r = result.people.find((r) => r.personId === p.id)!
                  return (
                    <>
                      {r.requirements.filter((x) => x.result === '有效').length} /{' '}
                      {r.requirements.length}
                      <small>含培养要求</small>
                    </>
                  )
                },
              },
              {
                key: 'status',
                label: '当期状态',
                render: (p) => (
                  <Status value={result.people.find((r) => r.personId === p.id)!.status} />
                ),
              },
              {
                key: 'source',
                label: '来源',
                render: (p) => (
                  <Badge>{p.assignments[0]?.sourceId ? '岗位示例表' : '补充演示'}</Badge>
                ),
              },
              {
                key: 'action',
                label: '操作',
                pin: 'end',
                render: (p) => (
                  <Link
                    className="text-button"
                    to={'/people/' + p.id}
                    state={listContext.state}
                    onClick={listContext.remember}
                  >
                    查看详情
                  </Link>
                ),
              },
            ]}
          />
        </>
      )}
      {editor && (
        <PersonEditor
          person={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {credential && <CredentialEditor {...credential} onClose={() => setCredential(null)} />}
      {removing && (
        <Confirm
          title="删除持证记录"
          description={'删除“' + removing.rawName + '”后，系统将重新计算持证缺口。'}
          onClose={() => setRemoving(null)}
          onConfirm={() =>
            update(
              (d) => ({ ...d, credentials: d.credentials.filter((c) => c.id !== removing.id) }),
              '持证记录已删除',
            )
          }
        />
      )}
    </>
  )
}
