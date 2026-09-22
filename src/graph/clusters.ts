import { activeAssignments, type DB, type Person } from '../model'
import { canonical, credentialStatus, credentialTypeId } from '../engine'

export type ClusterBasis = 'cert' | 'company' | 'job' | 'specialty'
export const basisLabels: Record<ClusterBasis, string> = {
  cert: '证书',
  company: '公司',
  job: '岗位',
  specialty: '专业',
}
export type ClusterMember = { person: Person; statuses: string[]; companies: string[] }
export type PeopleCluster = { id: string; label: string; members: ClusterMember[] }

// Group by shared business values. A person may belong to multiple groups, but only once in each.
export function buildPeopleClusters(
  db: DB,
  basis: ClusterBasis,
  validOnly: boolean,
): PeopleCluster[] {
  const groups = new Map<string, { label: string; members: Map<string, ClusterMember> }>()
  const people = new Map(db.people.map((p) => [p.id, p]))
  function add(id: string, label: string, person: Person, status: string) {
    let group = groups.get(id)
    if (!group) {
      group = { label, members: new Map() }
      groups.set(id, group)
    }
    let member = group.members.get(person.id)
    if (!member) {
      member = {
        person,
        statuses: [],
        companies: [
          ...new Set(
            activeAssignments(person, db.asOf)
              .map((a) => a.company)
              .filter(Boolean),
          ),
        ],
      }
      group.members.set(person.id, member)
    }
    if (!member.statuses.includes(status)) member.statuses.push(status)
  }
  if (basis === 'cert') {
    for (const record of db.credentials) {
      const person = people.get(record.personId)
      if (!person) continue
      const status = credentialStatus(record, db.asOf)
      if (validOnly && status !== '有效') continue
      const typeId = credentialTypeId(db, record)
      const type = db.certTypes.find((c) => c.id === typeId)
      const id = type ? 'cert:' + type.id : 'unmapped:' + (record.rawName || typeId || '未命名证书')
      add(
        id,
        type?.name || '未归并证书：' + (record.rawName || typeId || '名称待补充'),
        person,
        status,
      )
    }
  } else {
    for (const person of db.people)
      for (const a of activeAssignments(person, db.asOf)) {
        const value =
          basis === 'company'
            ? a.company
            : basis === 'specialty'
              ? a.specialty
              : canonical(db, 'job', a.standardJob || a.job)
        if (value) add(basis + ':' + value, value, person, '当前任职')
      }
  }
  return [...groups]
    .map(([id, group]) => ({
      id,
      label: group.label,
      members: [...group.members.values()].sort(
        (a, b) =>
          a.person.name.localeCompare(b.person.name, 'zh-CN') ||
          a.person.id.localeCompare(b.person.id),
      ),
    }))
    .sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label, 'zh-CN'))
}
