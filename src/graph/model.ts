import { activeAssignments, type DB, type Evaluation } from '../model'
import { credentialStatus, credentialTypeId } from '../engine'

export const kinds = ['company', 'specialty', 'job', 'person', 'cert', 'rule'] as const
export type Kind = (typeof kinds)[number]
export const kindLabels: Record<Kind, string> = {
  company: '公司',
  specialty: '专业',
  job: '岗位',
  person: '人员',
  cert: '证书',
  rule: '规则',
}
export type GraphNode = {
  id: string
  label: string
  kind: Kind
  detail: string
  href: string
  search: string
}
export type GraphEdge = { id: string; source: string; target: string; label: string }
export type Graph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  byId: Map<string, GraphNode>
  adjacent: Map<string, GraphEdge[]>
}
const key = (kind: Kind, ...parts: string[]) => kind + ':' + JSON.stringify(parts)

// Only recorded relationships and evaluated requirements are graphed; proximity is not a compliance verdict.
export function buildGraph(db: DB, result: Evaluation): Graph {
  const byId = new Map<string, GraphNode>()
  const links = new Map<string, GraphEdge>()
  function node(
    kind: Kind,
    parts: string[],
    label: string,
    detail: string,
    href: string,
    search = '',
  ) {
    const id = key(kind, ...parts)
    if (!byId.has(id))
      byId.set(id, { id, kind, label, detail, href, search: label + ' ' + detail + ' ' + search })
    return id
  }
  function edge(source: string, target: string, label: string) {
    const id = JSON.stringify([source, target, label])
    links.set(id, { id, source, target, label })
  }
  for (const c of db.certTypes)
    node('cert', [c.id], c.name, [c.scope, c.basis].filter(Boolean).join('；'), '/rules')
  for (const r of db.rules) {
    const rid = node(
      'rule',
      [r.id],
      r.title,
      `${r.enabled ? '已启用' : '已停用'} · ${r.mode === 'individual' ? '个人要求' : r.mode === 'group' ? '群体比例要求' : '发展类要求'}；${r.basis}${r.difference ? '；差异：' + r.difference : ''}`,
      '/rules',
    )
    if (byId.has(key('cert', r.certId))) edge(rid, key('cert', r.certId), '配置证书要求')
  }
  for (const p of db.people) {
    const assignments = activeAssignments(p, db.asOf)
    if (!assignments.length) continue
    const pid = node(
      'person',
      [p.id],
      p.name,
      `${p.employeeNo} · ${p.simulated ? '模拟人员' : '台账人员'}；${assignments.map((a) => [a.company, a.department, a.job].filter(Boolean).join(' / ')).join('；')}`,
      '/people/' + encodeURIComponent(p.id),
    )
    for (const a of assignments) {
      const cid = a.company
        ? node(
            'company',
            [a.company],
            a.company,
            '当前有效任职记录中的所属公司',
            '/people?company=' + encodeURIComponent(a.company),
          )
        : ''
      if (cid) edge(cid, pid, '当前任职人员')
      const job = a.standardJob || a.job
      if (!job) continue
      const jid = node(
        'job',
        [a.company, a.department, job, a.specialty],
        job,
        [a.company, a.department, a.specialty || '专业待确认'].filter(Boolean).join(' · '),
        '/people?company=' + encodeURIComponent(a.company) + '&q=' + encodeURIComponent(a.job),
      )
      edge(jid, pid, '在岗人员')
      if (cid) edge(cid, jid, '设置岗位')
      if (a.specialty) {
        const sid = node(
          'specialty',
          [a.specialty],
          a.specialty,
          '按任职记录中的专业归类',
          '/people',
        )
        edge(sid, jid, '专业岗位')
      }
    }
  }
  for (const c of db.credentials) {
    const pid = key('person', c.personId),
      cid = key('cert', credentialTypeId(db, c))
    if (byId.has(pid) && byId.has(cid)) edge(pid, cid, '持证记录 · ' + credentialStatus(c, db.asOf))
  }
  for (const p of result.people)
    for (const r of p.requirements)
      for (const ruleId of r.ruleIds) {
        const pid = key('person', p.personId),
          rid = key('rule', ruleId)
        if (byId.has(pid) && byId.has(rid)) edge(pid, rid, '适用要求 · ' + r.result)
      }
  const edges = [...links.values()]
  const adjacent = new Map<string, GraphEdge[]>()
  for (const e of edges)
    for (const id of [e.source, e.target]) adjacent.set(id, [...(adjacent.get(id) || []), e])
  return { nodes: [...byId.values()], edges, byId, adjacent }
}
export function graphView(graph: Graph, focus: string, compact = false) {
  const rank = (a: GraphNode, b: GraphNode) =>
    (graph.adjacent.get(b.id)?.length || 0) - (graph.adjacent.get(a.id)?.length || 0) ||
    a.label.localeCompare(b.label, 'zh-CN')
  let candidates = graph.nodes
  const center = graph.byId.get(focus)
  if (center) {
    const ids = new Set((graph.adjacent.get(focus) || []).flatMap((e) => [e.source, e.target]))
    candidates = graph.nodes.filter((n) => n.id !== focus && ids.has(n.id))
  }
  const nodes = kinds.flatMap((kind) =>
    candidates
      .filter((n) => n.kind === kind)
      .sort(rank)
      .slice(0, compact ? (center ? 6 : 4) : center ? 12 : 8),
  )
  if (center) nodes.unshift(center)
  const ids = new Set(nodes.map((n) => n.id))
  return {
    nodes,
    edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    total: candidates.length + (center ? 1 : 0),
  }
}
