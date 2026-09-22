import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Network,
  Pause,
  Play,
  RotateCcw,
  ArrowUpRight,
  X,
} from 'lucide-react'
import { useStore } from '../store'
import { SearchField, Select } from '../ui'
import { basisLabels, buildPeopleClusters, type ClusterBasis } from './clusters'
import ClusterCanvas from './ClusterCanvas'

export default function BusinessClusters({ basis }: { basis: ClusterBasis }) {
  const { db } = useStore()
  const [validOnly, setValidOnly] = useState(true)
  const [focus, setFocus] = useState('')
  const [query, setQuery] = useState('')
  const [memberQuery, setMemberQuery] = useState('')
  const [resetCamera, setResetCamera] = useState(0)
  const [directoryLimit, setDirectoryLimit] = useState(30)
  const [memberPage, setMemberPage] = useState(1)
  const [personId, setPersonId] = useState('')
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const inspector = useRef<HTMLElement>(null)
  const map = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  const clusters = useMemo(() => buildPeopleClusters(db, basis, validOnly), [db, basis, validOnly])
  const filtered = useMemo(
    () =>
      clusters.filter((g) =>
        g.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      ),
    [clusters, query],
  )
  const matchingPeople = useMemo(
    () =>
      query.trim()
        ? db.people.filter((p) =>
            (p.name + ' ' + p.employeeNo)
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
          )
        : [],
    [db.people, query],
  )
  const active = clusters.find((g) => g.id === focus)
  const members = useMemo(
    () =>
      active?.members.filter((m) =>
        [m.person.name, m.person.employeeNo, ...m.companies]
          .join(' ')
          .toLocaleLowerCase()
          .includes(memberQuery.trim().toLocaleLowerCase()),
      ) || [],
    [active, memberQuery],
  )
  const memberPages = Math.max(1, Math.ceil(members.length / 30))
  const mPage = Math.min(memberPage, memberPages)
  const uniquePeople = useMemo(
    () => new Set(clusters.flatMap((g) => g.members.map((m) => m.person.id))).size,
    [clusters],
  )
  const person = db.people.find((p) => p.id === personId)
  const shared = person
    ? clusters.filter((g) => g.members.some((m) => m.person.id === person.id))
    : []
  const selectedMember = active?.members.find((m) => m.person.id === personId)
  const title = basisLabels[basis]
  function openGroup(id: string) {
    setFocus(id)
    setMemberQuery('')
    setMemberPage(1)
    setPersonId('')
  }
  function showPerson(id: string) {
    setPersonId(id)
    setQuery('')
    const belonging = clusters
      .filter((g) => g.members.some((m) => m.person.id === id))
      .sort((a, b) => a.members.length - b.members.length)
    if (!active?.members.some((m) => m.person.id === id)) setFocus(belonging[0]?.id || '')
    setMemberQuery('')
    setMemberPage(1)
  }
  function reset() {
    setFocus('')
    setPersonId('')
    setQuery('')
    setMemberQuery('')
    setResetCamera((n) => n + 1)
    setMemberPage(1)
  }
  return (
    <section
      className="kg-workspace kg-business"
      data-paused={paused || reduced}
      aria-label="共同关系人员聚类"
    >
      <div className="kg-toolbar">
        <SearchField
          value={query}
          placeholder={'搜索' + title + '、姓名或工号'}
          onChange={(value) => {
            setQuery(value)
            setFocus('')
            setPersonId('')
            setDirectoryLimit(30)
          }}
        />
        {basis === 'cert' && (
          <Select
            label="持证口径"
            value={validOnly ? 'valid' : 'all'}
            onChange={(e) => {
              setValidOnly(e.target.value === 'valid')
              setPersonId('')
              setMemberPage(1)
            }}
          >
            <option value="valid">仅有效持证</option>
            <option value="all">全部持证记录</option>
          </Select>
        )}
        <button className="button secondary" onClick={reset}>
          <RotateCcw size={16} />
          回到全景
        </button>
        <button
          className="button secondary kg-motion"
          aria-pressed={paused || reduced}
          disabled={reduced}
          onClick={() => setPaused((p) => !p)}
        >
          {paused || reduced ? <Play size={16} /> : <Pause size={16} />}{' '}
          {reduced ? '系统已减少动态效果' : paused ? '继续动效' : '暂停动效'}
        </button>
      </div>
      <div className="kg-cluster-summary">
        <strong>按{title}聚类</strong>
        <span>{clusters.length} 个簇</span>
        <span>{db.people.length.toLocaleString('zh-CN')} 个数据点 · 每人一个点</span>
        <span>{uniquePeople.toLocaleString('zh-CN')} 人有当前聚类关系</span>
      </div>
      <div className="kg-main">
        <div className="kg-map" ref={map}>
          <div className="kg-map-heading">
            <div>
              <span className="kg-live-dot" />
              <strong>{active ? active.label : '共同' + title + ' · 三维关系空间'}</strong>
            </div>
            <small>
              {active
                ? '聚焦 ' + active.members.length + ' 人 · 全部数据仍在空间中'
                : db.people.length + ' 个点 · 全量同屏'}
            </small>
          </div>
          {db.people.length ? (
            <ClusterCanvas
              groups={clusters}
              people={db.people}
              focus={active?.id || ''}
              personId={personId}
              paused={paused || reduced}
              reduced={reduced}
              reset={resetCamera}
              onPerson={showPerson}
              onOverview={reset}
            />
          ) : (
            <div className="kg-empty">
              <Network size={40} />
              <h2>还没有人员数据</h2>
              <p>导入台账后，所有人员会出现在同一个三维空间中。</p>
              <Link className="button secondary" to="/data">
                前往数据导入
              </Link>
            </div>
          )}
          {active && (
            <div className="kg-cluster-pagination">
              <button className="button secondary" onClick={reset}>
                <ChevronLeft size={16} />
                返回全量空间
              </button>
              <span>当前簇高亮，其余人员保留为背景点</span>
            </div>
          )}
        </div>
        <aside className="kg-inspector" aria-label="聚类详情" ref={inspector}>
          {person && (
            <section className="kg-member-card">
              <div className="kg-inspector-title">
                <h2>{person.name}</h2>
                <button
                  className="icon-button"
                  aria-label="关闭人员卡片"
                  onClick={() => setPersonId('')}
                >
                  <X size={16} />
                </button>
              </div>
              <p className="kg-note">
                {person.employeeNo} · {person.simulated ? '模拟人员' : '台账人员'}
                {selectedMember ? ' · ' + selectedMember.statuses.join('、') : ''}
              </p>
              <Link className="button secondary" to={'/people/' + encodeURIComponent(person.id)}>
                打开人员详情
                <ArrowUpRight size={15} />
              </Link>
              <p className="kg-note">
                属于 {shared.length} 个{title}簇。每人只显示一个点，可切换关联簇聚焦。
              </p>
              <div className="kg-memberships">
                {shared.map((g) => (
                  <button
                    key={g.id}
                    className="text-button"
                    onClick={() => {
                      setFocus(g.id)
                      setMemberQuery('')
                      setMemberPage(1)
                    }}
                  >
                    {g.label} · {g.members.length} 人
                  </button>
                ))}
              </div>
            </section>
          )}
          {active ? (
            <>
              <div className="kg-inspector-title">
                <h2>簇内全部成员</h2>
                <span>{active.members.length} 人</span>
              </div>
              <p className="kg-note">
                {active.label} ·{' '}
                {basis === 'cert'
                  ? validOnly
                    ? '按当前统计日期有效的证书记录归集。'
                    : '包含过期、异常和待确认的持证记录。'
                  : '按当前有效任职归集。'}
              </p>
              <SearchField
                value={memberQuery}
                placeholder="搜索簇内姓名、工号或公司"
                onChange={(v) => {
                  setMemberQuery(v)
                  setMemberPage(1)
                }}
              />
              <p className="kg-note" role="status">
                找到 {members.length} 人，显示 {members.length ? (mPage - 1) * 30 + 1 : 0}–
                {Math.min(mPage * 30, members.length)} 人
              </p>
              <div className="kg-member-list">
                {members.slice((mPage - 1) * 30, mPage * 30).map((m) => (
                  <button
                    className="kg-result kg-person"
                    key={m.person.id}
                    aria-pressed={personId === m.person.id}
                    onClick={() => showPerson(m.person.id)}
                  >
                    <i />
                    <span>
                      <strong>{m.person.name}</strong>
                      <small>
                        {m.person.employeeNo} · {m.companies.join('、') || '无当前任职'}
                        <br />
                        {m.statuses.join('、')}
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
              {!members.length && (
                <div className="kg-no-results">
                  <p>没有匹配成员。</p>
                  <button className="button secondary" onClick={() => setMemberQuery('')}>
                    清空成员搜索
                  </button>
                </div>
              )}
              {memberPages > 1 && (
                <div className="kg-member-pagination">
                  <button
                    className="icon-button"
                    aria-label="上一页成员"
                    disabled={mPage === 1}
                    onClick={() => setMemberPage(mPage - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>
                    {mPage} / {memberPages}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="下一页成员"
                    disabled={mPage === memberPages}
                    onClick={() => setMemberPage(mPage + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="kg-inspector-title">
                <h2>{title}簇目录</h2>
                <span>{filtered.length} 个簇</span>
              </div>
              <p className="kg-note">
                全部人员共同分布在一个三维空间。点击人员点，镜头会旋转并拉近到其所属的{title}簇。
              </p>
              <p className="kg-note">
                {basis === 'cert'
                  ? '共同持证关系牵引人员位置；多证人员只有一个点，首次点击优先聚焦人数较少的证书簇，也可切换其其他证书。'
                  : '同名' + title + '归入同一簇；有多个任职关系时，位置综合各项关系确定。'}
              </p>
              {matchingPeople.length > 0 && (
                <>
                  <h3>匹配人员 · {matchingPeople.length} 人</h3>
                  {matchingPeople.slice(0, directoryLimit).map((p) => (
                    <button
                      className="kg-result kg-person"
                      key={p.id}
                      onClick={() => showPerson(p.id)}
                    >
                      <i />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.employeeNo} · 定位人员所在簇</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </>
              )}
              {filtered.slice(0, directoryLimit).map((g) => (
                <button
                  className={'kg-result kg-' + basis}
                  key={g.id}
                  onClick={() => {
                    openGroup(g.id)
                    if (matchMedia('(max-width: 850px)').matches)
                      map.current?.scrollIntoView({
                        block: 'start',
                        behavior: reduced ? 'instant' : 'smooth',
                      })
                  }}
                >
                  <i />
                  <span>
                    <strong>{g.label}</strong>
                    <small>{g.members.length} 人 · 旋转聚焦此簇</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
              {Math.max(filtered.length, matchingPeople.length) > directoryLimit && (
                <button
                  className="button secondary kg-load"
                  onClick={() => setDirectoryLimit((n) => n + 30)}
                >
                  加载更多结果（每类已显示至 {directoryLimit} 项）
                </button>
              )}
              {!filtered.length && !matchingPeople.length && (
                <p className="kg-note">没有符合当前条件的簇或人员，三维空间仍保留全部数据点。</p>
              )}
            </>
          )}
        </aside>
      </div>
      <div className="kg-footnote">
        <span>
          统计日期 {db.asOf} ·{' '}
          {basis === 'cert'
            ? validOnly
              ? '仅有效持证'
              : '全部持证记录，不代表均有效'
            : '仅当前有效任职'}{' '}
          · 含模拟数据
        </span>
        <span>
          全部 {db.people.length} 人 · {clusters.length} 个关系簇 · 无当前关系人员保留为灰色点
        </span>
      </div>
    </section>
  )
}
