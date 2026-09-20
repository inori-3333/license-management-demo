import { useState } from 'react'
import { Plus, Pencil, BookOpen } from 'lucide-react'
import { useStore } from '../store'
import { uid, split, type CertType, type Category, type Rule } from '../model'
import { RuleConditions } from '../components/RuleConditions'
import {
  Badge,
  Field,
  BusinessForm,
  Header,
  ListField,
  Modal,
  SearchField,
  Select,
  Table,
  Tabs,
  TextAreaField,
  useFilters,
} from '../ui'
export default function Rules() {
  const { db, update } = useStore(),
    f = useFilters({ tab: 'rules' })
  const [rule, setRule] = useState<Rule | null>(null),
    [cert, setCert] = useState<CertType | null>(null),
    [category, setCategory] = useState<Category | null>(null)
  const newRule = (): Rule => ({
    id: uid('rule'),
    title: '',
    certId: db.certTypes[0].id,
    specialties: [],
    jobs: [],
    duties: [],
    scopes: [],
    mode: 'individual',
    deadline: db.asOf,
    milestones: [],
    enabled: true,
    basis: '自定义演示规则',
    difference: '',
  })
  const categoryName = (id: string) => db.categories.find((c) => c.id === id)?.name || ''
  return (
    <>
      <Header
        title="证书与持证规则"
        description="把证书类别、适用条件和时间要求变成可编辑的业务配置。"
      >
        <button
          className="button secondary"
          onClick={() => setCategory({ id: uid('category'), name: '', mandatory: true })}
        >
          <Plus size={16} />
          新增类别
        </button>
        <button
          className="button primary"
          onClick={() =>
            f.get('tab') === 'certs'
              ? setCert({
                  id: uid('cert'),
                  name: '',
                  categoryId: db.categories[0].id,
                  family: uid('family'),
                  level: 1,
                  scope: '',
                  basis: '自定义演示证书',
                })
              : setRule(newRule())
          }
        >
          <Plus size={16} />
          {f.get('tab') === 'certs' ? '新增证书类型' : '新增规则'}
        </button>
      </Header>
      <details className="policy-disclosure">
        <summary>
          <BookOpen size={17} /> 统计口径与来源差异
        </summary>
        <div>
          <strong>本 Demo 采用正文优先口径</strong>
          <p>
            法务按 2027 年底 80%、2028 年底
            100%；财务按人员层级及正文期限。集团证书采用正文适用范围，差异在各规则中保留。
          </p>
        </div>
      </details>
      <details className="category-disclosure">
        <summary>管理证书类别（{db.categories.length}）</summary>
        <div className="category-row">
          {db.categories.map((c) => (
            <button key={c.id} onClick={() => setCategory({ ...c })}>
              <span>{c.name}</span>
              <Badge>{c.mandatory ? '管控' : '培养'}</Badge>
              <Pencil size={13} />
            </button>
          ))}
        </div>
      </details>
      <Tabs
        value={f.get('tab')}
        onChange={(v) => f.set('tab', v)}
        items={[
          { id: 'rules', label: '持证规则', count: db.rules.length },
          { id: 'certs', label: '证书目录', count: db.certTypes.length },
        ]}
      />
      <div className="toolbar">
        <SearchField
          placeholder="搜索规则或证书名称"
          value={f.get('q')}
          onChange={(v) => f.set('q', v)}
        />
        <Select
          label="证书类别"
          value={f.get('category')}
          onChange={(e) => f.set('category', e.target.value)}
        >
          <option value="">全部类别</option>
          {db.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {f.get('tab') === 'rules' ? (
        <Table
          rows={db.rules.filter(
            (r) =>
              r.title.includes(f.get('q')) &&
              (!f.get('category') ||
                db.certTypes.find((c) => c.id === r.certId)?.categoryId === f.get('category')),
          )}
          rowKey={(r) => r.id}
          columns={[
            {
              key: 'name',
              label: '持证规则',
              pin: 'start',
              value: (r) => r.title,
              render: (r) => (
                <>
                  <strong>{r.title}</strong>
                  <small>
                    {categoryName(db.certTypes.find((c) => c.id === r.certId)!.categoryId)}
                  </small>
                  <details className="rule-basis">
                    <summary>查看依据{r.difference ? '与来源差异' : ''}</summary>
                    <p>{r.basis || '依据待补充'}</p>
                    {r.difference && (
                      <p>
                        <strong>来源差异：</strong>
                        {r.difference}
                      </p>
                    )}
                  </details>
                </>
              ),
            },
            {
              key: 'scope',
              label: '适用条件',
              render: (r) => <RuleConditions rule={r} />,
            },
            {
              key: 'mode',
              label: '管理方式',
              render: (r) => (
                <Badge>
                  {r.mode === 'group'
                    ? '群体阶段比例'
                    : r.mode === 'development'
                      ? '培养建议'
                      : '个人持证'}
                </Badge>
              ),
            },
            {
              key: 'date',
              label: '达标节点',
              render: (r) =>
                r.mode === 'group'
                  ? r.milestones.map((m) => (
                      <small key={m.date}>
                        {m.date} · {m.ratio * 100}%
                      </small>
                    ))
                  : r.mode === 'development'
                    ? '—'
                    : r.deadline || '立即',
            },
            {
              key: 'state',
              label: '状态',
              render: (r) => (
                <Badge tone={r.enabled ? 'success' : 'neutral'}>
                  {r.enabled ? '启用' : '停用'}
                </Badge>
              ),
            },
            {
              key: 'action',
              label: '操作',
              pin: 'end',
              render: (r) => (
                <button className="text-button" onClick={() => setRule(structuredClone(r))}>
                  编辑规则
                </button>
              ),
            },
          ]}
        />
      ) : (
        <Table
          rows={db.certTypes.filter(
            (c) =>
              c.name.includes(f.get('q')) &&
              (!f.get('category') || c.categoryId === f.get('category')),
          )}
          rowKey={(c) => c.id}
          columns={[
            { key: 'name', label: '证书名称', pin: 'start', value: (c) => c.name },
            { key: 'category', label: '类别', value: (c) => categoryName(c.categoryId) },
            { key: 'level', label: '等级', value: (c) => c.level },
            { key: 'scope', label: '制度适用范围', value: (c) => c.scope },
            {
              key: 'action',
              label: '操作',
              pin: 'end',
              render: (c) => (
                <button className="text-button" onClick={() => setCert({ ...c })}>
                  编辑证书
                </button>
              ),
            },
          ]}
        />
      )}
      {category && (
        <Modal title="证书类别" onClose={() => setCategory(null)}>
          <BusinessForm
            onCancel={() => setCategory(null)}
            onSubmit={() => {
              if (db.categories.some((c) => c.id !== category.id && c.name === category.name))
                throw new Error('类别名称已存在。')
              update((d) => ({
                ...d,
                categories: d.categories.some((c) => c.id === category.id)
                  ? d.categories.map((c) => (c.id === category.id ? category : c))
                  : [...d.categories, category],
              }))
              setCategory(null)
            }}
          >
            <Field
              label="类别名称"
              required
              value={category.name}
              onChange={(e) => setCategory({ ...category, name: e.target.value })}
            />
            <Select
              label="管理性质"
              value={category.mandatory ? 'mandatory' : 'development'}
              onChange={(e) =>
                setCategory({ ...category, mandatory: e.target.value === 'mandatory' })
              }
            >
              <option value="mandatory">管控类：按规则要求持证</option>
              <option value="development">培养类：仅作为能力提升建议</option>
            </Select>
          </BusinessForm>
        </Modal>
      )}
      {cert && (
        <Modal title="证书类型" onClose={() => setCert(null)}>
          <BusinessForm
            onCancel={() => setCert(null)}
            onSubmit={() => {
              if (db.certTypes.some((c) => c.id !== cert.id && c.name === cert.name))
                throw new Error('证书名称已存在。')
              update((d) => ({
                ...d,
                certTypes: d.certTypes.some((c) => c.id === cert.id)
                  ? d.certTypes.map((c) => (c.id === cert.id ? cert : c))
                  : [...d.certTypes, cert],
              }))
              setCert(null)
            }}
          >
            <Field
              label="证书名称"
              required
              value={cert.name}
              onChange={(e) => setCert({ ...cert, name: e.target.value })}
            />
            <Select
              label="证书类别"
              value={cert.categoryId}
              onChange={(e) => setCert({ ...cert, categoryId: e.target.value })}
            >
              {db.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="form-grid">
              <Field
                label="等级数值"
                type="number"
                min="1"
                required
                value={cert.level}
                onChange={(e) => setCert({ ...cert, level: Number(e.target.value) })}
              />
              <Field
                label="同系列标识"
                required
                value={cert.family}
                onChange={(e) => setCert({ ...cert, family: e.target.value })}
                hint="仅同系列高等级可满足低等级要求"
              />
            </div>
            <TextAreaField
              label="适用人员范围"
              value={cert.scope}
              onChange={(scope) => setCert({ ...cert, scope })}
            />
            <TextAreaField
              label="依据"
              value={cert.basis}
              onChange={(basis) => setCert({ ...cert, basis })}
            />
          </BusinessForm>
        </Modal>
      )}
      {rule && (
        <Modal title="编辑持证规则" onClose={() => setRule(null)} wide>
          <BusinessForm
            onCancel={() => setRule(null)}
            onSubmit={() => {
              if (rule.mode === 'group' && !rule.milestones.length)
                throw new Error('群体规则至少添加一个阶段目标。')
              if (new Set(rule.milestones.map((m) => m.date)).size !== rule.milestones.length)
                throw new Error('阶段目标日期不能重复。')
              const saved = {
                ...rule,
                milestones: [...rule.milestones].sort((a, b) => a.date.localeCompare(b.date)),
              }
              update((d) => ({
                ...d,
                rules: d.rules.some((r) => r.id === saved.id)
                  ? d.rules.map((r) => (r.id === saved.id ? saved : r))
                  : [...d.rules, saved],
              }))
              setRule(null)
            }}
          >
            <div className="form-grid">
              <Field
                label="规则名称"
                required
                value={rule.title}
                onChange={(e) => setRule({ ...rule, title: e.target.value })}
              />
              <Select
                label="要求证书"
                value={rule.certId}
                onChange={(e) => setRule({ ...rule, certId: e.target.value })}
              >
                {db.certTypes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                label="管理方式"
                value={rule.mode}
                onChange={(e) => setRule({ ...rule, mode: e.target.value as Rule['mode'] })}
              >
                <option value="individual">个人持证要求</option>
                <option value="group">群体阶段比例</option>
                <option value="development">培养建议</option>
              </Select>
              <Field
                label="个人达标期限"
                type="date"
                value={rule.deadline}
                onChange={(e) => setRule({ ...rule, deadline: e.target.value })}
                disabled={rule.mode !== 'individual'}
              />
            </div>
            <h3>适用条件</h3>
            <p className="muted">
              不同条件组同时满足，同组任一项匹配即可；留空表示该组不限。作业范围还需要人员明确确认。
            </p>
            <div className="form-grid">
              {(
                [
                  { key: 'specialties', label: '专业' },
                  { key: 'jobs', label: '标准岗位' },
                  { key: 'duties', label: '职责标签' },
                  { key: 'scopes', label: '实际作业范围' },
                ] as const
              ).map((x) => (
                <ListField
                  key={x.key}
                  label={x.label}
                  values={rule[x.key]}
                  onChange={(v) => setRule({ ...rule, [x.key]: v })}
                  hint="多个值用逗号分隔"
                />
              ))}
            </div>
            {rule.mode === 'group' && (
              <section className="form-section">
                <div className="section-heading">
                  <h3>阶段目标</h3>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      setRule({
                        ...rule,
                        milestones: [...rule.milestones, { date: '2027-12-31', ratio: 1 }],
                      })
                    }
                  >
                    添加阶段
                  </button>
                </div>
                {rule.milestones.map((m, i) => (
                  <div className="milestone-edit" key={i}>
                    <Field
                      label="达标日期"
                      required
                      type="date"
                      value={m.date}
                      onChange={(e) =>
                        setRule({
                          ...rule,
                          milestones: rule.milestones.map((o, k) =>
                            k === i ? { ...o, date: e.target.value } : o,
                          ),
                        })
                      }
                    />
                    <Field
                      label="目标持证率（%）"
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={Math.round(m.ratio * 100)}
                      onChange={(e) =>
                        setRule({
                          ...rule,
                          milestones: rule.milestones.map((o, k) =>
                            k === i ? { ...o, ratio: Number(e.target.value) / 100 } : o,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="text-button danger-text"
                      onClick={() =>
                        setRule({ ...rule, milestones: rule.milestones.filter((_, k) => k !== i) })
                      }
                    >
                      移除
                    </button>
                  </div>
                ))}
              </section>
            )}
            <TextAreaField
              label="制度依据／演示口径"
              value={rule.basis}
              onChange={(basis) => setRule({ ...rule, basis })}
            />
            <TextAreaField
              label="正文与附件差异"
              value={rule.difference}
              onChange={(difference) => setRule({ ...rule, difference })}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
              />
              启用此规则，保存后立即重新计算
            </label>
            <p className="muted">
              国家及其他管控类别的新上岗人员，自 2027-01-01
              起按先持证后上岗执行，不享受个人或群体过渡期。
            </p>
          </BusinessForm>
        </Modal>
      )}
    </>
  )
}
