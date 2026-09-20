import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, UsersRound } from 'lucide-react'
import { useStore } from '../store'
import { credentialStatus, evaluateTarget } from '../engine'
import { type Assignment } from '../model'
import { exportTable } from '../io'
import { AssignmentFields } from './People'
import { SearchPicker } from '../components/SearchPicker'
import { Badge, CompanyFilter, Header, SearchField, Select, Status, Table, useFilters } from '../ui'
export default function Talent() {
  const { db } = useStore(),
    f = useFilters()
  const targets = [
    ...new Map(
      db.people
        .flatMap((p) => p.assignments)
        .filter((a) => a.job)
        .map((a) => [a.job + '|' + a.specialty, a]),
    ).values(),
  ]
  const initial = db.people.find((p) => p.id === 'scene-storage')?.assignments[0] || targets[0]
  const [target, setTarget] = useState<Assignment>({
    ...initial,
    id: 'target',
    sourceId: undefined,
    start: db.asOf,
    end: '',
  })
  const [selected, setSelected] = useState<string[]>([])
  const matchDate = target.start > db.asOf ? target.start : db.asOf
  const results = useMemo(
    () =>
      db.people.map((p) => {
        const { result } = evaluateTarget(db, p, target)
        const reqs = result.requirements.filter((r) => !r.development),
          held = reqs.filter((r) => r.result === '有效').length
        const status = result.unknown
          ? '待确认'
          : !reqs.length
            ? '无已配置要求'
            : held === reqs.length
              ? '满足证书条件'
              : '存在取证缺口'
        return { person: p, result, reqs, held, status }
      }),
    [db, target],
  )
  const rows = results
    .filter(
      (r) =>
        (!f.get('q') || [r.person.name, r.person.employeeNo].join(' ').includes(f.get('q'))) &&
        (!f.get('company') || r.person.assignments.some((a) => a.company === f.get('company'))) &&
        (!f.get('match') || r.status === f.get('match')),
    )
    .sort((a, b) => b.held - a.held)
  const training = rows
    .filter((r) => !selected.length || selected.includes(r.person.id))
    .flatMap((r) =>
      r.reqs
        .filter((q) => q.result !== '有效')
        .map((q) => ({
          工号: r.person.employeeNo,
          姓名: r.person.name,
          当前公司: r.person.assignments[0]?.company,
          目标岗位: target.job,
          资格评估日期: matchDate,
          目标作业范围: target.scopes.join('，'),
          培训或补证项目: db.certTypes.find((t) => t.id === q.certId)?.name,
          当前状态: q.result,
          建议:
            q.result === '待确认'
              ? '先补充或确认信息'
              : q.result === '缺证'
                ? '安排培训取证'
                : '安排复审或证书更新',
        })),
    )
  const companies = [
    ...new Set(db.people.flatMap((p) => p.assignments.map((a) => a.company))),
  ].sort()
  return (
    <>
      <Header
        title="人才画像与岗位匹配"
        description="基于明确的岗位职责与证书条件筛选人员，将资格缺口转成培训需求。"
      >
        <button
          className="button primary"
          disabled={!training.length}
          onClick={() => exportTable('目标岗位培训需求', training)}
        >
          <Download size={16} />
          导出培训需求{selected.length ? '（已选 ' + selected.length + ' 人）' : ''}
        </button>
      </Header>
      <section className="panel">
        <div className="section-heading">
          <h2>目标岗位条件</h2>
          <Badge>资格评估日期 {matchDate}</Badge>
        </div>
        <div className="toolbar">
          <SearchPicker
            label="选择目标岗位"
            value={
              targets.find((a) => a.job === target.job && a.specialty === target.specialty)?.id ||
              ''
            }
            options={targets.map((a) => ({
              id: a.id,
              label: a.job,
              group: a.specialty || '专业待确认',
            }))}
            onChange={(id) => {
              const a = targets.find((a) => a.id === id)!
              setTarget({ ...a, id: 'target', sourceId: undefined, start: db.asOf, end: '' })
              setSelected([])
            }}
          />
          <div className="target-summary">
            <strong>{target.job}</strong>
            <span>
              {target.scopeConfirmed
                ? (target.scopes.join('、') || '无特殊作业') + ' · 范围已确认'
                : (target.scopes.join('、') || '作业范围') + ' · 待确认'}
            </span>
          </div>
        </div>
        <details>
          <summary>调整目标专业、职责、作业范围与上岗日期</summary>
          <AssignmentFields
            a={target}
            onChange={(a) => {
              setTarget(a)
              setSelected([])
            }}
          />
        </details>
      </section>
      <div className="talent-summary">
        <UsersRound size={23} />
        <strong>{results.filter((r) => r.status === '满足证书条件').length}</strong>
        <span>人满足当前目标的全部管控类证书要求</span>
        <Badge>仅呈现可解释的资格条件</Badge>
      </div>
      <div className="toolbar">
        <SearchField
          value={f.get('q')}
          onChange={(v) => {
            f.set('q', v)
            setSelected([])
          }}
        />
        <CompanyFilter
          companies={companies}
          value={f.get('company')}
          onChange={(v) => {
            f.set('company', v)
            setSelected([])
          }}
        />
        <Select
          label="匹配结果"
          value={f.get('match')}
          onChange={(e) => {
            f.set('match', e.target.value)
            setSelected([])
          }}
        >
          <option value="">全部结果</option>
          {['满足证书条件', '存在取证缺口', '待确认', '无已配置要求'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
        {selected.length > 0 && (
          <button className="text-button" onClick={() => setSelected([])}>
            清除选择（{selected.length}）
          </button>
        )}
      </div>
      <Table
        rows={rows}
        rowKey={(r) => r.person.id}
        columns={[
          {
            key: 'select',
            label: '选择人员',
            render: (r) => (
              <input
                type="checkbox"
                aria-label={'选择 ' + r.person.employeeNo}
                checked={selected.includes(r.person.id)}
                onChange={() =>
                  setSelected(
                    selected.includes(r.person.id)
                      ? selected.filter((id) => id !== r.person.id)
                      : [...selected, r.person.id],
                  )
                }
              />
            ),
          },
          {
            key: 'person',
            label: '人员画像',
            render: (r) => (
              <Link className="person-cell" to={'/people/' + r.person.id}>
                <span className="avatar">{r.person.name.slice(0, 1)}</span>
                <span>
                  <strong>{r.person.name}</strong>
                  <small>{r.person.employeeNo}</small>
                </span>
              </Link>
            ),
          },
          {
            key: 'current',
            label: '当前任职',
            render: (r) => (
              <>
                {r.person.assignments[0]?.job || '岗位待补充'}
                <small>
                  {r.person.assignments[0]?.company} · {r.person.assignments[0]?.specialty}
                </small>
              </>
            ),
          },
          {
            key: 'tags',
            label: '持证与技能标签',
            render: (r) => (
              <div className="tag-list">
                {db.credentials
                  .filter(
                    (c) => c.personId === r.person.id && credentialStatus(c, matchDate) === '有效',
                  )
                  .slice(0, 3)
                  .map((c) => (
                    <Badge key={c.id}>
                      {db.certTypes.find((t) => t.id === c.typeId)?.name || c.rawName}
                    </Badge>
                  ))}
                <Link className="text-button" to={'/people/' + r.person.id}>
                  完整画像
                </Link>
              </div>
            ),
          },
          {
            key: 'match',
            label: '资格匹配',
            render: (r) => (
              <>
                <Badge
                  tone={
                    r.status === '满足证书条件'
                      ? 'success'
                      : r.status === '待确认'
                        ? 'neutral'
                        : 'warning'
                  }
                >
                  {r.status}
                </Badge>
                <small>
                  {r.held} / {r.reqs.length} 项管控要求已满足
                </small>
              </>
            ),
          },
          {
            key: 'gap',
            label: '取证缺口与待确认项',
            render: (r) => (
              <div className="tag-list">
                {r.reqs
                  .filter((q) => q.result !== '有效')
                  .map((q) => (
                    <span className="gap-item" key={q.certId}>
                      {db.certTypes.find((c) => c.id === q.certId)?.name}
                      <Status value={q.result} />
                    </span>
                  ))}
                {!r.reqs.length && <span>为目标岗位配置持证规则后再匹配</span>}
                {r.result.unknown && <small>请核实目标岗位范围及相关证书信息。</small>}
              </div>
            ),
          },
        ]}
      />
    </>
  )
}
