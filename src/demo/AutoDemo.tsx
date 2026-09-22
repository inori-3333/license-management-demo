import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, Download, Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react'
import { DemoDriver } from './driver'
import FlowOverview from './FlowOverview'
import { demoSteps } from './steps'
import { artifactEvent, type DemoArtifact } from './runtime'
import {
  initialVisual,
  placeCallout,
  resultHold,
  characterFill,
  type DemoVisual,
  type Playback,
  type Rect,
} from './presentation'

type SavedArtifact = DemoArtifact & { url: string }
export default function AutoDemo({
  onClose,
  onRestart,
  onComplete,
}: {
  onClose: () => void
  onRestart: () => void
  onComplete: () => void
}) {
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [speed, setSpeed] = useState(1)
  const [ready, setReady] = useState(false),
    [finished, setFinished] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState(0)
  const [visual, setVisual] = useState<DemoVisual>(initialVisual),
    [artifacts, setArtifacts] = useState<SavedArtifact[]>([])
  const playback = useRef<Playback>({ paused: false, speed: 1, skipReading: 0 }),
    saved = useRef<SavedArtifact[]>([]),
    controller = useRef<AbortController>()
  const callbacks = useRef({ onClose, onRestart, onComplete })
  callbacks.current = { onClose, onRestart, onComplete }
  const pause = (value: boolean) => {
    playback.current.paused = value
    setPaused(value)
  }
  const exit = (restart = false) => {
    controller.current?.abort()
    if (restart) callbacks.current.onRestart()
    else callbacks.current.onClose()
  }
  useEffect(() => {
    const abort = new AbortController()
    controller.current = abort
    const collect = (event: Event) => {
      const artifact = (event as CustomEvent<DemoArtifact>).detail
      saved.current = [...saved.current, { ...artifact, url: URL.createObjectURL(artifact.blob) }]
      setArtifacts(saved.current)
    }
    const guard = (event: Event) => {
      if (!event.isTrusted) return
      const el = event.target as HTMLElement
      if (el.closest('[data-demo-ui]')) return
      const key = (event as KeyboardEvent).key
      if (event.type === 'keydown' && key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        pause(true)
        return
      }
      if (
        event.type === 'keydown' &&
        (['Tab', 'PageDown', 'PageUp'].includes(key) ||
          (!el.matches('input,select,textarea') && ['ArrowDown', 'ArrowUp'].includes(key)))
      )
        return
      if (event.type === 'pointerdown' && !el.closest('button,a,input,select,textarea,summary'))
        return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const guarded = ['pointerdown', 'click', 'keydown', 'beforeinput', 'input', 'change']
    guarded.forEach((type) => document.addEventListener(type, guard, true))
    const hidden = () => {
      if (document.hidden) pause(true)
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener(artifactEvent, collect)
    let cursor = initialVisual.cursor
    const present = (patch: Partial<DemoVisual>) => {
      if (abort.signal.aborted) return
      if (patch.cursor) cursor = patch.cursor
      setVisual((v) => ({ ...v, ...patch }))
    }
    async function run() {
      for (let i = 0; i < demoSteps.length; i++) {
        abort.signal.throwIfAborted()
        setIndex(i)
        setReady(false)
        setProgress(0)
        const step = demoSteps[i]
        const driver = new DemoDriver(
          abort.signal,
          () => playback.current,
          present,
          () => saved.current,
          cursor,
        )
        await driver.runStep(step, setProgress)
        setReady(true)
        present({ phase: 'holding', action: '查看结果' })
        await driver.clock.read(resultHold, () => {})
      }
      document
        .querySelectorAll('[data-demo-target]')
        .forEach((el) => el.removeAttribute('data-demo-target'))
      setFinished(true)
      callbacks.current.onComplete()
    }
    void run().catch((e: Error) => {
      if (!abort.signal.aborted) {
        setError(e.message)
        pause(true)
      }
    })
    return () => {
      abort.abort()
      window.removeEventListener(artifactEvent, collect)
      document.removeEventListener('visibilitychange', hidden)
      guarded.forEach((type) => document.removeEventListener(type, guard, true))
      saved.current.forEach((a) => URL.revokeObjectURL(a.url))
      document
        .querySelectorAll('[data-demo-target]')
        .forEach((e) => e.removeAttribute('data-demo-target'))
      document.documentElement.classList.remove('demo-print-preview')
    }
  }, [])
  if (finished)
    return (
      <FlowOverview
        artifacts={artifacts}
        paused={paused}
        onPause={pause}
        onClose={() => exit()}
        onRestart={() => exit(true)}
      />
    )
  const step = demoSteps[index]
  const action =
    !paused &&
    !error &&
    !ready &&
    (['moving', 'clicking', 'typing'].includes(visual.phase) || visual.choices)
      ? visual.action
      : ''
  return (
    <Presentation visual={visual}>
      <section
        className="demo-callout"
        aria-label="演示讲解"
        data-step={index}
        data-ready={ready}
        data-phase={visual.phase}
      >
        <div className="demo-card-meta">
          <span>
            {step.chapter} · {index + 1}/{demoSteps.length}
          </span>
          <button className="icon-button" aria-label="退出演示" onClick={() => exit()}>
            <X size={17} />
          </button>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <h2>{step.title}</h2>
          <Karaoke text={step.description} progress={progress} />
        </div>
        <div className="demo-action" data-active={!!action}>
          {action && (
            <>
              <span className="demo-action-dot" />
              <span className="demo-action-text" title={action}>
                {action}
              </span>
            </>
          )}
        </div>
        {error && (
          <p className="inline-error demo-error" role="alert">
            {error}
          </p>
        )}
        <p className="demo-next">{`接下来：${demoSteps[index + 1]?.title || '全流程导图'}`}</p>
        <div className="demo-card-controls">
          <button className="button primary" onClick={() => pause(!paused)} disabled={!!error}>
            {paused ? <Play size={15} /> : <Pause size={15} />} {paused ? '继续演示' : '暂停演示'}
          </button>
          <button
            className="button secondary"
            disabled={!ready || !!error}
            onClick={() => {
              playback.current.skipReading++
              pause(false)
            }}
          >
            <SkipForward size={15} /> 下一条
          </button>
        </div>
        <details
          className="demo-options-panel"
          onToggle={(event) => {
            if (event.currentTarget.open) pause(true)
          }}
        >
          <summary>播放设置{artifacts.length > 0 ? `与文件（${artifacts.length}）` : ''}</summary>
          <div className="demo-settings-row">
            <label>
              播放速度
              <select
                aria-label="演示播放速度"
                value={speed}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setSpeed(value)
                  playback.current.speed = value
                }}
              >
                <option value={0.75}>舒缓 0.75×</option>
                <option value={1}>标准 1×</option>
                <option value={1.5}>较快 1.5×</option>
                <option value={2}>快速 2×</option>
              </select>
            </label>
            <button className="button secondary" onClick={() => exit(true)}>
              <RotateCcw size={14} /> 重新演示
            </button>
          </div>
          {artifacts.length > 0 && (
            <div className="demo-file-list">
              {artifacts.map((a) => (
                <a key={a.url} href={a.url} download={a.name} onClick={() => pause(true)}>
                  <Download size={14} />
                  <span>{a.name}</span>
                </a>
              ))}
            </div>
          )}
          <p className="demo-data-note">演示修改不会保存到原有数据中。</p>
        </details>
      </section>
    </Presentation>
  )
}
function Karaoke({ text, progress }: { text: string; progress: number }) {
  const characters = [...text]
  return (
    <p className="demo-description demo-karaoke" data-progress={progress}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {characters.map((char, index) => (
          <span
            key={index}
            className="demo-character"
            data-read={characterFill(index, characters.length, progress) === 100}
            style={
              {
                '--character-fill': `${characterFill(index, characters.length, progress)}%`,
              } as CSSProperties
            }
          >
            {char}
          </span>
        ))}
      </span>
    </p>
  )
}
function Presentation({ visual, children }: { visual: DemoVisual; children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement>(document.body)
  const layer = useRef<HTMLDivElement>(null)
  const placement = useRef<{ region: Element; point: { x: number; y: number } }>()
  const [geometry, setGeometry] = useState({
    target: { x: 60, y: 100, width: 180, height: 50 } as Rect,
    card: { x: 260, y: 100 },
    choices: null as Rect | null,
  })
  useLayoutEffect(() => {
    const sync = () =>
      setHost(
        [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) || document.body,
      )
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    })
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    layer.current?.showPopover()
    return () => {
      if (layer.current?.matches(':popover-open')) layer.current.hidePopover()
    }
  }, [host])
  useLayoutEffect(() => {
    let frame = 0
    const update = () => {
      const el = visual.target?.isConnected
        ? visual.target
        : host.querySelector<HTMLElement>('.modal-heading,h1') ||
          document.querySelector<HTMLElement>('h1')
      const r = el?.getBoundingClientRect()
      const target: Rect = r
        ? {
            x: Math.max(10, r.x),
            y: Math.max(12, r.y),
            width: Math.max(16, Math.min(innerWidth - 10, r.right) - Math.max(10, r.x)),
            height: Math.max(16, Math.min(innerHeight - 12, r.bottom) - Math.max(12, r.y)),
          }
        : geometry.target
      if (target.height > innerHeight * 0.5 && target.width > innerWidth * 0.55)
        target.height = Math.min(170, target.height)
      const card = layer.current?.querySelector('.demo-callout')?.getBoundingClientRect()
      let choices: Rect | null = null
      if (visual.choices) {
        const select = visual.choices.element.getBoundingClientRect(),
          height = visual.choices.values.length * 38 + 8
        choices = {
          x: Math.max(10, Math.min(innerWidth - Math.max(220, select.width) - 10, select.x)),
          y:
            select.bottom + height + 12 < innerHeight
              ? select.bottom + 6
              : Math.max(10, select.top - height - 6),
          width: Math.min(innerWidth - 20, Math.max(220, select.width)),
          height,
        }
      }
      let position = placeCallout(
        target,
        { width: card?.width || 340, height: card?.height || 310 },
        { width: innerWidth, height: innerHeight },
        choices || undefined,
      )
      const region =
        el?.closest(
          'dialog,.panel,.table-panel,.attention-panel,.kpi-grid,.assignment-grid,.sidebar,.topbar',
        ) || el
      const previous = placement.current
      if (previous && region === previous.region && card) {
        const p = previous.point
        const overlaps = (r: Rect) =>
          p.x < r.x + r.width &&
          p.x + card.width > r.x &&
          p.y < r.y + r.height &&
          p.y + card.height > r.y
        if (
          p.x >= 12 &&
          p.y >= 12 &&
          p.x + card.width <= innerWidth - 12 &&
          p.y + card.height <= innerHeight - 12 &&
          !overlaps(target) &&
          (!choices || !overlaps(choices))
        )
          position = { ...p, score: 0 }
      }
      if (region) placement.current = { region, point: position }
      setGeometry((old) =>
        JSON.stringify(old) ===
        JSON.stringify({ target, card: { x: position.x, y: position.y }, choices })
          ? old
          : { target, card: { x: position.x, y: position.y }, choices },
      )
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [visual.target, visual.choices, host])
  const t = geometry.target
  return createPortal(
    <div ref={layer} popover="manual" className="demo-presentation" data-demo-ui>
      <div
        className="demo-focus-ring"
        style={{ left: t.x - 4, top: t.y - 4, width: t.width + 8, height: t.height + 8 }}
        aria-hidden="true"
      />
      <div className="demo-card-position" style={{ left: geometry.card.x, top: geometry.card.y }}>
        {children}
      </div>
      {visual.choices && geometry.choices && (
        <div
          className="demo-select-preview"
          aria-label="正在选择的选项"
          style={{
            left: geometry.choices.x,
            top: geometry.choices.y,
            width: geometry.choices.width,
          }}
        >
          {visual.choices.values.map((o) => (
            <div
              key={o.value}
              data-demo-option-selected={o.value === visual.choices!.selected}
              className={o.value === visual.choices!.selected ? 'chosen' : ''}
            >
              <span>{o.label}</span>
              {o.value === visual.choices!.selected && <Check size={15} />}
            </div>
          ))}
        </div>
      )}
      <div
        className={'demo-cursor ' + (visual.phase === 'clicking' ? 'is-clicking' : '')}
        style={{ transform: `translate3d(${visual.cursor.x}px,${visual.cursor.y}px,0)` }}
        aria-hidden="true"
      >
        {visual.phase === 'clicking' && <span key={visual.pulse} className="demo-click-ripple" />}
        <svg width="32" height="40" viewBox="0 0 32 40">
          <path
            d="M3 2 L4 30 L11 23 L17 36 L23 33 L17 21 L28 20 Z"
            fill="var(--surface)"
            stroke="var(--primary-hover)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
        <span className="demo-cursor-label">
          {visual.phase === 'clicking' ? '点击' : visual.phase === 'typing' ? '输入' : '演示鼠标'}
        </span>
      </div>
    </div>,
    host,
  )
}
