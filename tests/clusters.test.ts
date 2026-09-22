import { describe, expect, it } from 'vitest'
import { buildPeopleClusters } from '../src/graph/clusters'
import { makeSeed } from '../src/seed'
import type { DB, Person, Credential } from '../src/model'
const seed = makeSeed()
const person = (id: string): Person => ({
  ...structuredClone(seed.people[0]),
  id,
  name: '人员' + id,
  employeeNo: id,
})
const record = (id: string, personId: string, typeId = seed.certTypes[0].id): Credential => ({
  id,
  personId,
  typeId,
  rawName: '',
  number: id,
  issued: '2020-01-01',
  expires: '2030-01-01',
  expiryMode: 'dated',
  review: '',
  reviewMode: 'none',
  registration: '正常',
})
const db = (people: Person[], credentials: Credential[]): DB => ({
  ...structuredClone(seed),
  asOf: '2026-09-22',
  people,
  credentials,
})

describe('shared business membership clusters', () => {
  it('includes every holder without truncation, even without a current assignment', () => {
    const people = Array.from({ length: 1307 }, (_, i) => person(String(i)))
    people[1306].assignments = []
    const data = db(
      people,
      people.map((p) => record(p.id, p.id)),
    )
    const groups = buildPeopleClusters(data, 'cert', true)
    expect(groups).toHaveLength(1)
    expect(groups[0].members).toHaveLength(1307)
    expect(groups[0].members.some((m) => m.person.id === '1306')).toBe(true)
  })
  it('deduplicates repeated certificates per person while retaining membership in multiple clusters', () => {
    const p = person('p')
    const groups = buildPeopleClusters(
      db([p], [record('1', 'p'), record('2', 'p'), record('3', 'p', seed.certTypes[1].id)]),
      'cert',
      true,
    )
    expect(groups).toHaveLength(2)
    expect(groups.every((g) => g.members.length === 1 && g.members[0].person.id === 'p')).toBe(true)
  })
  it('distinguishes current valid holders from all recorded statuses at the selected date', () => {
    const data = db(
      [person('valid'), person('expired'), person('unknown')],
      [
        record('1', 'valid'),
        { ...record('2', 'expired'), expires: '2025-01-01' },
        { ...record('3', 'unknown'), registration: '未知' },
      ],
    )
    expect(buildPeopleClusters(data, 'cert', true)[0].members.map((m) => m.person.id)).toEqual([
      'valid',
    ])
    const all = buildPeopleClusters(data, 'cert', false)[0].members
    expect(all).toHaveLength(3)
    expect(all.find((m) => m.person.id === 'expired')?.statuses).toEqual(['已过期'])
    expect(all.find((m) => m.person.id === 'unknown')?.statuses).toEqual(['待确认'])
    data.asOf = '2031-01-01'
    expect(buildPeopleClusters(data, 'cert', true)).toHaveLength(0)
  })
  it('resolves certificate aliases but keeps unmapped names explicitly separate', () => {
    const data = db(
      [person('p')],
      [
        { ...record('1', 'p'), typeId: '', rawName: '别名' },
        { ...record('2', 'p'), typeId: '', rawName: '待归并原名' },
      ],
    )
    data.aliases = [{ id: 'alias', kind: 'cert', raw: '别名', standard: data.certTypes[0].name }]
    const groups = buildPeopleClusters(data, 'cert', true)
    expect(groups.some((g) => g.label === data.certTypes[0].name)).toBe(true)
    expect(groups.some((g) => g.label === '未归并证书：待归并原名')).toBe(true)
  })
  it('groups shared jobs across companies using aliases and ignores ended assignments', () => {
    const people = [person('a'), person('b')]
    for (const [i, p] of people.entries())
      p.assignments = [
        {
          ...p.assignments[0],
          company: i ? '乙' : '甲',
          job: i ? '值班员别名' : '值班员',
          standardJob: '',
          start: '2020-01-01',
          end: '',
        },
      ]
    people[0].assignments.push({
      ...people[0].assignments[0],
      id: 'old',
      job: '历史岗位',
      company: '历史公司',
      end: '2021-01-01',
    })
    const data = db(people, [])
    data.aliases = [{ id: 'j', kind: 'job', raw: '值班员别名', standard: '值班员' }]
    expect(buildPeopleClusters(data, 'job', true).map((g) => [g.label, g.members.length])).toEqual([
      ['值班员', 2],
    ])
    expect(buildPeopleClusters(data, 'company', true)).toHaveLength(2)
    expect(buildPeopleClusters(data, 'specialty', true)[0].members).toHaveLength(2)
  })
  it('keeps source data unchanged and handles empty membership', () => {
    const data = db([person('p')], []),
      before = JSON.stringify(data)
    expect(buildPeopleClusters(data, 'cert', false)).toEqual([])
    buildPeopleClusters(data, 'job', true)
    expect(JSON.stringify(data)).toBe(before)
  })
})

import { buildPointCloud, clusterBounds } from '../src/graph/point-cloud'
describe('single shared 3D point cloud', () => {
  it('contains every person exactly once including unclassified people and multi-certificate holders', () => {
    const people = Array.from({ length: 1500 }, (_, i) => person(String(i)))
    const data = db(
      people,
      people
        .slice(0, 1499)
        .flatMap((p) => [record('a' + p.id, p.id), record('b' + p.id, p.id, seed.certTypes[1].id)]),
    )
    const groups = buildPeopleClusters(data, 'cert', true)
    const points = buildPointCloud(data.people, groups)
    expect(points).toHaveLength(1500)
    expect(new Set(points.map((p) => p.id)).size).toBe(1500)
    expect(points.find((p) => p.id === '1499')?.groups).toEqual([])
    expect(points.find((p) => p.id === '0')?.groups).toHaveLength(2)
    expect(points.every((p) => [p.x, p.y, p.z].every(Number.isFinite))).toBe(true)
  })
  it('keeps people with the same memberships closer than disjoint memberships in three dimensions', () => {
    const people = Array.from({ length: 40 }, (_, i) => person(String(i)))
    const data = db(
      people,
      people.map((p, i) => record(p.id, p.id, seed.certTypes[i < 20 ? 0 : 1].id)),
    )
    const points = buildPointCloud(data.people, buildPeopleClusters(data, 'cert', true))
    const distance = (a: (typeof points)[number], b: (typeof points)[number]) =>
      Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
    const within = points.slice(1, 20).reduce((n, p) => n + distance(points[0], p), 0) / 19
    const across = points.slice(20).reduce((n, p) => n + distance(points[0], p), 0) / 20
    expect(within).toBeLessThan(across / 3)
    expect(new Set(points.map((p) => p.z)).size).toBeGreaterThan(20)
  })
  it('focus bounds contain all members without removing any points from the shared space', () => {
    const data = db(
      [person('a'), person('b'), person('c')],
      [record('a', 'a'), record('b', 'b'), record('c', 'c', seed.certTypes[1].id)],
    )
    const groups = buildPeopleClusters(data, 'cert', true),
      points = buildPointCloud(data.people, groups),
      before = JSON.stringify(points)
    const group = groups.find((g) => g.members.length === 2)!,
      bounds = clusterBounds(points, group.id)!
    expect(bounds.count).toBe(2)
    for (const p of points.filter((p) => p.groups.includes(group.id)))
      expect(Math.hypot(p.x - bounds.x, p.y - bounds.y, p.z - bounds.z)).toBeLessThanOrEqual(
        bounds.radius + 0.001,
      )
    expect(JSON.stringify(points)).toBe(before)
    expect(clusterBounds(points, 'missing')).toBeNull()
    expect(buildPointCloud(data.people, groups)).toEqual(points)
  })
})
