import * as XLSX from 'xlsx'
import { collectDemoArtifact, isDemoSession } from './demo/runtime'
import {
  activeAssignments,
  split,
  uid,
  type Assignment,
  type Credential,
  type DB,
  type Person,
} from './model'
export type ImportKind = 'positions' | 'people' | 'credentials'
export const fields: Record<ImportKind, string[]> = {
  positions: ['公司', '部门', '班组', '岗位'],
  people: [
    '工号',
    '姓名',
    '公司',
    '部门',
    '班组',
    '岗位',
    '专业',
    '职责',
    '作业范围',
    '范围已确认',
    '任职日期',
  ],
  credentials: [
    '记录编号',
    '工号',
    '证书名称',
    '证书编号',
    '生效日期',
    '有效期方式',
    '到期日期',
    '复审方式',
    '复审日期',
    '注册状态',
  ],
}
export async function readSheet(file: File) {
  const bytes = await file.arrayBuffer()
  const wb = file.name.toLowerCase().endsWith('.csv')
    ? XLSX.read(new TextDecoder('utf-8').decode(bytes), { type: 'string', raw: true })
    : XLSX.read(bytes, { type: 'array', cellDates: false, cellNF: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  for (const [address, cell] of Object.entries(sheet)) {
    if (!address.startsWith('!') && cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) {
      const date = XLSX.SSF.parse_date_code(cell.v, { date1904: wb.Workbook?.WBProps?.date1904 })
      cell.t = 's'
      cell.v =
        String(date.y) +
        '-' +
        String(date.m).padStart(2, '0') +
        '-' +
        String(date.d).padStart(2, '0')
      delete cell.w
    }
  }
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true })
  const rows = raw.map((row) =>
    row.map((v) =>
      v instanceof Date
        ? String(v.getFullYear()) +
          '-' +
          String(v.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(v.getDate()).padStart(2, '0')
        : String(v ?? ''),
    ),
  )
  return {
    headers: rows[0].map(String),
    rows: rows.slice(1).filter((r) => r.some((v) => v !== '')),
  }
}
export function mapRows(rows: string[][], headers: string[], mapping: Record<string, string>) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(mapping).map(([field, header]) => [
        field,
        String(row[headers.indexOf(header)] ?? ''),
      ]),
    ),
  )
}
export type ImportRecord = {
  line: number
  action: '新增' | '更新' | '已存在' | '待修正'
  data: Record<string, string>
  error: string
}
export function previewImport(
  db: DB,
  kind: ImportKind,
  rows: Record<string, string>[],
): ImportRecord[] {
  const seen = new Set<string>()
  return rows.map((rawData, i) => {
    const data = { ...rawData }
    for (const key of Object.keys(data).filter((k) => k.endsWith('日期'))) {
      const m = data[key].match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
      if (m) data[key] = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0')
    }
    let error = '',
      action: ImportRecord['action'] = '新增'
    if (kind === 'positions') {
      if (!data['公司'] || !data['部门']) error = '请补充公司和部门；班组与岗位可以留空。'
      if (
        db.sources.some(
          (s) =>
            s.company === data['公司'] &&
            s.department === data['部门'] &&
            (s.team || '') === data['班组'] &&
            (s.job || '') === data['岗位'],
        )
      )
        action = '已存在'
    } else if (kind === 'people') {
      if (!data['工号'] || !data['姓名']) error = '工号、姓名不能为空。'
      if (db.people.some((p) => p.employeeNo === data['工号'])) action = '更新'
    } else {
      if (!data['记录编号'] || !data['工号'] || !data['证书名称'])
        error = '记录编号、工号、证书名称不能为空。'
      if (!db.people.some((p) => p.employeeNo === data['工号']))
        error = '工号不存在，请先导入人员。'
      if (db.credentials.some((c) => c.id === data['记录编号'])) action = '更新'
    }
    for (const key of Object.keys(data).filter((k) => k.endsWith('日期'))) {
      const value = data[key]
      if (
        value &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        error = key + '无效，请使用真实日期或 YYYY-MM-DD。'
    }
    const key =
      kind === 'positions'
        ? JSON.stringify(fields.positions.map((f) => data[f]))
        : data[kind === 'people' ? '工号' : '记录编号']
    if (seen.has(key)) error = '本批次存在重复记录，请保留一条后导入。'
    seen.add(key)
    return { line: i + 2, action: error ? '待修正' : action, data, error }
  })
}
export function applyImport(db: DB, kind: ImportKind, records: ImportRecord[]): DB {
  const out = structuredClone(db)
  for (const record of records.filter((r) => r.action !== '待修正' && r.action !== '已存在')) {
    const d = record.data
    if (kind === 'credentials') {
      const person = out.people.find((p) => p.employeeNo === d['工号'])!
      const raw = d['证书名称'],
        canonical = out.aliases.find((a) => a.kind === 'cert' && a.raw === raw)?.standard || raw
      const type = out.certTypes.find((t) => t.name === canonical)
      const c: Credential = {
        id: d['记录编号'],
        personId: person.id,
        typeId: type?.id || '',
        rawName: raw,
        number: d['证书编号'],
        issued: d['生效日期'],
        expires: d['到期日期'],
        review: d['复审日期'],
        expiryMode:
          d['有效期方式'] === '长期'
            ? 'permanent'
            : d['有效期方式'] === '待确认'
              ? 'unknown'
              : 'dated',
        reviewMode:
          d['复审方式'] === '无需复审' ? 'none' : d['复审方式'] === '待确认' ? 'unknown' : 'dated',
        registration: ['正常', '异常'].includes(d['注册状态'])
          ? (d['注册状态'] as '正常' | '异常')
          : '未知',
      }
      const index = out.credentials.findIndex((c) => c.id === d['记录编号'])
      if (index < 0) out.credentials.push(c)
      else out.credentials[index] = c
    } else {
      const existing =
        kind === 'people' ? out.people.find((p) => p.employeeNo === d['工号']) : undefined
      const old = existing?.assignments[0]
      const a: Assignment = {
        id: old?.id || uid('assignment'),
        sourceId: old?.sourceId,
        company: d['公司'] || '',
        department: d['部门'] || '',
        team: d['班组'] || '',
        job: d['岗位'] || '',
        standardJob: '',
        specialty: d['专业'] || '',
        duties: split(d['职责'] || ''),
        scopes: split(d['作业范围'] || ''),
        scopeConfirmed: d['范围已确认'] === '是',
        start: d['任职日期'] || '',
        end: '',
      }
      if (kind === 'positions') {
        const source = {
          id: uid('source'),
          row: record.line,
          company: a.company,
          department: a.department,
          team: a.team || null,
          job: a.job || null,
        }
        out.sources.push(source)
        a.sourceId = source.id
      }
      const p: Person = {
        id: existing?.id || uid('person'),
        employeeNo: existing?.employeeNo || d['工号'] || 'IMP-' + uid().slice(-6),
        name: d['姓名'] || '导入岗位待配置人员',
        simulated: true,
        assignments: [a, ...(existing?.assignments.slice(1) || [])],
      }
      const index = out.people.findIndex((x) => x.id === p.id)
      if (index < 0) out.people.push(p)
      else out.people[index] = p
    }
  }
  return out
}
export function createWorkbook(rows: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = Object.keys(rows[0] || {}).map((k) => ({
    wch: Math.min(50, Math.max(14, k.length * 2 + 2)),
  }))
  const headers = Object.keys(rows[0] || {})
  headers.forEach((key, index) => {
    if (/(?:率|比例)$/.test(key))
      for (let row = 1; row <= rows.length; row++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: index })]
        if (cell?.t === 'n') cell.z = '0.0%'
      }
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '数据')
  return wb
}
export function exportTable(
  name: string,
  rows: Record<string, unknown>[],
  format: 'xlsx' | 'csv' = 'xlsx',
) {
  const workbook = createWorkbook(rows)
  if (isDemoSession()) {
    const bytes = XLSX.write(workbook, { bookType: format, type: 'array' })
    collectDemoArtifact({ name: name + '.' + format, blob: new Blob([bytes]), rows: rows.length })
    return
  }
  XLSX.writeFile(workbook, name + '.' + format, { bookType: format })
}
export function downloadJSON(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  if (isDemoSession()) {
    collectDemoArtifact({ name: name + '.json', blob })
    return
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = name + '.json'
  a.click()
  URL.revokeObjectURL(url)
}
export function personnelExport(db: DB) {
  return db.people.map((p) => {
    const a = activeAssignments(p, db.asOf)[0] || p.assignments[0]
    return {
      工号: p.employeeNo,
      姓名: p.name,
      公司: a?.company,
      部门: a?.department,
      班组: a?.team,
      岗位: a?.job,
      专业: a?.specialty,
      职责: a?.duties.join('，'),
      作业范围: a?.scopes.join('，'),
      范围已确认: a?.scopeConfirmed ? '是' : '否',
      任职日期: a?.start,
    }
  })
}
