import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Network, Pause, Play, RotateCcw, X, ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import { Header, SearchField, Select, useFilters } from '../ui'
import BusinessClusters from '../graph/BusinessClusters'
import { basisLabels, type ClusterBasis } from '../graph/clusters'
import GraphCanvas from '../graph/GraphCanvas'
import { buildGraph, graphView, kinds, kindLabels, type Kind } from '../graph/model'
import '../graph/knowledge-graph.css'

export default function KnowledgeGraph() {
  const filters = useFilters()
  const requested = filters.get('view')
  const mode =
    requested === 'entities' || Object.hasOwn(basisLabels, requested) ? requested : 'cert'
  return (
    <>
      <Header
        title="知识图谱"
        description={
          mode === 'entities'
            ? '从实体关系查看公司、岗位、人员、证书与规则之间的联系。'
            : '所有人员共同分布在三维空间，按共同证书与任职关系聚集；点击一个点，旋转聚焦它所在的簇。'
        }
      />
      <div className="kg-view-switch">
        <Select label="聚类依据" value={mode} onChange={(e) => filters.set('view', e.target.value)}>
          <option value="cert">相同证书</option>
          <option value="job">相同岗位</option>
          <option value="company">相同公司</option>
          <option value="specialty">相同专业</option>
          <option value="entities">实体关系</option>
        </Select>
        <span>
          {mode === 'entities'
            ? '查看公司、岗位、人员、证书与规则之间的连线。'
            : '每个簇是一组具有共同' + basisLabels[mode as ClusterBasis] + '的人员。'}
        </span>
      </div>
      {mode === 'entities' ? (
        <EntityGraph />
      ) : (
        <BusinessClusters key={mode} basis={mode as ClusterBasis} />
      )}
    </>
  )
}

function EntityGraph() {
  const { db, result } = useStore()
  const inspector = useRef<HTMLElement>(null)
  const graph = useMemo(() => buildGraph(db, result), [db, result])
  const [selected, setSelected] = useState('')
  const [focus, setFocus] = useState('')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind | ''>('')
  const [paused, setPaused] = useState(false)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 480px)').matches)
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [reset, setReset] = useState(0)
  const [limit, setLimit] = useState(20)
  useEffect(() => {
    const size = window.matchMedia('(max-width: 480px)')
    const resize = () => setCompact(size.matches)
    size.addEventListener('change', resize)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    return () => {
      media.removeEventListener('change', change)
      size.removeEventListener('change', resize)
    }
  }, [])
  useEffect(() => {
    setLimit(20)
  }, [query, kind, selected])
  const view = useMemo(() => graphView(graph, focus, compact), [graph, focus, compact])
  const current = graph.byId.get(selected)
  const neighbors = current ? graph.adjacent.get(current.id) || [] : []
  const searchMode = Boolean(query.trim() || kind)
  const matches = useMemo(
    () =>
      graph.nodes.filter(
        (n) =>
          (!kind || n.kind === kind) &&
          (!query.trim() ||
            n.search.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
      ),
    [graph, query, kind],
  )
  const relations = useMemo(() => {
    const related = new Map<string, { id: string; labels: Set<string> }>()
    for (const edge of neighbors) {
      const id = edge.source === selected ? edge.target : edge.source
      const item = related.get(id) || { id, labels: new Set<string>() }
      item.labels.add(edge.label)
      related.set(id, item)
    }
    return [...related.values()]
  }, [neighbors, selected])
  function overview() {
    setFocus('')
    setSelected('')
    setQuery('')
    setKind('')
    setReset((n) => n + 1)
  }
  function locate(id: string) {
    setSelected(id)
    setFocus(id)
    setQuery('')
    setKind('')
  }
  const motion = paused || reduced
  return (
    <>
      <section className="kg-workspace" data-paused={motion} aria-label="人岗证知识图谱">
        <div className="kg-toolbar">
          <button className="button secondary" onClick={overview}>
            <RotateCcw size={16} />
            回到全景
          </button>
          <SearchField value={query} onChange={setQuery} placeholder="搜索人员、岗位、证书或规则" />
          <Select
            label="节点类型"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind | '')}
          >
            <option value="">全部类型</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {kindLabels[k]}
              </option>
            ))}
          </Select>
          <button
            className="button secondary kg-motion"
            onClick={() => setPaused((v) => !v)}
            disabled={reduced}
            aria-pressed={motion}
          >
            {motion ? <Play size={16} /> : <Pause size={16} />}
            {reduced ? '系统已减少动态效果' : paused ? '继续动效' : '暂停动效'}
          </button>
        </div>
        <div className={'kg-main' + (searchMode ? ' is-searching' : '')}>
          <div className="kg-map">
            <div className="kg-map-heading">
              <div>
                <span className="kg-live-dot" />
                <strong>{focus && graph.byId.has(focus) ? '局部关联' : '关系全景'}</strong>
                <span>{motion ? '静态浏览' : '动态聚类'}</span>
              </div>
              <small>
                {view.nodes.length} 个节点 · {view.edges.length} 条连线
              </small>
            </div>
            {graph.nodes.length ? (
              <GraphCanvas
                nodes={view.nodes}
                edges={view.edges}
                selected={selected}
                onSelect={(id) => {
                  setSelected(id)
                  if (window.matchMedia('(max-width: 850px)').matches)
                    requestAnimationFrame(() =>
                      inspector.current?.scrollIntoView({
                        block: 'start',
                        behavior: reduced ? 'instant' : 'smooth',
                      }),
                    )
                }}
                paused={paused}
                reduced={reduced}
                reset={reset}
                focus={focus}
                compact={compact}
              />
            ) : (
              <div className="kg-empty">
                <Network size={40} />
                <h2>还没有可展示的关系</h2>
                <p>导入人员或配置证书规则后，在这里探索关联。</p>
                <Link className="button secondary" to="/data">
                  前往数据导入
                </Link>
              </div>
            )}
            <div className="kg-legend" aria-label="节点图例">
              {kinds.map((k) => (
                <button
                  key={k}
                  className={'kg-legend-item kg-' + k}
                  aria-pressed={kind === k}
                  onClick={() => setKind(kind === k ? '' : k)}
                >
                  <i />
                  {kindLabels[k]}
                  <span>{graph.nodes.filter((n) => n.kind === k).length}</span>
                </button>
              ))}
            </div>
          </div>
          <aside ref={inspector} className="kg-inspector" aria-label="节点详情">
            {searchMode ? (
              <>
                <div className="kg-inspector-title">
                  <h2>查找节点</h2>
                  <span role="status">{matches.length} 个结果</span>
                </div>
                <p className="kg-note">搜索覆盖全部节点，选择结果即可定位并展开关联。</p>
                <div className="kg-result-list">
                  {matches.slice(0, limit).map((n) => (
                    <button
                      className={'kg-result kg-' + n.kind}
                      key={n.id}
                      onClick={() => locate(n.id)}
                    >
                      <i />
                      <span>
                        <strong>{n.label}</strong>
                        <small>
                          {kindLabels[n.kind]} · {n.detail}
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                  {!matches.length && (
                    <div className="kg-no-results">
                      <strong>未找到匹配节点</strong>
                      <p>试试姓名、岗位关键词，或切换节点类型。</p>
                      <button
                        className="button secondary"
                        onClick={() => {
                          setQuery('')
                          setKind('')
                        }}
                      >
                        清除筛选
                      </button>
                    </div>
                  )}
                  {matches.length > limit && (
                    <button
                      className="button secondary kg-load"
                      onClick={() => setLimit((n) => n + 20)}
                    >
                      加载更多（已显示 {limit} 项）
                    </button>
                  )}
                </div>
              </>
            ) : current ? (
              <>
                <div className="kg-inspector-title">
                  <span className={'kg-kind kg-' + current.kind}>
                    <i />
                    {kindLabels[current.kind]}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="关闭节点详情"
                    onClick={() => setSelected('')}
                  >
                    <X size={16} />
                  </button>
                </div>
                <h2 className="kg-detail-name">{current.label}</h2>
                <p className="kg-detail-description">{current.detail || '暂无补充说明'}</p>
                <div className="kg-detail-actions">
                  <button className="button primary" onClick={() => setFocus(current.id)}>
                    <Network size={16} />
                    展开关联
                  </button>
                  <Link className="button secondary" to={current.href}>
                    打开
                    {current.kind === 'rule' || current.kind === 'cert'
                      ? '证书与规则'
                      : current.kind === 'person'
                        ? '人员详情'
                        : '人员台账'}
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
                <div className="kg-inspector-title kg-relations-title">
                  <h3>直接关联</h3>
                  <span>{relations.length} 个节点</span>
                </div>
                <div className="kg-result-list">
                  {relations.slice(0, limit).map((r) => {
                    const n = graph.byId.get(r.id)!
                    return (
                      <button
                        key={r.id}
                        className={'kg-result kg-' + n.kind}
                        onClick={() => locate(n.id)}
                      >
                        <i />
                        <span>
                          <strong>{n.label}</strong>
                          <small>
                            {r.labels.size > 1 ? [...r.labels].join('；') : [...r.labels][0]}
                          </small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    )
                  })}
                  {!relations.length && (
                    <p className="kg-note">暂无直接关联记录。可前往对应台账补充数据。</p>
                  )}
                  {relations.length > limit && (
                    <button
                      className="button secondary kg-load"
                      onClick={() => setLimit((n) => n + 20)}
                    >
                      加载更多（已显示 {limit} 项）
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <dl className="kg-totals">
                  <div>
                    <dt>知识节点</dt>
                    <dd>{graph.nodes.length.toLocaleString('zh-CN')}</dd>
                  </div>
                  <div>
                    <dt>业务关系</dt>
                    <dd>{graph.edges.length.toLocaleString('zh-CN')}</dd>
                  </div>
                </dl>
                {kinds.slice(0, 3).map((k) => {
                  const n = view.nodes.find((n) => n.kind === k)
                  return n ? (
                    <button key={k} className={'kg-result kg-' + k} onClick={() => locate(n.id)}>
                      <i />
                      <span>
                        <strong>{n.label}</strong>
                        <small>{kindLabels[k]} · 展开关联</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ) : null
                })}
              </>
            )}
          </aside>
        </div>
        <div className="kg-footnote">
          <span>依据当前台账与规则 · 统计日期 {db.asOf} · 含模拟数据</span>
          <span>
            画布展示 {view.nodes.length} / {view.total} 个{focus ? '局部' : '全景'}
            节点；更多节点可搜索或在详情中查看。
          </span>
        </div>
      </section>
    </>
  )
}
