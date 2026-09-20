export type SourceRow = {
  id: string
  row: number
  company: string
  department: string
  team: string | null
  job: string | null
}
export type Category = { id: string; name: string; mandatory: boolean }
export type CertType = {
  id: string
  name: string
  categoryId: string
  family: string
  level: number
  scope: string
  basis: string
}
export type Assignment = {
  id: string
  sourceId?: string
  company: string
  department: string
  team: string
  job: string
  standardJob: string
  specialty: string
  duties: string[]
  scopes: string[]
  scopeConfirmed: boolean
  start: string
  end: string
}
export type Person = {
  id: string
  employeeNo: string
  name: string
  simulated: boolean
  assignments: Assignment[]
}
export type Credential = {
  id: string
  personId: string
  typeId: string
  rawName: string
  number: string
  issued: string
  expires: string
  review: string
  expiryMode: 'dated' | 'permanent' | 'unknown'
  reviewMode: 'dated' | 'none' | 'unknown'
  registration: '正常' | '异常' | '未知'
}
export type Milestone = { date: string; ratio: number }
export type Rule = {
  id: string
  title: string
  certId: string
  specialties: string[]
  jobs: string[]
  duties: string[]
  scopes: string[]
  mode: 'individual' | 'group' | 'development'
  deadline: string
  milestones: Milestone[]
  enabled: boolean
  basis: string
  difference: string
}
export type Alias = {
  id: string
  kind: 'job' | 'cert' | 'department'
  raw: string
  standard: string
}
export type IssueKind =
  | '缺证'
  | '已过期'
  | '复审逾期'
  | '注册异常'
  | '尚未生效'
  | '信息待补充'
  | '证书临期'
  | '复审提醒'
  | '过渡期'
  | '群体未达标'
export type Finding = {
  id: string
  personId?: string
  company: string
  certId?: string
  ruleId?: string
  kind: IssueKind
  severity: 'danger' | 'warning' | 'info'
  title: string
  detail: string
  due: string
  days?: number
}
export type IssueState = '待分派' | '待整改' | '整改中' | '待复核' | '已销项'
export type Issue = Finding & {
  state: IssueState
  assignee: string
  reviewer: string
  note: string
  history: { at: string; action: string; actor: string; note: string }[]
}
export type Requirement = {
  certId: string
  ruleIds: string[]
  mandatory: boolean
  group: boolean
  development: boolean
  deadline: string
  result: CertResult
  credential?: Credential
}
export type CertResult =
  | '有效'
  | '缺证'
  | '已过期'
  | '复审逾期'
  | '注册异常'
  | '尚未生效'
  | '待确认'
export type PersonResult = {
  personId: string
  requirements: Requirement[]
  unknown: boolean
  hasMandatory: boolean
  status: '合规' | '不合规' | '待确认' | '无当期强制要求'
}
export type GroupResult = {
  id: string
  company: string
  ruleId: string
  certId: string
  total: number
  held: number
  unknown: number
  target: number
  nextTarget: number
  deadline: string
  gap: number
  ratio: number | null
}
export type Evaluation = { people: PersonResult[]; findings: Finding[]; groups: GroupResult[] }
export type ReportConfig = {
  id: string
  name: string
  type: string
  group: string
  company: string
  specialty: string
  category: string
  columns: string[]
  expiryDays?: number
}
export type DB = {
  version: 1
  asOf: string
  warningDays: number[]
  sources: SourceRow[]
  people: Person[]
  credentials: Credential[]
  categories: Category[]
  certTypes: CertType[]
  rules: Rule[]
  aliases: Alias[]
  issues: Issue[]
  reports: ReportConfig[]
  seedDate: string
}
export const uid = (prefix = 'id') => prefix + '_' + crypto.randomUUID().slice(0, 10)
export const split = (s: string) =>
  s
    .split(/[,，;；\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
export const pct = (n: number | null) => (n === null ? '—' : (n * 100).toFixed(1) + '%')
export const activeAssignments = (p: Person, asOf: string) =>
  p.assignments.filter((a) => (!a.start || a.start <= asOf) && (!a.end || a.end >= asOf))
