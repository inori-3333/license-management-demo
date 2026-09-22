import type { Person } from '../model'
import type { PeopleCluster } from './clusters'

export type SpatialPoint = {
  id: string
  name: string
  x: number
  y: number
  z: number
  groups: string[]
  color: number
}
function hash(text: string) {
  let n = 2166136261
  for (const char of text) n = Math.imul(n ^ char.charCodeAt(0), 16777619)
  return n >>> 0
}
function random(seed: number) {
  let n = seed
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0
    return (n + 1) / 4294967297
  }
}

// Each person occupies one position. All memberships pull on that position; identical
// certificate combinations form local clouds, rather than duplicating a person per certificate.
export function buildPointCloud(people: Person[], groups: PeopleCluster[]): SpatialPoint[] {
  const memberships = new Map<string, PeopleCluster[]>()
  groups.forEach((group) =>
    group.members.forEach((m) =>
      memberships.set(m.person.id, [...(memberships.get(m.person.id) || []), group]),
    ),
  )
  const anchors = new Map(
    groups.map((group, i) => {
      const y = 1 - (2 * (i + 0.5)) / Math.max(groups.length, 1)
      const angle = i * 2.39996323
      const r = Math.sqrt(1 - y * y)
      return [group.id, { x: Math.cos(angle) * r * 310, y: y * 250, z: Math.sin(angle) * r * 310 }]
    }),
  )
  const buckets = new Map<string, number>()
  for (const person of people) {
    const signature = (memberships.get(person.id) || [])
      .map((g) => g.id)
      .sort()
      .join('|')
    buckets.set(signature, (buckets.get(signature) || 0) + 1)
  }
  return people.map((person) => {
    const memberGroups = (memberships.get(person.id) || [])
      .slice()
      .sort((a, b) => a.members.length - b.members.length || a.id.localeCompare(b.id))
    const signature = memberGroups
      .map((g) => g.id)
      .sort()
      .join('|')
    let x = 0,
      y = 0,
      z = 0,
      total = 0
    for (const group of memberGroups) {
      const a = anchors.get(group.id)!,
        weight = 1 / Math.sqrt(group.members.length)
      x += a.x * weight
      y += a.y * weight
      z += a.z * weight
      total += weight
    }
    if (total) {
      x /= total
      y /= total
      z /= total
    } else {
      x = -210
      y = -180
      z = 170
    }
    const rand = random(hash(person.id)),
      spread = 12 + Math.cbrt(buckets.get(signature) || 1) * 7
    // Deterministic Gaussian scatter avoids hard-edged disks and spherical shells.
    const gaussian = () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand())
    return {
      id: person.id,
      name: person.name,
      x: x + gaussian() * spread,
      y: y + gaussian() * spread,
      z: z + gaussian() * spread,
      groups: memberGroups.map((g) => g.id),
      color: memberGroups.length ? hash(memberGroups[0].id) % 6 : -1,
    }
  })
}
export function clusterBounds(points: SpatialPoint[], group: string) {
  const members = points.filter((p) => p.groups.includes(group))
  if (!members.length) return null
  const center = { x: 0, y: 0, z: 0 }
  for (const p of members) {
    center.x += p.x / members.length
    center.y += p.y / members.length
    center.z += p.z / members.length
  }
  const radius = Math.max(
    45,
    ...members.map((p) => Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z)),
  )
  return { ...center, radius, count: members.length }
}
