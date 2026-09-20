import rows from './data/source.json'
import { categories, certTypes, rules } from './policy'
import { evaluatePerson } from './engine'
import type { Assignment, Credential, DB, Person, SourceRow } from './model'
function assignment(row: SourceRow, index: number): Assignment {
  const blob = [row.department, row.team, row.job].join(' ')
  let specialty = '综合管理'
  if (/财务|会计/.test(blob)) specialty = '财务'
  else if (/热控|机控|炉控|程控|仪控/.test(blob)) specialty = '热控检修'
  else if (/电气|电修|继保|电运/.test(blob)) specialty = '电气检修'
  else if (/锅炉|炉本体|焊/.test(blob)) specialty = '锅炉检修'
  else if (/汽机|机本体/.test(blob)) specialty = '汽机检修'
  else if (/燃料|煤|采制化/.test(blob)) specialty = '燃料'
  else if (/化学|化水|水处理|化验/.test(blob)) specialty = '化学'
  else if (/储能/.test(blob)) specialty = '储能'
  else if (/光伏|风电|新能源/.test(blob)) specialty = '新能源'
  else if (/运行|值长|集控|运维/.test(blob)) specialty = '运行'
  const production = specialty !== '综合管理' && specialty !== '财务'
  const duties: string[] = production ? ['生产岗位', '安全生产相关', '技能岗位'] : []
  const scopes: string[] = []
  if (/安全|安培/.test(row.job || '')) duties.push('专职安全监督')
  if (specialty === '财务')
    duties.push(/主任|主管|负责人/.test(row.job || '') ? '财务负责人主管' : '财务一般管理')
  if (specialty === '电气检修') scopes.push(index % 3 === 0 ? '低压电气作业' : '高压电气作业')
  if (/继保|继电/.test(blob)) scopes.push('继电保护作业')
  if (/焊/.test(blob)) scopes.push('焊接热切割')
  if (/起重|天车/.test(blob) || /行车/.test(row.job || '')) scopes.push('起重机操作')
  if (/水处理|化水运行/.test(blob)) duties.push('水处理值班')
  if (/化验|水煤油/.test(blob)) duties.push('水煤油化验')
  if (/采制化|采样|制样|质检/.test(blob)) duties.push('燃料采制化')
  if (/值长/.test(row.job || '') || specialty === '新能源') duties.push('运行调度')
  return {
    id: 'assignment-' + row.row,
    sourceId: row.id,
    company: row.company,
    department: row.department,
    team: row.team || '',
    job: row.job || '',
    standardJob: '',
    specialty,
    duties,
    scopes,
    scopeConfirmed: index % 97 !== 0,
    start: '2024-01-01',
    end: '',
  }
}
export function makeSeed(): DB {
  const sources = rows as SourceRow[]
  const surnames = ['陈', '李', '王', '张', '刘', '赵', '周', '吴', '徐', '孙', '郑', '马']
  const given = ['明', '华', '宁', '远', '林', '毅', '欣', '宇', '晨', '航', '彤', '杰']
  const people: Person[] = sources.map((row, i) => ({
    id: 'person-' + row.row,
    employeeNo: 'DEMO' + String(i + 1).padStart(4, '0'),
    name:
      surnames[i % surnames.length] +
      given[Math.floor(i / 12) % given.length] +
      String(Math.floor(i / 144) + 1).replace('1', ''),
    simulated: true,
    assignments: [assignment(row, i)],
  }))
  const examples = [
    [
      'scene-hv',
      '陈明',
      '电气检修技术员',
      '电气检修',
      ['生产岗位', '安全生产相关'],
      ['高压电气作业'],
      '2024-01-01',
    ],
    [
      'scene-alias',
      '李宁',
      '电修技术员',
      '电气检修',
      ['生产岗位', '安全生产相关'],
      ['高压电气作业'],
      '2024-01-01',
    ],
    [
      'scene-scope',
      '郑华',
      '电气检修技术员',
      '电气检修',
      ['生产岗位', '安全生产相关'],
      [],
      '2024-01-01',
    ],
    ['scene-legal1', '许文', '法务专责', '法务', ['专职法务'], [], '2024-01-01'],
    ['scene-legal2', '林悦', '法务专责', '法务', ['专职法务'], [], '2024-01-01'],
    ['scene-audit', '沈帆', '审计专责', '审计', ['审计'], [], '2024-01-01'],
    [
      'scene-solar',
      '杨澜',
      '新能源运维工程师',
      '新能源',
      ['生产岗位', '安全生产相关', '运行调度'],
      ['高压电气作业'],
      '2024-01-01',
    ],
    [
      'scene-storage',
      '程安',
      '储能运维工程师',
      '储能',
      ['生产岗位', '安全生产相关'],
      ['低压电气作业'],
      '2024-01-01',
    ],
    [
      'scene-new',
      '赵新',
      '电气检修技术员',
      '电气检修',
      ['生产岗位', '安全生产相关'],
      ['高压电气作业'],
      '2027-01-01',
    ],
    [
      'scene-safety1',
      '周维',
      '安全监督专责',
      '安全管理',
      ['专职安全监督', '安全生产相关'],
      [],
      '2024-01-01',
    ],
    [
      'scene-safety2',
      '孙静',
      '安全监督专责',
      '安全管理',
      ['专职安全监督', '安全生产相关'],
      [],
      '2024-01-01',
    ],
  ] as const
  examples.forEach(([id, name, job, specialty, duties, scopes, start], i) =>
    people.push({
      id,
      employeeNo: 'SCENE' + String(i + 1).padStart(3, '0'),
      name,
      simulated: true,
      assignments: [
        {
          id: id + '-assignment',
          company: 'A公司',
          department:
            specialty === '法务' ? '法律合规部' : specialty === '审计' ? '审计部' : '生产技术部',
          team: '',
          job,
          standardJob: '',
          specialty,
          duties: [...duties],
          scopes: [...scopes],
          scopeConfirmed: id !== 'scene-scope',
          start,
          end: '',
        },
      ],
    }),
  )
  // 每种制度证书都有明确标识的模拟场景，不修改原始岗位表。
  for (const rule of rules.filter((r) => !['production', 'power-safety'].includes(r.certId))) {
    const id = 'catalog-' + rule.certId
    people.push({
      id,
      employeeNo: 'CASE-' + rule.certId,
      name: '取证示例·' + certTypes.find((t) => t.id === rule.certId)!.name,
      simulated: true,
      assignments: [
        {
          id: id + '-assignment',
          company: 'B公司',
          department: '制度场景演示组',
          team: '',
          job: rule.title.replace('持证要求', '岗位'),
          standardJob: '',
          specialty: rule.specialties[0] || '综合管理',
          duties: [...rule.duties],
          scopes: [...rule.scopes],
          scopeConfirmed: true,
          start: '2024-01-01',
          end: '',
        },
      ],
    })
  }
  const db: DB = {
    version: 1,
    asOf: '2026-09-13',
    warningDays: [180, 90, 30, 7],
    sources: structuredClone(sources),
    people,
    credentials: [],
    categories: structuredClone(categories),
    certTypes: structuredClone(certTypes),
    rules: structuredClone(rules),
    aliases: [],
    issues: [],
    reports: [],
    seedDate: '2026-09-13',
  }
  // 已确认模拟范围；留少量缺口与日期边界供演示。
  people.forEach((p, i) => {
    const result = evaluatePerson(db, p, '2026-09-13', [])
    result.requirements.forEach((req, k) => {
      const n = i * 5 + k
      if (n % 13 === 0 || ['scene-hv', 'scene-new', 'scene-legal2', 'scene-safety2'].includes(p.id))
        return
      const type = certTypes.find((t) => t.id === req.certId)!
      const permanent =
        ['accounting', 'legal', 'audit', 'economics', 'statistics', 'engineering'].includes(
          type.family,
        ) || type.categoryId === 'incentive'
      const c: Credential = {
        id: 'credential-' + p.id + '-' + type.id,
        personId: p.id,
        typeId: type.id,
        rawName: type.name,
        number: 'DEMO-CERT-' + i + '-' + k,
        issued: '2024-01-01',
        expires: permanent ? '' : '2028-09-13',
        review: permanent ? '' : '2027-09-13',
        expiryMode: permanent ? 'permanent' : 'dated',
        reviewMode: permanent ? 'none' : 'dated',
        registration: '正常',
      }
      if (!permanent) {
        if (n % 47 === 0) c.expires = '2026-09-12'
        else if (n % 37 === 0) c.review = '2026-09-12'
        else if (n % 31 === 0) c.expires = '2026-09-20'
        else if (n % 29 === 0) c.expires = '2026-10-13'
        else if (n % 23 === 0) c.expires = '2026-12-12'
        else if (n % 19 === 0) c.expires = '2027-03-12'
        else if (n % 61 === 0) c.registration = '异常'
        else if (n % 83 === 0) c.expiryMode = 'unknown'
      }
      db.credentials.push(c)
    })
  })
  const aliasPerson = db.people.find((p) => p.id === 'scene-alias')!
  aliasPerson.assignments[0].department = '生技部'
  db.credentials.push({
    id: 'scene-raw-safety',
    personId: 'scene-safety1',
    typeId: '',
    rawName: '注安师',
    number: 'RAW-SAFETY-001',
    issued: '2024-01-01',
    expires: '2028-01-01',
    review: '2027-01-01',
    expiryMode: 'dated',
    reviewMode: 'dated',
    registration: '正常',
  })
  db.credentials = db.credentials.filter(
    (c) => !(c.personId === 'scene-safety1' && c.typeId === 'safety'),
  )
  return db
}
