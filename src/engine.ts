import {
  activeAssignments,
  type Assignment,
  type CertResult,
  type Credential,
  type DB,
  type Evaluation,
  type Finding,
  type GroupResult,
  type Person,
  type PersonResult,
  type Requirement,
  type Rule,
} from './model'
const DAY = 86400000
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY)
export const canonical = (db: DB, kind: 'job' | 'cert' | 'department', raw: string) =>
  db.aliases.find((a) => a.kind === kind && a.raw === raw)?.standard || raw
export function baseMatches(db: DB, a: Assignment, r: Rule) {
  const job = canonical(db, 'job', a.standardJob || a.job)
  return (
    (!r.specialties.length || r.specialties.includes(a.specialty)) &&
    (!r.jobs.length || r.jobs.includes(job)) &&
    (!r.duties.length || r.duties.some((d) => a.duties.includes(d)))
  )
}
export function matches(db: DB, a: Assignment, r: Rule) {
  return (
    baseMatches(db, a, r) &&
    (!r.scopes.length || (a.scopeConfirmed && r.scopes.some((s) => a.scopes.includes(s))))
  )
}
export function credentialTypeId(db: DB, c: Credential) {
  return c.typeId || db.certTypes.find((t) => t.name === canonical(db, 'cert', c.rawName))?.id || ''
}
export function credentialStatus(c: Credential, asOf: string): CertResult {
  if (c.issued && c.issued > asOf) return '尚未生效'
  if (c.registration === '异常') return '注册异常'
  if (c.expiryMode === 'dated' && c.expires && c.expires < asOf) return '已过期'
  if (c.reviewMode === 'dated' && c.review && c.review < asOf) return '复审逾期'
  if (
    !c.issued ||
    c.registration === '未知' ||
    c.expiryMode === 'unknown' ||
    (c.expiryMode === 'dated' && !c.expires) ||
    c.reviewMode === 'unknown' ||
    (c.reviewMode === 'dated' && !c.review)
  )
    return '待确认'
  return '有效'
}
export function bestCredential(
  db: DB,
  personId: string,
  requiredId: string,
  asOf: string,
  records?: Credential[],
) {
  const required = db.certTypes.find((c) => c.id === requiredId)!
  const rank: CertResult[] = ['有效', '待确认', '注册异常', '复审逾期', '已过期', '尚未生效']
  const candidates = (records || db.credentials.filter((c) => c.personId === personId))
    .filter((c) => {
      const t = db.certTypes.find((t) => t.id === credentialTypeId(db, c))
      return (
        t && (t.id === requiredId || (t.family === required.family && t.level >= required.level))
      )
    })
    .sort(
      (a, b) => rank.indexOf(credentialStatus(a, asOf)) - rank.indexOf(credentialStatus(b, asOf)),
    )
  const credential = candidates[0]
  return {
    credential,
    result: credential ? credentialStatus(credential, asOf) : ('缺证' as CertResult),
  }
}
export const currentTarget = (r: Rule, asOf: string) =>
  [...r.milestones]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((m) => m.date <= asOf)
    .at(-1)?.ratio || 0
export function evaluatePerson(
  db: DB,
  p: Person,
  asOf: string,
  records?: Credential[],
): PersonResult {
  const assignments = activeAssignments(p, asOf)
  let unknown = assignments.some((a) => !a.job || !a.specialty || !a.start || !a.scopeConfirmed)
  const reqs = new Map<string, Requirement>()
  for (const rule of db.rules.filter((r) => r.enabled)) {
    const applicable = assignments.filter((a) => matches(db, a, rule))
    if (!applicable.length) continue
    const type = db.certTypes.find((t) => t.id === rule.certId)!
    const controlled = db.categories.find((c) => c.id === type.categoryId)?.mandatory
    const development = rule.mode === 'development' || !controlled
    const newPost = applicable.some((a) => a.start >= '2027-01-01')
    const mandatory =
      !development &&
      (newPost ||
        (rule.mode === 'individual'
          ? !rule.deadline || asOf >= rule.deadline
          : currentTarget(rule, asOf) >= 1))
    const best = bestCredential(db, p.id, rule.certId, asOf, records)
    if (
      best.result === '缺证' &&
      (records || db.credentials.filter((c) => c.personId === p.id)).some(
        (c) => !credentialTypeId(db, c),
      )
    )
      best.result = '待确认'
    if (best.result === '待确认' && !development) unknown = true
    const old = reqs.get(rule.certId)
    if (old) {
      old.ruleIds.push(rule.id)
      old.mandatory ||= mandatory
      old.group ||= rule.mode === 'group'
      old.development &&= development
      if (rule.deadline && rule.deadline < old.deadline) old.deadline = rule.deadline
    } else
      reqs.set(rule.certId, {
        certId: rule.certId,
        ruleIds: [rule.id],
        mandatory,
        group: rule.mode === 'group',
        development,
        deadline: rule.deadline,
        ...best,
      })
  }
  const requirements = [...reqs.values()]
  const hasMandatory = requirements.some((r) => r.mandatory)
  const bad = requirements.some((r) => r.mandatory && !['有效', '待确认'].includes(r.result))
  return {
    personId: p.id,
    requirements,
    unknown,
    hasMandatory,
    status: bad ? '不合规' : unknown ? '待确认' : hasMandatory ? '合规' : '无当期强制要求',
  }
}
export function evaluate(db: DB, asOf = db.asOf): Evaluation {
  const credentials = new Map<string, Credential[]>()
  db.credentials.forEach((c) =>
    credentials.set(c.personId, [...(credentials.get(c.personId) || []), c]),
  )
  const people = db.people.map((p) => evaluatePerson(db, p, asOf, credentials.get(p.id) || []))
  const findings: Finding[] = []
  const companies = new Set<string>()
  db.people.forEach((p) => activeAssignments(p, asOf).forEach((a) => companies.add(a.company)))
  for (const result of people) {
    const p = db.people.find((p) => p.id === result.personId)!
    const assignments = activeAssignments(p, asOf)
    const company = assignments[0]?.company || p.assignments[0]?.company || '未分配'
    const missing = assignments.flatMap((a) =>
      [
        !a.job ? '岗位' : null,
        !a.specialty ? '专业' : null,
        !a.start ? '任职日期' : null,
        !a.scopeConfirmed ? '作业范围确认' : null,
      ].filter(Boolean),
    )
    if (missing.length)
      findings.push({
        id: p.id + ':data',
        personId: p.id,
        company,
        kind: '信息待补充',
        severity: 'info',
        title: '补充人员判定信息',
        detail: [...new Set(missing)].join('、') + '待补充；原始数据继续保留。',
        due: '',
      })
    for (const req of result.requirements) {
      const type = db.certTypes.find((t) => t.id === req.certId)!
      const common = { personId: p.id, company, certId: req.certId, ruleId: req.ruleIds[0] }
      if (req.development && req.result === '缺证') continue
      if (req.result === '待确认')
        findings.push({
          ...common,
          id: p.id + ':' + req.certId + ':quality',
          kind: '信息待补充',
          severity: 'info',
          title: type.name + '信息待确认',
          detail: '请补充生效日期、有效期、复审要求或注册状态。',
          due: '',
        })
      else if (req.result !== '有效') {
        const violation = req.mandatory
        const groupRule = db.rules.find((r) => req.ruleIds.includes(r.id) && r.mode === 'group')
        const next = groupRule?.milestones
          .filter((m) => m.date > asOf)
          .sort((a, b) => a.date.localeCompare(b.date))[0]
        const due =
          req.result === '已过期'
            ? req.credential?.expires || ''
            : req.result === '复审逾期'
              ? req.credential?.review || ''
              : next?.date || req.deadline
        const kind = req.result === '缺证' && !violation ? '过渡期' : req.result
        findings.push({
          ...common,
          id: p.id + ':' + req.certId + ':requirement',
          kind,
          severity: violation ? 'danger' : 'warning',
          title:
            type.name +
            ' · ' +
            (req.result !== '缺证'
              ? req.result
              : violation
                ? '缺证'
                : groupRule
                  ? '阶段取证需求'
                  : '过渡期取证需求'),
          detail: violation
            ? '当期强制要求未满足。依据：' +
              req.ruleIds.map((id) => db.rules.find((r) => r.id === id)?.title).join('、')
            : '当前持证状态：' +
              req.result +
              '。' +
              (groupRule ? '群体比例目标单独考核，不直接认定个人违规。' : '期限前完成取证。'),
          due,
          days: due ? daysBetween(asOf, due) : undefined,
        })
      }
      if (req.credential && req.result === '有效') {
        const c = req.credential
        for (const [date, kind, suffix] of [
          [c.expiryMode === 'dated' ? c.expires : '', '证书临期', 'expiry'],
          [c.reviewMode === 'dated' ? c.review : '', '复审提醒', 'review'],
        ] as const) {
          const days = date ? daysBetween(asOf, date) : Infinity
          if (days >= 0 && days <= Math.max(...db.warningDays))
            findings.push({
              ...common,
              id: p.id + ':' + req.certId + ':' + suffix,
              kind,
              severity: 'warning',
              title: type.name + ' · ' + kind,
              detail:
                '剩余 ' +
                days +
                ' 天；提醒档位 ' +
                [...db.warningDays].sort((a, b) => a - b).find((d) => days <= d) +
                ' 天。',
              due: date,
              days,
            })
        }
      }
    }
    // Also track records outside current requirements (for example, an expired talent certificate).
    const selectedRecords = new Set(result.requirements.map((q) => q.credential?.id))
    for (const c of credentials.get(p.id) || []) {
      const certId = credentialTypeId(db, c)
      if (!certId || selectedRecords.has(c.id)) continue
      const name = db.certTypes.find((t) => t.id === certId)!.name
      const status = credentialStatus(c, asOf)
      const common = { personId: p.id, company, certId }
      if (status !== '有效') {
        const due =
          status === '已过期'
            ? c.expires
            : status === '复审逾期'
              ? c.review
              : status === '尚未生效'
                ? c.issued
                : ''
        findings.push({
          ...common,
          id: c.id + ':record',
          kind: status === '待确认' ? '信息待补充' : status,
          severity: status === '待确认' ? 'info' : 'warning',
          title: name + ' · ' + status,
          detail: '持证记录 ' + c.number + '：请维护证书信息；此记录提醒不直接认定当前岗位违规。',
          due,
          days: due ? daysBetween(asOf, due) : undefined,
        })
      } else {
        for (const [date, kind, suffix] of [
          [c.expiryMode === 'dated' ? c.expires : '', '证书临期', 'expiry'],
          [c.reviewMode === 'dated' ? c.review : '', '复审提醒', 'review'],
        ] as const) {
          const days = date ? daysBetween(asOf, date) : Infinity
          if (days >= 0 && days <= Math.max(...db.warningDays))
            findings.push({
              ...common,
              id: c.id + ':' + suffix,
              kind,
              severity: 'warning',
              title: name + ' · ' + kind,
              detail:
                '持证记录 ' +
                c.number +
                '，剩余 ' +
                days +
                ' 天；提醒档位 ' +
                [...db.warningDays].sort((a, b) => a - b).find((d) => days <= d) +
                ' 天。',
              due: date,
              days,
            })
        }
      }
    }
    for (const c of credentials.get(p.id) || [])
      if (!credentialTypeId(db, c))
        findings.push({
          id: c.id + ':unmapped',
          personId: p.id,
          company,
          kind: '信息待补充',
          severity: 'info',
          title: '证书名称待归并',
          detail: '原始名称：' + c.rawName,
          due: '',
        })
  }
  const groups: GroupResult[] = []
  for (const rule of db.rules.filter((r) => r.enabled && r.mode === 'group'))
    for (const company of companies) {
      const members = db.people.filter((p) =>
        activeAssignments(p, asOf).some((a) => a.company === company && matches(db, a, rule)),
      )
      if (!members.length) continue
      const held = members.filter(
        (p) =>
          bestCredential(db, p.id, rule.certId, asOf, credentials.get(p.id) || []).result ===
          '有效',
      ).length
      const unknown = members.filter((p) => people.find((r) => r.personId === p.id)!.unknown).length
      const target = currentTarget(rule, asOf)
      const next = [...rule.milestones]
        .sort((a, b) => a.date.localeCompare(b.date))
        .find((m) => m.date > asOf)
      const gap = Math.max(0, Math.ceil(members.length * (next?.ratio || target)) - held)
      const item = {
        id: company + ':' + rule.id,
        company,
        ruleId: rule.id,
        certId: rule.certId,
        total: members.length,
        held,
        unknown,
        target,
        nextTarget: next?.ratio || target,
        deadline: next?.date || rule.milestones.at(-1)?.date || '',
        gap,
        ratio: unknown ? null : held / members.length,
      }
      groups.push(item)
      if (target > 0 && !unknown && held / members.length < target)
        findings.push({
          id: item.id + ':group',
          company,
          ruleId: rule.id,
          certId: rule.certId,
          kind: '群体未达标',
          severity: 'danger',
          title: rule.title + ' · 群体未达标',
          detail:
            '有效持证 ' +
            held +
            '/' +
            members.length +
            ' 人，当前目标 ' +
            Math.round(target * 100) +
            '%，仍缺 ' +
            Math.max(0, Math.ceil(members.length * target) - held) +
            ' 人。',
          due: rule.milestones.filter((m) => m.date <= asOf).at(-1)?.date || '',
        })
    }
  return { people, findings, groups }
}
export function metrics(results: PersonResult[]) {
  const covered = results.filter((r) => !r.unknown)
  const eligible = covered.filter((r) => r.hasMandatory)
  const reqs = results.flatMap((r) => r.requirements.filter((r) => !r.development))
  return {
    total: results.length,
    unknown: results.filter((r) => r.unknown).length,
    compliant: eligible.filter((r) => r.status === '合规').length,
    eligible: eligible.length,
    coverage: results.length ? covered.length / results.length : null,
    compliance: eligible.length
      ? eligible.filter((r) => r.status === '合规').length / eligible.length
      : null,
    completion: reqs.length ? reqs.filter((r) => r.result === '有效').length / reqs.length : null,
    held: reqs.filter((r) => r.result === '有效').length,
    required: reqs.length,
  }
}
export function syncIssues(db: DB, result: Evaluation): DB {
  const known = new Map(db.issues.map((i) => [i.id, i]))
  const fresh = result.findings.map((f) => {
    const old = known.get(f.id)
    return old
      ? {
          ...old,
          ...f,
          ...(old.state === '已销项'
            ? {
                state: '待分派' as const,
                history: [
                  ...old.history,
                  {
                    at: new Date().toISOString(),
                    action: '重新发现',
                    actor: '系统',
                    note: f.detail,
                  },
                ],
              }
            : {}),
        }
      : {
          ...f,
          state: '待分派' as const,
          assignee: '',
          reviewer: '',
          note: '',
          history: [
            { at: new Date().toISOString(), action: '自动发现', actor: '系统', note: f.detail },
          ],
        }
  })
  return {
    ...db,
    issues: [...fresh, ...db.issues.filter((i) => !result.findings.some((f) => f.id === i.id))],
  }
}
export function resolveIssue(
  db: DB,
  id: string,
  action: 'assign' | 'start' | 'submit' | 'reject' | 'close',
  actor: string,
  note: string,
  assignee = '',
  reviewer = '',
): DB {
  const issue = db.issues.find((i) => i.id === id)!
  const allowed = {
    assign: ['待分派', '待整改'],
    start: ['待整改'],
    submit: ['整改中'],
    reject: ['待复核'],
    close: ['待复核'],
  }
  if (!allowed[action].includes(issue.state)) throw new Error('请按当前整改阶段操作。')
  if (action === 'close' && evaluate(db).findings.some((f) => f.id === id))
    throw new Error('问题尚未解决，请先更新人员、证书或规则后重新校验。')
  if (action === 'assign' && !assignee.trim()) throw new Error('请填写整改负责人。')
  if (action === 'submit' && (!note.trim() || !reviewer.trim()))
    throw new Error('请填写整改说明和复核人。')
  const state = {
    assign: '待整改',
    start: '整改中',
    submit: '待复核',
    reject: '整改中',
    close: '已销项',
  }[action] as DB['issues'][number]['state']
  const label = {
    assign: '分派整改',
    start: '开始整改',
    submit: '提交复核',
    reject: '退回整改',
    close: '复核销项',
  }[action]
  return {
    ...db,
    issues: db.issues.map((i) =>
      i.id !== id
        ? i
        : {
            ...i,
            state,
            note,
            assignee: assignee || i.assignee,
            reviewer: reviewer || i.reviewer,
            history: [...i.history, { at: new Date().toISOString(), action: label, actor, note }],
          },
    ),
  }
}

export function evaluateTarget(db: DB, person: Person, target: Assignment) {
  const asOf = target.start > db.asOf ? target.start : db.asOf
  return {
    asOf,
    result: evaluatePerson(
      db,
      { ...person, assignments: [{ ...target, start: target.start || db.asOf }] },
      asOf,
    ),
  }
}
