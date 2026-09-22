import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Minus, Plus, Scan, Move } from 'lucide-react'
import { kinds, kindLabels, type GraphNode, type GraphEdge, type Kind } from './model'
const desktopCenters: Record<Kind, [number, number]> = {
  company: [290, 165],
  specialty: [710, 165],
  job: [825, 400],
  person: [710, 630],
  cert: [290, 630],
  rule: [175, 400],
}
type Point = {
  x: number
  y: number
  tx: number
  ty: number
  vx: number
  vy: number
  pinned: boolean
}
export default function GraphCanvas({
  nodes,
  edges,
  selected,
  onSelect,
  paused,
  reduced,
  reset,
  focus,
  compact,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selected: string
  onSelect: (id: string) => void
  paused: boolean
  reduced: boolean
  reset: number
  focus: string
  compact: boolean
}) {
  const W = compact ? 600 : 1000,
    H = compact ? 740 : 760
  const centers: Record<Kind, [number, number]> = compact
    ? {
        company: [165, 140],
        specialty: [435, 140],
        job: [485, 370],
        person: [435, 600],
        cert: [165, 600],
        rule: [115, 370],
      }
    : desktopCenters
  const host = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const lines = useRef(new Map<string, SVGLineElement>())
  const points = useRef(new Map<string, Point>())
  const redraw = useRef(() => {})
  const drag = useRef<{ id: string; pointer: number; x: number; y: number; moved: boolean } | null>(
    null,
  )
  const suppressClick = useRef(false)
  const [size, setSize] = useState({ w: 900, h: 660 })
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const scale = Math.min(size.w / W, size.h / H) * view.zoom
  const connected = new Set(
    edges
      .filter((e) => e.source === selected || e.target === selected)
      .flatMap((e) => [e.source, e.target]),
  )
  const fit = () => setView({ x: 0, y: 0, zoom: 1 })
  useEffect(fit, [nodes, reset])
  useEffect(() => {
    const observer = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    )
    if (host.current) observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    points.current = new Map()
    for (const kind of kinds) {
      const group = nodes.filter((n) => n.kind === kind && n.id !== focus)
      group.forEach((node, i) => {
        const angle = ((i - 1) / Math.max(1, group.length - 1)) * Math.PI * 2 - Math.PI / 2
        const radius = i === 0 ? 0 : compact ? 62 : 88
        const [cx, cy] = centers[kind]
        const x = cx + Math.cos(angle) * radius,
          y = cy + Math.sin(angle) * radius
        points.current.set(node.id, { x, y, tx: x, ty: y, vx: 0, vy: 0, pinned: false })
      })
    }
    if (nodes.some((n) => n.id === focus))
      points.current.set(focus, {
        x: W / 2,
        y: H / 2,
        tx: W / 2,
        ty: H / 2,
        vx: 0,
        vy: 0,
        pinned: true,
      })
  }, [nodes, reset, focus, compact])
  useEffect(() => {
    let frame = 0,
      last = 0,
      time = 0
    const draw = (now: number) => {
      frame = 0
      const dt = last ? Math.min((now - last) / 16.67, 2) : 1
      last = now
      if (!paused && !reduced && !document.hidden) time += dt * 0.016
      const entries = [...points.current.entries()]
      for (let i = 0; i < entries.length; i++) {
        const [id, p] = entries[i]
        if (!paused && !reduced && !document.hidden && !p.pinned && drag.current?.id !== id) {
          p.vx += (p.tx + Math.sin(time * 0.65 + i * 1.7) * 9 - p.x) * 0.012 * dt
          p.vy += (p.ty + Math.cos(time * 0.5 + i * 1.3) * 9 - p.y) * 0.012 * dt
          p.vx *= 0.85
          p.vy *= 0.85
          p.x += p.vx * dt
          p.y += p.vy * dt
        }
        const button = buttons.current.get(id)
        if (button) button.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`
      }
      for (const edge of edges) {
        const a = points.current.get(edge.source),
          b = points.current.get(edge.target),
          line = lines.current.get(edge.id)
        if (a && b && line) {
          line.setAttribute('x1', String(a.x))
          line.setAttribute('y1', String(a.y))
          line.setAttribute('x2', String(b.x))
          line.setAttribute('y2', String(b.y))
        }
      }
      if (!paused && !reduced && !document.hidden) frame = requestAnimationFrame(draw)
    }
    redraw.current = () => {
      if (!frame) draw(performance.now())
    }
    const visibility = () => redraw.current()
    document.addEventListener('visibilitychange', visibility)
    redraw.current()
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [nodes, edges, paused, reduced, reset])
  const zoom = (factor: number) =>
    setView((v) => ({ ...v, zoom: Math.max(0.55, Math.min(2.8, v.zoom * factor)) }))
  useEffect(() => {
    const el = host.current
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom(e.deltaY < 0 ? 1.08 : 1 / 1.08)
    }
    el?.addEventListener('wheel', wheel, { passive: false })
    return () => el?.removeEventListener('wheel', wheel)
  }, [])
  function start(e: PointerEvent, id = '') {
    if (e.button !== 0 || drag.current) return
    e.stopPropagation()
    suppressClick.current = false
    drag.current = { id, pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    host.current?.setPointerCapture(e.pointerId)
  }
  function move(e: PointerEvent) {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) < 3 && !d.moved) return
    d.moved = true
    d.x = e.clientX
    d.y = e.clientY
    if (d.id) {
      const p = points.current.get(d.id)
      if (p) {
        p.x += dx / scale
        p.y += dy / scale
        p.vx = 0
        p.vy = 0
        redraw.current()
      }
    } else setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }
  function end(e: PointerEvent) {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    suppressClick.current = d.moved
    // Pointer capture targets the canvas on release; explicitly select a node on a tap.
    if (d.id && !d.moved && e.type !== 'pointercancel') onSelect(d.id)
    drag.current = null
    if (host.current?.hasPointerCapture(e.pointerId))
      host.current.releasePointerCapture(e.pointerId)
  }
  return (
    <div className="kg-canvas-wrap">
      <div
        className="kg-canvas"
        ref={host}
        aria-label="知识图谱画布，方向键平移"
        tabIndex={0}
        role="group"
        onKeyDown={(e) => {
          const directions: Record<string, [number, number]> = {
            ArrowLeft: [-30, 0],
            ArrowRight: [30, 0],
            ArrowUp: [0, -30],
            ArrowDown: [0, 30],
          }
          const d = directions[e.key]
          if (d) {
            e.preventDefault()
            setView((v) => ({ ...v, x: v.x + d[0], y: v.y + d[1] }))
          }
        }}
        onPointerDown={(e) => start(e)}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div
          className="kg-scene"
          style={{
            width: W,
            height: H,
            transform: `translate(${(size.w - W * scale) / 2 + view.x}px, ${(size.h - H * scale) / 2 + view.y}px) scale(${scale})`,
          }}
        >
          <svg width={W} height={H} className="kg-links" aria-hidden="true">
            {kinds
              .filter((kind) => nodes.some((n) => n.kind === kind))
              .map((kind) => (
                <g key={kind} className={'kg-cluster kg-' + kind}>
                  <circle cx={centers[kind][0]} cy={centers[kind][1]} r={compact ? 97 : 135} />
                  <text
                    x={centers[kind][0]}
                    y={centers[kind][1] - (compact ? 88 : 120)}
                    textAnchor="middle"
                  >
                    {kindLabels[kind]}
                  </text>
                </g>
              ))}
            {edges.map((edge) => (
              <line
                key={edge.id}
                ref={(el) => {
                  if (el) lines.current.set(edge.id, el)
                  else lines.current.delete(edge.id)
                }}
                className={
                  'kg-edge' +
                  (selected && (edge.source === selected || edge.target === selected)
                    ? ' is-connected'
                    : '') +
                  (selected && edge.source !== selected && edge.target !== selected
                    ? ' is-dim'
                    : '')
                }
              />
            ))}
          </svg>
          <div
            className="kg-center"
            aria-hidden="true"
            hidden={Boolean(focus)}
            style={{ left: W / 2 - 90, top: H / 2 - 35 }}
          >
            <span>人 · 岗 · 证</span>
            <small>关联知识网络</small>
          </div>
          {nodes.map((node) => (
            <button
              key={node.id}
              ref={(el) => {
                if (el) buttons.current.set(node.id, el)
                else buttons.current.delete(node.id)
              }}
              className={
                'kg-node kg-' +
                node.kind +
                (selected === node.id ? ' is-selected' : '') +
                (selected && selected !== node.id && !connected.has(node.id) ? ' is-dim' : '')
              }
              style={
                {
                  '--node-size':
                    node.kind === 'company' || node.kind === 'specialty' ? '36px' : '26px',
                } as CSSProperties
              }
              aria-label={kindLabels[node.kind] + '：' + node.label}
              aria-pressed={selected === node.id}
              title={node.label}
              onPointerDown={(e) => start(e, node.id)}
              onKeyDown={(e) => {
                const directions: Record<string, [number, number]> = {
                  ArrowLeft: [-15, 0],
                  ArrowRight: [15, 0],
                  ArrowUp: [0, -15],
                  ArrowDown: [0, 15],
                }
                const d = directions[e.key],
                  p = points.current.get(node.id)
                if (d && p) {
                  e.preventDefault()
                  e.stopPropagation()
                  p.x += d[0]
                  p.y += d[1]
                  p.tx = p.x
                  p.ty = p.y
                  redraw.current()
                }
              }}
              onClick={(e) => {
                if (!suppressClick.current || e.detail === 0) onSelect(node.id)
              }}
            >
              <span className="kg-node-orb" />
              <span className="kg-node-name">{node.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="kg-canvas-tools" aria-label="图谱视图操作">
        <button
          className="icon-button"
          aria-label="放大图谱"
          title="放大图谱"
          onClick={() => zoom(1.2)}
          disabled={view.zoom >= 2.8}
        >
          <Plus size={17} />
        </button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <button
          className="icon-button"
          aria-label="缩小图谱"
          title="缩小图谱"
          onClick={() => zoom(1 / 1.2)}
          disabled={view.zoom <= 0.55}
        >
          <Minus size={17} />
        </button>
        <button className="icon-button" aria-label="图谱居中" title="图谱居中" onClick={fit}>
          <Scan size={17} />
        </button>
      </div>
      <div className="kg-canvas-hint">
        <Move size={14} /> 拖拽节点或空白处 · 滚轮缩放 · 点击查看关联
      </div>
    </div>
  )
}
