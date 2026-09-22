import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  Check,
  ChartNoAxesCombined,
  Download,
  GitBranch,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Upload,
  Users,
  Wrench,
} from 'lucide-react'
import { demoSteps } from './steps'
import type { DemoArtifact } from './runtime'
import './flow-overview.css'

const stages = [
  { id: 'data', title: '数据归集', hint: '保留来源，统一名称', icon: Upload, steps: [4, 5] },
  {
    id: 'people',
    title: '人岗证台账',
    hint: '人员、任职与持证关联',
    icon: Users,
    steps: [1, 2, 3],
  },
  {
    id: 'rules',
    title: '规则匹配',
    hint: '明确适用范围与持证要求',
    icon: BookOpenCheck,
    steps: [6, 7],
  },
  {
    id: 'risk',
    title: '监测与预警',
    hint: '发现缺口，持续跟踪风险',
    icon: BellRing,
    steps: [0, 10],
  },
  { id: 'fix', title: '整改与复核', hint: '补齐证书，校验后销项', icon: Wrench, steps: [8, 9] },
  {
    id: 'insight',
    title: '分析与应用',
    hint: '报表分析、人才筛选与培训',
    icon: ChartNoAxesCombined,
    steps: [11, 12, 13, 14],
  },
  {
    id: 'support',
    title: '设置与数据保障',
    hint: '提醒设置 · 备份恢复 · 演示重置',
    icon: Settings,
    steps: [15, 16],
  },
] as const

type StageId = (typeof stages)[number]['id']
type Connector = { id: string; path: string; tone: StageId; feedback?: boolean }

export default function FlowOverview({
  artifacts,
  paused,
  onPause,
  onClose,
  onRestart,
}: {
  artifacts: (DemoArtifact & { url: string })[]
  paused: boolean
  onPause: (paused: boolean) => void
  onClose: () => void
  onRestart: () => void
}) {
  const [selected, setSelected] = useState<StageId>('data')
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [connectors, setConnectors] = useState<Connector[]>([])
  const diagram = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const active = stages.find((stage) => stage.id === selected)!

  useEffect(() => {
    document.title = '全流程回顾 · 持证上岗统计分析系统'
    window.scrollTo({ top: 0, behavior: 'instant' })
    heading.current?.focus({ preventScroll: true })
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => setReduced(media.matches)
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])

  useLayoutEffect(() => {
    const root = diagram.current!
    const update = () => {
      const box = root.getBoundingClientRect()
      const rect = (id: StageId) =>
        root.querySelector<HTMLElement>(`[data-stage="${id}"]`)!.getBoundingClientRect()
      const point = (id: StageId, side: 'top' | 'right' | 'bottom' | 'left') => {
        const r = rect(id)
        return {
          x:
            (side === 'left' ? r.left : side === 'right' ? r.right : r.left + r.width / 2) -
            box.left,
          y:
            (side === 'top' ? r.top : side === 'bottom' ? r.bottom : r.top + r.height / 2) -
            box.top,
        }
      }
      const stacked = getComputedStyle(root).getPropertyValue('--flow-stacked').trim() === '1'
      const paths: Connector[] = stages.slice(0, 5).map((from, i) => {
        const to = stages[i + 1]
        const down = stacked || i === 2
        const a = point(from.id, down ? 'bottom' : i < 2 ? 'right' : 'left')
        const b = point(to.id, down ? 'top' : i < 2 ? 'left' : 'right')
        return { id: `${from.id}-${to.id}`, path: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, tone: to.id }
      })
      if (!stacked) {
        const a = point('fix', 'top'),
          b = point('people', 'bottom')
        paths.push({
          id: 'recheck',
          path: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
          tone: 'fix',
          feedback: true,
        })
      }
      setConnectors(paths)
    }
    const observer = new ResizeObserver(update)
    observer.observe(root)
    root.querySelectorAll('[data-stage]').forEach((node) => observer.observe(node))
    update()
    return () => observer.disconnect()
  }, [])

  return (
    <section
      className="flow-overview"
      aria-label="演示全流程回顾"
      data-demo-ui
      data-finished="true"
      data-paused={paused || reduced}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onPause(true)
      }}
    >
      <header className="flow-header">
        <div>
          <p className="flow-complete">
            <Check size={15} /> 已完成 {demoSteps.length} 个环节 · 8 个业务模块
          </p>
          <h1 ref={heading} tabIndex={-1}>
            把每个环节，连成管理闭环
          </h1>
          <p>从原始数据到持证管理，再到整改与应用。沿着连线回看业务如何衔接。</p>
        </div>
        <button className="button primary" onClick={onClose}>
          <Check size={16} /> 结束演示
        </button>
      </header>

      <div className="flow-canvas">
        <div className="flow-canvas-heading">
          <div>
            <GitBranch size={18} />
            <strong>持证管理 · 全流程导图</strong>
          </div>
          <button className="flow-motion" disabled={reduced} onClick={() => onPause(!paused)}>
            {paused || reduced ? <Play size={14} /> : <Pause size={14} />}
            {reduced ? '已减少动态效果' : paused ? '播放连线' : '暂停连线'}
          </button>
        </div>
        <p className="flow-map-help">
          按业务关系串联；节点内的编号对应刚才的演示环节。点击节点查看说明。
        </p>
        <div className="flow-diagram" ref={diagram}>
          <svg className="flow-connections" aria-hidden="true">
            <defs>
              {stages.map((stage) => (
                <marker
                  key={stage.id}
                  id={`flow-arrow-${stage.id}`}
                  className={`flow-tone-${stage.id}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M 1 1 L 9 5 L 1 9"
                    fill="none"
                    stroke="var(--flow-accent)"
                    strokeWidth="1.6"
                  />
                </marker>
              ))}
            </defs>
            {connectors.map((line) => (
              <g key={line.id} className={`flow-tone-${line.tone}`}>
                <path
                  className="flow-line-track"
                  d={line.path}
                  markerEnd={`url(#flow-arrow-${line.tone})`}
                />
                <path
                  className="flow-line-stream"
                  d={line.path}
                  data-feedback={line.feedback || undefined}
                />
              </g>
            ))}
          </svg>
          {stages.slice(0, 6).map((stage) => (
            <button
              key={stage.id}
              className={`flow-node flow-tone-${stage.id}`}
              data-stage={stage.id}
              aria-pressed={selected === stage.id}
              aria-controls="flow-stage-detail"
              onClick={() => setSelected(stage.id)}
            >
              <span className="flow-node-heading">
                <stage.icon size={21} />
                <strong>{stage.title}</strong>
                <ArrowRight size={16} />
              </span>
              <span className="flow-node-hint">{stage.hint}</span>
              <span className="flow-node-steps">
                {stage.steps.map((index) => (
                  <span key={index}>
                    <b>{String(index + 1).padStart(2, '0')}</b>
                    {demoSteps[index].title}
                  </span>
                ))}
              </span>
              <span className="flow-node-state">
                {selected === stage.id ? '正在查看' : '查看环节'}
                <ArrowRight size={12} />
              </span>
              {selected === stage.id && (
                <span className="flow-inline-detail">
                  {stage.steps.map((index) => (
                    <span key={index}>
                      <b>{String(index + 1).padStart(2, '0')}</b>
                      {demoSteps[index].description}
                    </span>
                  ))}
                </span>
              )}
            </button>
          ))}
          <span className="flow-feedback-label">补证后重新校验</span>
        </div>
        <div className="flow-loop-note">
          <RotateCcw size={15} />
          <span>复核通过后销项；风险再次出现时重新预警，保留整改历史。</span>
        </div>
        <button
          className="flow-support flow-tone-support"
          aria-pressed={selected === 'support'}
          aria-controls="flow-stage-detail"
          onClick={() => setSelected('support')}
        >
          <Settings size={18} />
          <strong>设置与数据保障</strong>
          <span>
            {stages
              .find((stage) => stage.id === 'support')!
              .steps.map((index) => `${index + 1} ${demoSteps[index].title}`)
              .join(' · ')}
          </span>
          <ArrowRight size={17} />
          {selected === 'support' && (
            <span className="flow-inline-detail">
              {active.steps.map((index) => (
                <span key={index}>
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  {demoSteps[index].description}
                </span>
              ))}
            </span>
          )}
        </button>
      </div>

      <section
        className="flow-detail panel"
        id="flow-stage-detail"
        aria-labelledby="flow-detail-title"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flow-detail-heading">
          <active.icon size={20} />
          <h2 id="flow-detail-title">{active.title}</h2>
          <span>{active.steps.length} 个演示环节</span>
        </div>
        <ol className="flow-detail-steps">
          {active.steps.map((index) => (
            <li key={index}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{demoSteps[index].title}</h3>
                <p>{demoSteps[index].description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <div className="flow-end-actions">
        <p>演示修改不会保存到原有数据中；结束后返回原页面。</p>
        <button className="button secondary" onClick={onRestart}>
          <RotateCcw size={15} /> 重新演示
        </button>
      </div>
      {artifacts.length > 0 && (
        <details className="flow-files panel demo-options-panel">
          <summary>下载本次演示文件（{artifacts.length}）</summary>
          <div className="demo-file-list">
            {artifacts.map((artifact) => (
              <a key={artifact.url} href={artifact.url} download={artifact.name}>
                <Download size={14} />
                <span>{artifact.name}</span>
              </a>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}
