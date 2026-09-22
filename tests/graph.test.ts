import { describe, expect, it } from 'vitest'
import { makeSeed } from '../src/seed'
import { evaluate } from '../src/engine'
import { buildGraph, graphView, kinds } from '../src/graph/model'
import type { DB } from '../src/model'

const seed = makeSeed()
function fixture(): DB {
  return { ...structuredClone(seed), people: [], credentials: [], rules: [], certTypes: [] }
}
describe('knowledge graph recorded relationships', () => {
  it('uses current assignments and leaves source data unchanged', () => {
    const db = fixture()
    const person = structuredClone(seed.people[0])
    person.assignments = [
      { ...person.assignments[0], company: '现任公司', start: '2020-01-01', end: '' },
      {
        ...person.assignments[0],
        id: 'old',
        company: '历史公司',
        start: '2020-01-01',
        end: '2020-12-31',
      },
    ]
    db.people = [person]
    const before = JSON.stringify(db)
    const graph = buildGraph(db, evaluate(db))
    expect(graph.nodes.some((n) => n.label === '现任公司')).toBe(true)
    expect(graph.nodes.some((n) => n.label === '历史公司')).toBe(false)
    expect(JSON.stringify(db)).toBe(before)
  })
  it('preserves expired credential status and resolves configured aliases', () => {
    const db = fixture()
    const person = structuredClone(seed.people[0])
    db.people = [person]
    db.certTypes = [seed.certTypes[0]]
    db.aliases = [{ id: 'alias', kind: 'cert', raw: '旧证名', standard: db.certTypes[0].name }]
    db.credentials = [
      {
        id: 'expired',
        personId: person.id,
        typeId: '',
        rawName: '旧证名',
        number: 'test',
        issued: '2019-01-01',
        expires: '2020-01-01',
        expiryMode: 'dated',
        review: '',
        reviewMode: 'none',
        registration: '正常',
      },
    ]
    const graph = buildGraph(db, evaluate(db))
    expect(graph.edges.some((e) => e.label === '持证记录 · 已过期')).toBe(true)
    expect(graph.edges.some((e) => e.label === '持证记录 · 有效')).toBe(false)
  })
  it('keeps identically named jobs in different companies distinct and deduplicates repeated records', () => {
    const db = fixture()
    const person = structuredClone(seed.people[0])
    person.assignments = ['甲公司', '乙公司', '甲公司'].map((company, i) => ({
      ...person.assignments[0],
      id: String(i),
      company,
      job: '值班员',
      standardJob: '',
      start: '',
      end: '',
    }))
    db.people = [person]
    const graph = buildGraph(db, evaluate(db))
    expect(graph.nodes.filter((n) => n.kind === 'job')).toHaveLength(2)
    expect(new Set(graph.edges.map((e) => e.id)).size).toBe(graph.edges.length)
  })
  it('keeps every link endpoint present and only displays real evaluated requirement links', () => {
    const evaluation = evaluate(seed)
    const graph = buildGraph(seed, evaluation)
    for (const edge of graph.edges) {
      expect(graph.byId.has(edge.source)).toBe(true)
      expect(graph.byId.has(edge.target)).toBe(true)
    }
    for (const person of evaluation.people)
      for (const req of person.requirements)
        for (const ruleId of req.ruleIds) {
          const source = 'person:' + JSON.stringify([person.personId])
          if (!graph.byId.has(source)) continue
          expect(
            graph.adjacent
              .get(source)
              ?.some(
                (e) =>
                  e.target === 'rule:' + JSON.stringify([ruleId]) &&
                  e.label === '适用要求 · ' + req.result,
              ),
          ).toBe(true)
        }
  })
  it('bounds overview and local canvases without dropping searchable nodes', () => {
    const graph = buildGraph(seed, evaluate(seed))
    const all = graph.nodes.length
    const overview = graphView(graph, '')
    expect(overview.nodes.length).toBeLessThanOrEqual(48)
    for (const kind of kinds)
      expect(overview.nodes.filter((n) => n.kind === kind).length).toBeLessThanOrEqual(8)
    expect(graphView(graph, '', true).nodes.length).toBeLessThanOrEqual(24)
    const company = graph.nodes.find((n) => n.kind === 'company')!
    const local = graphView(graph, company.id)
    expect(local.nodes.some((n) => n.id === company.id)).toBe(true)
    expect(local.total).toBeGreaterThan(local.nodes.length)
    const neighbors = new Set(graph.adjacent.get(company.id)?.flatMap((e) => [e.source, e.target]))
    expect(local.nodes.every((n) => neighbors.has(n.id))).toBe(true)
    expect(graph.nodes.length).toBe(all)
  })
  it('handles empty data and stale focus without dangling edges', () => {
    const empty = buildGraph(fixture(), { people: [], findings: [], groups: [] })
    expect(graphView(empty, 'missing')).toEqual({ nodes: [], edges: [], total: 0 })
    const graph = buildGraph(seed, evaluate(seed))
    expect(graphView(graph, 'missing')).toEqual(graphView(graph, ''))
  })
})
