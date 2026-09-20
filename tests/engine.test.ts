import * as XLSX from 'xlsx'
import { describe, it, expect } from 'vitest'
import { makeSeed } from '../src/seed'
import {
  evaluate,
  evaluatePerson,
  evaluateTarget,
  credentialStatus,
  bestCredential,
  daysBetween,
  metrics,
  syncIssues,
  resolveIssue,
  matches,
} from '../src/engine'
import { applyImport, previewImport, mapRows, readSheet, createWorkbook } from '../src/io'
import { buildReport, defaultReport } from '../src/reports'
import type { Assignment, Credential, DB, Person, Rule } from '../src/model'
const a: Assignment = {
  id: 'a',
  company: '测试公司',
  department: '生产部',
  team: '',
  job: '电气检修技术员',
  standardJob: '',
  specialty: '电气检修',
  duties: ['生产岗位'],
  scopes: ['高压电气作业'],
  scopeConfirmed: true,
  start: '2024-01-01',
  end: '',
}
const person: Person = {
  id: 'p',
  employeeNo: 'P1',
  name: '测试人员',
  simulated: true,
  assignments: [a],
}
const certificate: Credential = {
  id: 'c',
  personId: 'p',
  typeId: 'hv',
  rawName: '高压电工作业证',
  number: 'C1',
  issued: '2024-01-01',
  expires: '2026-09-13',
  review: '2026-09-13',
  expiryMode: 'dated',
  reviewMode: 'dated',
  registration: '正常',
}
function fixture(): DB {
  const seed = makeSeed()
  return {
    ...seed,
    people: [structuredClone(person)],
    credentials: [],
    rules: seed.rules.filter((r) => r.certId === 'hv'),
    sources: [],
    issues: [],
  }
}
describe('证书状态与日期边界', () => {
  it.each([
    [{}, '有效'],
    [{ expires: '2026-09-12' }, '已过期'],
    [{ review: '2026-09-12' }, '复审逾期'],
    [{ issued: '2026-09-14' }, '尚未生效'],
    [{ registration: '异常' }, '注册异常'],
    [{ issued: '' }, '待确认'],
    [{ expires: '' }, '待确认'],
    [{ review: '' }, '待确认'],
    [{ expiryMode: 'unknown' }, '待确认'],
    [{ reviewMode: 'unknown' }, '待确认'],
    [{ registration: '未知' }, '待确认'],
    [{ expiryMode: 'permanent', expires: '', reviewMode: 'none', review: '' }, '有效'],
  ] as const)('%j → %s', (changes, state) =>
    expect(credentialStatus({ ...certificate, ...changes } as Credential, '2026-09-13')).toBe(
      state,
    ),
  )
  it('按无时区日期计算，包括闰年', () => {
    expect(daysBetween('2026-09-13', '2026-09-20')).toBe(7)
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
  })
})
describe('岗位、作业与持证要求', () => {
  it('未持证成为当期缺证', () => {
    const e = evaluate(fixture())
    expect(e.people[0].status).toBe('不合规')
    expect(e.findings[0].kind).toBe('缺证')
  })
  it('作业范围明确但不同，不匹配', () => {
    const db = fixture()
    db.people[0].assignments[0].scopes = ['低压电气作业']
    expect(evaluate(db).people[0].requirements).toHaveLength(0)
  })
  it('实际作业相同但岗位专业不符，不匹配', () => {
    const db = fixture()
    db.people[0].assignments[0].specialty = '财务'
    expect(evaluate(db).people[0].requirements).toHaveLength(0)
  })
  it('作业范围未确认不会自动推断', () => {
    const db = fixture()
    db.people[0].assignments[0].scopeConfirmed = false
    const e = evaluate(db)
    expect(e.people[0].status).toBe('待确认')
    expect(e.people[0].requirements).toHaveLength(0)
  })
  it('空岗位进入待补充并保留已知缺口', () => {
    const db = fixture()
    db.people[0].assignments[0].job = ''
    const e = evaluate(db)
    expect(e.people[0].unknown).toBe(true)
    expect(e.findings.some((i) => i.kind === '信息待补充')).toBe(true)
  })
  it('兼岗与多个规则合并同一应持项，保留来源', () => {
    const db = fixture()
    db.people[0].assignments.push({ ...a, id: 'a2' })
    db.rules.push({ ...db.rules[0], id: 'rule2' })
    const e = evaluate(db)
    expect(e.people[0].requirements).toHaveLength(1)
    expect(e.people[0].requirements[0].ruleIds).toHaveLength(2)
  })
  it('已结束或尚未开始的任职不参与当期判断', () => {
    const db = fixture()
    db.people[0].assignments[0].end = '2026-09-12'
    expect(evaluate(db).people[0].requirements).toHaveLength(0)
    db.people[0].assignments[0] = { ...a, start: '2027-01-01' }
    expect(evaluate(db).people[0].requirements).toHaveLength(0)
  })
  it('非标准证书先待确认，人工映射后认可', () => {
    const db = fixture()
    db.credentials = [{ ...certificate, typeId: '', rawName: '高压证' }]
    expect(evaluate(db).people[0].requirements[0].result).toBe('待确认')
    db.aliases = [{ id: 'alias', kind: 'cert', raw: '高压证', standard: '高压电工作业证' }]
    expect(evaluate(db).people[0].status).toBe('合规')
  })
  it('名称归并用于配置了标准岗位的规则', () => {
    const db = fixture()
    db.rules[0].jobs = ['电气检修技术员']
    db.people[0].assignments[0].job = '电修技术员'
    expect(matches(db, db.people[0].assignments[0], db.rules[0])).toBe(false)
    db.aliases.push({ id: 'alias', kind: 'job', raw: '电修技术员', standard: '电气检修技术员' })
    expect(matches(db, db.people[0].assignments[0], db.rules[0])).toBe(true)
  })
  it('同系列高等级满足低等级，反向与跨系列均不满足', () => {
    const db = fixture()
    db.credentials = [{ ...certificate, typeId: 'account-middle' }]
    expect(bestCredential(db, 'p', 'account-junior', db.asOf).result).toBe('有效')
    expect(bestCredential(db, 'p', 'hv', db.asOf).result).toBe('缺证')
    db.credentials[0].typeId = 'account-junior'
    expect(bestCredential(db, 'p', 'account-middle', db.asOf).result).toBe('缺证')
  })
  it('多张证书选择有效记录', () => {
    const db = fixture()
    db.credentials = [{ ...certificate, id: 'expired', expires: '2025-01-01' }, certificate]
    expect(evaluate(db).people[0].status).toBe('合规')
  })
  it('无需当前强制要求不计入个人合规率分母', () => {
    const db = fixture()
    db.rules[0].deadline = '2029-12-31'
    const m = metrics(evaluate(db).people)
    expect(m.compliance).toBe(null)
    expect(m.completion).toBe(0)
  })
  it('缺失关键信息不计入合规率分母，覆盖率显式下降', () => {
    const db = fixture()
    db.credentials = [{ ...certificate, issued: '' }]
    const m = metrics(evaluate(db).people)
    expect(m.eligible).toBe(0)
    expect(m.coverage).toBe(0)
  })
  it('培养类不生成无证上岗问题', () => {
    const db = fixture()
    db.rules[0].mode = 'development'
    const e = evaluate(db)
    expect(e.findings).toHaveLength(0)
    expect(e.people[0].hasMandatory).toBe(false)
  })
})
describe('制度节点', () => {
  it('过渡期限当日开始要求，前一日仅提示取证', () => {
    const db = fixture()
    db.rules[0].deadline = '2026-12-31'
    db.asOf = '2026-12-30'
    expect(evaluate(db).findings[0].kind).toBe('过渡期')
    db.asOf = '2026-12-31'
    expect(evaluate(db).findings[0].kind).toBe('缺证')
  })
  it('2027 新上岗不享受 2029 过渡期', () => {
    const db = fixture()
    db.rules[0].deadline = '2029-12-31'
    db.people[0].assignments[0].start = '2027-01-01'
    db.asOf = '2027-01-01'
    expect(evaluate(db).people[0].hasMandatory).toBe(true)
  })
  it('兼岗新上岗只影响适用该任职的规则', () => {
    const db = fixture()
    db.rules[0].deadline = '2029-12-31'
    db.people[0].assignments.push({ ...a, id: 'new', start: '2027-01-01', scopes: [] })
    db.asOf = '2027-01-01'
    expect(evaluate(db).people[0].hasMandatory).toBe(false)
  })
  it('法务采用正文 2027 年底 80%，2028 年底 100%', () => {
    const r = makeSeed().rules.find((r) => r.certId === 'legal')!
    expect(r.milestones).toEqual([
      { date: '2027-12-31', ratio: 0.8 },
      { date: '2028-12-31', ratio: 1 },
    ])
    expect(r.difference).toContain('2026')
  })
  it('财务按层级设置期限', () => {
    const db = makeSeed()
    expect(db.rules.find((r) => r.certId === 'account-junior')!.deadline).toBe('2029-12-31')
    expect(db.rules.find((r) => r.certId === 'account-middle')!.deadline).toBe('2028-12-31')
  })
  it('群体目标取整且不在 50% 阶段逐人定违规', () => {
    const db = fixture()
    db.rules[0] = {
      ...db.rules[0],
      mode: 'group',
      milestones: [
        { date: '2026-12-31', ratio: 0.5 },
        { date: '2029-12-31', ratio: 1 },
      ],
    }
    db.people = [
      person,
      { ...person, id: 'p2', employeeNo: 'P2' },
      { ...person, id: 'p3', employeeNo: 'P3' },
    ].map((p) => structuredClone(p))
    db.asOf = '2026-12-31'
    const e = evaluate(db)
    expect(e.groups[0].gap).toBe(3)
    expect(e.groups[0].target).toBe(0.5)
    expect(e.findings.filter((f) => f.kind === '缺证')).toHaveLength(0)
    expect(e.findings.filter((f) => f.kind === '群体未达标')).toHaveLength(1)
    expect(e.findings.find((f) => f.kind === '群体未达标')!.detail).toContain('仍缺 2 人')
  })
  it('群体进入 100% 阶段后产生个人强制要求', () => {
    const db = fixture()
    db.rules[0] = { ...db.rules[0], mode: 'group', milestones: [{ date: '2029-12-31', ratio: 1 }] }
    db.asOf = '2029-12-31'
    expect(evaluate(db).people[0].hasMandatory).toBe(true)
  })
  it('提醒档位边界及逾期日期准确', () => {
    const db = fixture()
    db.credentials = [{ ...certificate, expires: '2026-09-20', reviewMode: 'none' }]
    expect(evaluate(db).findings[0].days).toBe(7)
    db.credentials[0].expires = '2026-09-12'
    expect(evaluate(db).findings[0].due).toBe('2026-09-12')
    expect(evaluate(db).findings[0].days).toBe(-1)
  })
})
describe('整改闭环', () => {
  it('完整整改要求先修复再复核，销项后再次出现会重开', () => {
    let db = fixture()
    db = syncIssues(db, evaluate(db))
    const id = db.issues[0].id
    db = resolveIssue(db, id, 'assign', '管理员', '', '班长')
    db = resolveIssue(db, id, 'start', '班长', '')
    db = resolveIssue(db, id, 'submit', '班长', '已提交材料', '', '复核人')
    expect(() => resolveIssue(db, id, 'close', '复核人', '通过')).toThrow('问题尚未解决')
    db = resolveIssue(db, id, 'reject', '复核人', '请先补录证书')
    expect(db.issues.find((i) => i.id === id)!.state).toBe('整改中')
    db.credentials = [certificate]
    db = syncIssues(db, evaluate(db))
    expect(db.issues.find((i) => i.id === id)!.state).toBe('整改中')
    db = resolveIssue(db, id, 'submit', '班长', '已补录', '', '复核人')
    db = resolveIssue(db, id, 'close', '复核人', '通过')
    expect(db.issues.find((i) => i.id === id)!.state).toBe('已销项')
    db.credentials = []
    db = syncIssues(db, evaluate(db))
    expect(db.issues.find((i) => i.id === id)!.state).toBe('待分派')
    expect(db.issues.find((i) => i.id === id)!.history.at(-1)?.action).toBe('重新发现')
  })
  it('不能跳过分派直接销项', () => {
    let db = fixture()
    db = syncIssues(db, evaluate(db))
    expect(() => resolveIssue(db, db.issues[0].id, 'close', '管理员', '')).toThrow('当前整改阶段')
  })
})
describe('导入、数据完整性与报表', () => {
  it('全部原始行关联模拟人员，保留四处空岗位', () => {
    const db = makeSeed()
    expect(db.sources).toHaveLength(1315)
    expect(db.sources.filter((s) => s.team === null)).toHaveLength(124)
    expect(db.sources.filter((s) => s.job === null)).toHaveLength(4)
    expect(
      db.sources.every((s) =>
        db.people.some((p) => p.assignments.some((a) => a.sourceId === s.id)),
      ),
    ).toBe(true)
  })
  it('重复原表行不再次导入；空岗位新行可保留', () => {
    const db = makeSeed()
    const old = db.sources[0]
    const rows = [
      { 公司: old.company, 部门: old.department, 班组: old.team || '', 岗位: old.job || '' },
      { 公司: '新公司', 部门: '新部门', 班组: '', 岗位: '' },
    ]
    const p = previewImport(db, 'positions', rows)
    expect(p[0].action).toBe('已存在')
    const out = applyImport(db, 'positions', p)
    expect(out.sources).toHaveLength(1316)
    expect(out.sources.at(-1)?.job).toBe(null)
  })
  it('人员按工号更新，原始来源与已有兼岗保留', () => {
    const db = makeSeed(),
      old = db.people[0],
      source = JSON.stringify(db.sources)
    old.assignments.push({ ...a, id: 'extra' })
    const records = previewImport(db, 'people', [
      {
        工号: old.employeeNo,
        姓名: '更新姓名',
        公司: '新公司',
        部门: '新部门',
        班组: '',
        岗位: '电修技术员',
        专业: '电气检修',
        职责: '生产岗位',
        作业范围: '高压电气作业',
        范围已确认: '是',
        任职日期: '2024-01-01',
      },
    ])
    const out = applyImport(db, 'people', records)
    expect(out.people[0].name).toBe('更新姓名')
    expect(out.people[0].assignments).toHaveLength(2)
    expect(out.people[0].assignments[0].sourceId).toBe(old.assignments[0].sourceId)
    expect(JSON.stringify(out.sources)).toBe(source)
  })
  it('持证按记录编号新增／更新，工号不存在列为待修正', () => {
    const db = fixture(),
      row = {
        记录编号: 'x',
        工号: 'P1',
        证书名称: '高压电工作业证',
        证书编号: '001',
        生效日期: '2024-01-01',
        有效期方式: '长期',
        复审方式: '无需复审',
        注册状态: '正常',
      }
    let p = previewImport(db, 'credentials', [row])
    expect(p[0].action).toBe('新增')
    const out = applyImport(db, 'credentials', p)
    p = previewImport(out, 'credentials', [row])
    expect(p[0].action).toBe('更新')
    expect(applyImport(out, 'credentials', p).credentials).toHaveLength(1)
    expect(previewImport(db, 'credentials', [{ ...row, 工号: 'missing' }])[0].action).toBe('待修正')
  })
  it('同批重复工号不静默覆盖', () => {
    const row = { 工号: '1', 姓名: '张三' }
    expect(previewImport(fixture(), 'people', [row, row])[1].action).toBe('待修正')
  })
  it('列映射采用所选列，不依赖顺序', () =>
    expect(
      mapRows([['张三', '1']], ['姓名列', '编号列'], { 工号: '编号列', 姓名: '姓名列' }),
    ).toEqual([{ 工号: '1', 姓名: '张三' }]))
  it('新增类别、证书与储能规则立即参与计算和专项报表', () => {
    const db = fixture()
    db.categories.push({ id: 'storage', name: '储能专项', mandatory: true })
    db.certTypes.push({
      id: 'storage-cert',
      name: '储能专项证',
      categoryId: 'storage',
      family: 'storage-cert',
      level: 1,
      scope: '储能',
      basis: '演示',
    })
    db.rules.push({
      ...db.rules[0],
      id: 'storage-rule',
      certId: 'storage-cert',
      specialties: ['储能'],
      scopes: [],
    })
    db.people[0].assignments[0].specialty = '储能'
    const e = evaluate(db)
    expect(e.people[0].requirements.some((q) => q.certId === 'storage-cert')).toBe(true)
    const report = buildReport(db, e, {
      ...defaultReport,
      type: 'distribution',
      group: 'specialty',
      specialty: '储能',
      category: 'storage',
    })
    expect(report[0]['人员数']).toBe(1)
    expect(report[0]['应持项数']).toBe(1)
  })
  it('报表分子分母与统一计算一致', () => {
    const db = fixture()
    db.credentials = [certificate]
    const e = evaluate(db),
      report = buildReport(db, e, defaultReport)
    expect(report[0]['人员合规率']).toBe(1)
    expect(report[0]['应持项数']).toBe(1)
    expect(report[0]['统计覆盖率']).toBe(1)
  })
  it('30 天提醒清单包含当天和第 30 天，排除逾期、第 31 天及其他公司', () => {
    const db = fixture()
    const result = evaluate(db)
    result.findings = [
      { kind: '证书临期' as const, days: 0, company: '测试公司', title: '当天到期' },
      { kind: '复审提醒' as const, days: 30, company: '测试公司', title: '30 天复审' },
      { kind: '证书临期' as const, days: 31, company: '测试公司', title: '31 天到期' },
      { kind: '已过期' as const, days: -1, company: '测试公司', title: '已经过期' },
      { kind: '证书临期' as const, days: 7, company: '另一公司', title: '另一公司提醒' },
    ].map((item, index) => ({
      ...item,
      id: `reminder-${index}`,
      personId: 'p',
      certId: 'hv',
      severity: 'warning',
      detail: item.title,
      due: '',
    }))
    const config = { ...defaultReport, type: 'expiry', company: '测试公司', expiryDays: 30 }
    expect(buildReport(db, result, config).map((row) => row['说明'])).toEqual([
      '当天到期',
      '30 天复审',
    ])
    expect(buildReport(db, result, { ...config, expiryDays: 0 })).toHaveLength(4)
  })
  it('空筛选不会制造 100% 合规率', () => {
    const db = fixture()
    expect(buildReport(db, evaluate(db), { ...defaultReport, company: '不存在' })).toHaveLength(0)
    expect(metrics([]).compliance).toBe(null)
  })
  it('初始演示全部场景可计算，数据体积适合本地存储', () => {
    const db = makeSeed(),
      e = evaluate(db)
    console.log(
      'Seed metrics',
      JSON.stringify({
        ...metrics(e.people),
        people: db.people.length,
        certificates: db.credentials.length,
        rules: db.rules.length,
        findings: e.findings.length,
        storageMB: JSON.stringify(syncIssues(db, e)).length / 1e6,
      }),
    )
    expect(e.people.length).toBe(db.people.length)
    expect(e.findings.length).toBeLessThan(2000)
    expect(JSON.stringify(syncIssues(db, e)).length).toBeLessThan(4e6)
  })
})

describe('可操作性补充回归', () => {
  it('过渡期内证书失效保留问题分类，但只作为提醒', () => {
    const db = fixture()
    db.rules[0].deadline = '2029-12-31'
    db.credentials = [{ ...certificate, expires: '2026-09-12' }]
    const e = evaluate(db)
    expect(e.findings[0].kind).toBe('已过期')
    expect(e.findings[0].severity).toBe('warning')
    expect(e.people[0].hasMandatory).toBe(false)
  })
  it('Excel 原生日期转换为 ISO 日期', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['生效日期', '记录编号'],
        [new Date(2024, 0, 2), 'D1'],
      ]),
      '测试',
    )
    const file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], '日期.xlsx')
    const sheet = await readSheet(file)
    expect(sheet.rows[0][0]).toBe('2024-01-02')
  })
  it('导入日期支持 YYYY/M/D，并标出不成立日期', () => {
    const db = fixture()
    let p = previewImport(db, 'people', [{ 工号: 'x', 姓名: '测试', 任职日期: '2024/1/2' }])
    expect(p[0].data['任职日期']).toBe('2024-01-02')
    p = previewImport(db, 'people', [{ 工号: 'x', 姓名: '测试', 任职日期: '2024-02-30' }])
    expect(p[0].action).toBe('待修正')
  })
})

it('无 BOM 中文 UTF-8 CSV 正确读取表头并进入导入预览', async () => {
  const csv =
    '工号,姓名,公司,部门,岗位,专业,任职日期\nBROWSER001,浏览器导入人员,A公司,生产部,电气检修技术员,电气检修,2024-01-01\n,无工号,A公司,生产部,,,2024-01-01\n'
  const sheet = await readSheet(new File([csv], '中文.csv'))
  expect(sheet.headers[0]).toBe('工号')
  const rows = mapRows(
    sheet.rows,
    sheet.headers,
    Object.fromEntries(sheet.headers.map((h) => [h, h])),
  )
  const p = previewImport(fixture(), 'people', rows)
  expect(p[0].action).toBe('新增')
  expect(p[0].data['姓名']).toBe('浏览器导入人员')
  expect(p[1].action).toBe('待修正')
})

it('导出计数保持数字，只有比例指标使用百分比格式', () => {
  const wb = createWorkbook([{ 纳入合规率人数: 5, 人员合规率: 0.8, 当前目标比例: 0.5 }])
  expect(wb.Sheets['数据'].A2.v).toBe(5)
  expect(wb.Sheets['数据'].A2.z).toBeUndefined()
  expect(wb.Sheets['数据'].B2.z).toBe('0.0%')
  expect(wb.Sheets['数据'].C2.z).toBe('0.0%')
  const exported = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
  expect(exported.Sheets['数据'].A2.v).toBe(5)
  expect(exported.Sheets['数据'].B2.v).toBe(0.8)
})

it('不适用当前岗位的证书也生成失效与临期提醒，不影响岗位合规率', () => {
  const db = fixture()
  db.credentials = [
    certificate,
    { ...certificate, id: 'talent-old', typeId: 'legal', expires: '2026-09-12' },
    {
      ...certificate,
      id: 'talent-soon',
      typeId: 'account-junior',
      expires: '2026-09-20',
      reviewMode: 'none',
    },
  ]
  const e = evaluate(db)
  expect(e.people[0].status).toBe('合规')
  expect(e.findings.find((f) => f.id === 'talent-old:record')?.kind).toBe('已过期')
  expect(e.findings.find((f) => f.id === 'talent-soon:expiry')?.days).toBe(7)
})
it('群体报表按专业筛选后重新统计范围人数', () => {
  const db = fixture()
  db.rules[0] = {
    ...db.rules[0],
    specialties: [],
    scopes: [],
    mode: 'group',
    milestones: [{ date: '2026-12-31', ratio: 0.5 }],
  }
  db.people.push({
    ...structuredClone(person),
    id: 'other',
    employeeNo: 'OTHER',
    assignments: [{ ...a, specialty: '储能' }],
  })
  const report = buildReport(db, evaluate(db), {
    ...defaultReport,
    type: 'groups',
    specialty: a.specialty,
  })
  expect(report[0]['范围人数']).toBe(1)
})

it('计划未来上岗时按目标日期匹配，期间过期证书不能满足新岗位', () => {
  const db = fixture()
  db.credentials = [{ ...certificate, expires: '2026-12-31', reviewMode: 'none' }]
  db.rules[0].deadline = '2029-12-31'
  const target = { ...a, start: '2027-01-01' }
  const match = evaluateTarget(db, person, target)
  expect(match.asOf).toBe('2027-01-01')
  expect(match.result.requirements).toHaveLength(1)
  expect(match.result.requirements[0].mandatory).toBe(true)
  expect(match.result.requirements[0].result).toBe('已过期')
})
