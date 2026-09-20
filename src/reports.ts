import {
  activeAssignments,
  type DB,
  type Evaluation,
  type PersonResult,
  type ReportConfig,
} from './model'
import { canonical, evaluate, metrics } from './engine'
export const reportTypes = [
  { id: 'units', label: '单位合规分析' },
  { id: 'distribution', label: '专业／岗位／证书分布' },
  { id: 'missing', label: '应持未持清单' },
  { id: 'expiry', label: '临期与复审清单' },
  { id: 'groups', label: '阶段目标进度' },
  { id: 'remediation', label: '整改进度' },
]
export const groupTypes = [
  { id: 'company', label: '公司' },
  { id: 'department', label: '部门' },
  { id: 'specialty', label: '专业' },
  { id: 'job', label: '岗位' },
  { id: 'certificate', label: '证书类型' },
  { id: 'category', label: '证书类别' },
]
export const defaultReport: ReportConfig = {
  id: '',
  name: '',
  type: 'units',
  group: 'company',
  company: '',
  specialty: '',
  category: '',
  columns: [],
}
export const unitSummaryColumns = ['分组', '人员数', '人员合规率', '应持证项完成率', '待确认人数']
export function scopedResults(
  db: DB,
  result: Evaluation,
  c: Pick<ReportConfig, 'company' | 'specialty' | 'category'>,
) {
  const ids = new Set(
    db.people
      .filter((p) =>
        activeAssignments(p, db.asOf).some(
          (a) =>
            (!c.company || a.company === c.company) &&
            (!c.specialty || a.specialty === c.specialty),
        ),
      )
      .map((p) => p.id),
  )
  return result.people
    .filter((r) => ids.has(r.personId))
    .map((r) => {
      const requirements = r.requirements.filter(
        (q) =>
          !c.category || db.certTypes.find((t) => t.id === q.certId)?.categoryId === c.category,
      )
      const p = db.people.find((p) => p.id === r.personId)!
      const unknown =
        activeAssignments(p, db.asOf).some(
          (a) => !a.job || !a.specialty || !a.start || !a.scopeConfirmed,
        ) || requirements.some((q) => !q.development && q.result === '待确认')
      const hasMandatory = requirements.some((q) => q.mandatory)
      return {
        ...r,
        requirements,
        unknown,
        hasMandatory,
        status: requirements.some((q) => q.mandatory && !['有效', '待确认'].includes(q.result))
          ? '不合规'
          : unknown
            ? '待确认'
            : hasMandatory
              ? '合规'
              : '无当期强制要求',
      } as PersonResult
    })
}
export function buildReport(
  db: DB,
  result: Evaluation,
  c: ReportConfig,
): Record<string, string | number | null>[] {
  const selected = scopedResults(db, result, c),
    ids = new Set(selected.map((r) => r.personId))
  const certName = (id?: string) => db.certTypes.find((t) => t.id === id)?.name || '—'
  const categoryName = (id: string) =>
    db.categories.find((x) => x.id === db.certTypes.find((t) => t.id === id)?.categoryId)?.name ||
    ''
  if (['units', 'distribution'].includes(c.type)) {
    const groups = new Map<string, PersonResult[]>()
    for (const r of selected) {
      const p = db.people.find((p) => p.id === r.personId)!
      const assignments = activeAssignments(p, db.asOf).filter(
        (a) =>
          (!c.company || a.company === c.company) && (!c.specialty || a.specialty === c.specialty),
      )
      const group = c.type === 'units' ? 'company' : c.group
      const keys =
        group === 'certificate'
          ? r.requirements.map((q) => certName(q.certId))
          : group === 'category'
            ? r.requirements.map((q) => categoryName(q.certId))
            : assignments.map((a) =>
                group === 'department'
                  ? a.company + ' / ' + canonical(db, 'department', a.department)
                  : group === 'job'
                    ? canonical(db, 'job', a.standardJob || a.job) || '岗位待补充'
                    : group === 'specialty'
                      ? a.specialty || '专业待补充'
                      : a.company,
              )
      for (const key of new Set(keys)) {
        const subset =
          group === 'certificate'
            ? r.requirements.filter((q) => certName(q.certId) === key)
            : group === 'category'
              ? r.requirements.filter((q) => categoryName(q.certId) === key)
              : r.requirements
        const item = { ...r, requirements: subset, hasMandatory: subset.some((q) => q.mandatory) }
        item.status = subset.some((q) => q.mandatory && !['有效', '待确认'].includes(q.result))
          ? '不合规'
          : item.unknown
            ? '待确认'
            : item.hasMandatory
              ? '合规'
              : '无当期强制要求'
        groups.set(key, [...(groups.get(key) || []), item])
      }
    }
    return [...groups]
      .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
      .map(([name, items]) => {
        const m = metrics(items)
        return {
          分组: name,
          人员数: m.total,
          可判定人数: m.total - m.unknown,
          纳入合规率人数: m.eligible,
          合规人数: m.compliant,
          人员合规率: m.compliance,
          应持项数: m.required,
          有效已持项数: m.held,
          应持证项完成率: m.completion,
          统计覆盖率: m.coverage,
          待确认人数: m.unknown,
        }
      })
  }
  if (c.type === 'missing')
    return selected.flatMap((r) => {
      const p = db.people.find((p) => p.id === r.personId)!,
        a = activeAssignments(p, db.asOf)[0]
      return r.requirements
        .filter((q) => !q.development && q.result !== '有效')
        .map((q) => ({
          工号: p.employeeNo,
          姓名: p.name,
          公司: a?.company || '',
          专业: a?.specialty || '',
          证书要求: certName(q.certId),
          持证状态: q.result,
          要求口径: q.mandatory ? '当期强制' : q.group ? '群体阶段' : '过渡期',
          达标期限: q.deadline,
        }))
    })
  if (c.type === 'expiry')
    return result.findings
      .filter(
        (i) =>
          i.personId &&
          ids.has(i.personId) &&
          (!c.company || i.company === c.company) &&
          ['证书临期', '复审提醒', '已过期', '复审逾期'].includes(i.kind) &&
          (!c.expiryDays ||
            (['证书临期', '复审提醒'].includes(i.kind) &&
              i.days !== undefined &&
              i.days >= 0 &&
              i.days <= c.expiryDays)) &&
          (!c.category || db.certTypes.find((t) => t.id === i.certId)?.categoryId === c.category),
      )
      .map((i) => ({
        工号: db.people.find((p) => p.id === i.personId)!.employeeNo,
        姓名: db.people.find((p) => p.id === i.personId)!.name,
        公司: i.company,
        证书: certName(i.certId),
        类型: i.kind,
        期限: i.due,
        剩余天数: i.days ?? null,
        说明: i.detail,
      }))
  if (c.type === 'groups')
    return (
      c.specialty
        ? evaluate({
            ...db,
            people: db.people.map((p) => ({
              ...p,
              assignments: activeAssignments(p, db.asOf).filter((a) => a.specialty === c.specialty),
            })),
          }).groups
        : result.groups
    )
      .filter(
        (g) =>
          (!c.company || g.company === c.company) &&
          (!c.category || db.certTypes.find((t) => t.id === g.certId)?.categoryId === c.category) &&
          (!c.specialty ||
            db.people.some(
              (p) =>
                ids.has(p.id) &&
                activeAssignments(p, db.asOf).some((a) => a.company === g.company) &&
                selected
                  .find((r) => r.personId === p.id)
                  ?.requirements.some((q) => q.ruleIds.includes(g.ruleId)),
            )),
      )
      .map((g) => ({
        公司: g.company,
        证书: certName(g.certId),
        范围人数: g.total,
        有效持证人数: g.held,
        待确认人数: g.unknown,
        持证率: g.ratio,
        当前目标比例: g.target,
        下一目标比例: g.nextTarget,
        目标日期: g.deadline,
        目标缺口人数: g.gap,
      }))
  return db.issues
    .filter(
      (i) =>
        (!i.personId || ids.has(i.personId)) &&
        (!c.company || i.company === c.company) &&
        (!c.category || db.certTypes.find((t) => t.id === i.certId)?.categoryId === c.category),
    )
    .map((i) => ({
      公司: i.company,
      人员: db.people.find((p) => p.id === i.personId)?.name || '群体目标',
      问题: i.title,
      类型: i.kind,
      整改阶段: i.state,
      负责人: i.assignee,
      复核人: i.reviewer,
      当前校验: result.findings.some((f) => f.id === i.id) ? '仍需处理' : '已修复',
      处理次数: i.history.length,
    }))
}
