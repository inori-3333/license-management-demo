import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Minus, Plus, Scan, RotateCcw, RotateCw } from 'lucide-react'
import type { Person } from '../model'
import type { PeopleCluster } from './clusters'
import { buildPointCloud, clusterBounds, type SpatialPoint } from './point-cloud'

type Camera = { x: number; y: number; z: number; yaw: number; pitch: number; zoom: number }
type Projection = { point: SpatialPoint; x: number; y: number; depth: number; scale: number }
const initialCamera = (): Camera => ({ x: 0, y: 0, z: 0, yaw: 0.3, pitch: -0.16, zoom: 1 })
const tokens = [
  '--flow-cyan',
  '--flow-blue',
  '--flow-violet',
  '--flow-mint',
  '--flow-amber',
  '--flow-coral',
]
export default function ClusterCanvas({
  groups,
  people,
  focus,
  personId,
  paused,
  reduced,
  reset,
  onPerson,
  onOverview,
}: {
  groups: PeopleCluster[]
  people: Person[]
  focus: string
  personId: string
  paused: boolean
  reduced: boolean
  reset: number
  onPerson: (id: string) => void
  onOverview: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 640 }),
    [hover, setHover] = useState('')
  const camera = useRef(initialCamera()),
    phase = useRef(0)
  const transition = useRef<{ from: Camera; to: Camera; start: number } | null>(null)
  const projection = useRef<Projection[]>([]),
    redraw = useRef(() => {}),
    zoomText = useRef<HTMLSpanElement>(null)
  const drag = useRef<{
    pointer: number
    x: number
    y: number
    moved: boolean
    point?: SpatialPoint
  } | null>(null)
  const points = useMemo(() => buildPointCloud(people, groups), [people, groups])
  const bounds = useMemo(() => clusterBounds(points, focus), [points, focus])
  const overview = useMemo(() => {
    if (!points.length) return initialCamera()
    const axes = ['x', 'y', 'z'] as const
    const center = { x: 0, y: 0, z: 0 }
    for (const axis of axes)
      center[axis] =
        (Math.min(...points.map((p) => p[axis])) + Math.max(...points.map((p) => p[axis]))) / 2
    const radius = Math.max(
      1,
      ...points.map((p) => Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z)),
    )
    const fit = (0.46 * Math.sqrt(Math.max(1, 900 * 900 - radius * radius))) / (1.05 * radius)
    return { ...initialCamera(), ...center, zoom: Math.max(0.4, Math.min(1.25, fit)) }
  }, [points])
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    )
    if (host.current) observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const goal = bounds
      ? {
          x: bounds.x,
          y: bounds.y,
          z: bounds.z,
          yaw: camera.current.yaw + 0.7,
          pitch: Math.max(
            -0.65,
            Math.min(0.65, -Math.atan2(bounds.y, Math.hypot(bounds.x, bounds.z) + 1) * 0.65),
          ),
          zoom: Math.max(1.35, Math.min(5.5, 900 / (bounds.radius * 2.6))),
        }
      : overview
    if (reduced) {
      camera.current = goal
      transition.current = null
    } else transition.current = { from: { ...camera.current }, to: goal, start: performance.now() }
    redraw.current()
  }, [bounds, personId, reset, reduced, overview])
  useEffect(() => {
    const el = canvas.current,
      ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = Math.min(devicePixelRatio || 1, 2)
    el.width = size.w * dpr
    el.height = size.h * dpr
    const style = getComputedStyle(document.documentElement),
      palette = tokens.map((t) => style.getPropertyValue(t).trim())
    const text = style.getPropertyValue('--flow-text').trim(),
      muted = style.getPropertyValue('--flow-muted').trim(),
      background = style.getPropertyValue('--flow-background').trim()
    let frame = 0,
      last = 0
    function draw(now: number) {
      frame = 0
      if (!ctx || !el) return
      const dt = last ? Math.min(now - last, 40) : 16
      last = now
      const moving = transition.current
      if (moving) {
        const progress = Math.min(1, (now - moving.start) / 1250),
          ease = 1 - Math.pow(1 - progress, 3)
        for (const key of Object.keys(camera.current) as (keyof Camera)[])
          camera.current[key] = moving.from[key] + (moving.to[key] - moving.from[key]) * ease
        if (progress === 1) transition.current = null
      }
      if (!paused && !document.hidden) {
        phase.current += dt / 1600
        if (!focus && !moving && !drag.current) camera.current.yaw += dt * 0.000045
      }
      const c = camera.current,
        cy = Math.cos(c.yaw),
        sy = Math.sin(c.yaw),
        cp = Math.cos(c.pitch),
        sp = Math.sin(c.pitch)
      const focal = Math.min(size.w, size.h) * 1.05
      const projected: Projection[] = []
      for (let i = 0; i < points.length; i++) {
        const point = points[i],
          drift = phase.current
        const x = point.x + Math.sin(drift + i * 1.1) * 3 - c.x,
          y = point.y + Math.cos(drift * 0.7 + i * 0.9) * 3 - c.y,
          z = point.z + Math.sin(drift * 0.5 + i) * 3 - c.z
        const rx = cy * x + sy * z,
          rz = -sy * x + cy * z,
          ry = cp * y - sp * rz,
          depth = 900 + sp * y + cp * rz
        if (depth < 60) continue
        const scale = (focal / depth) * c.zoom,
          px = size.w / 2 + rx * scale,
          py = size.h / 2 + ry * scale
        if (px < -40 || px > size.w + 40 || py < -40 || py > size.h + 40) continue
        projected.push({ point, x: px, y: py, depth, scale })
      }
      projected.sort((a, b) => b.depth - a.depth)
      projection.current = projected
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.w, size.h)
      for (const p of projected) {
        const active = focus ? p.point.groups.includes(focus) : true,
          selected = p.point.id === personId
        const color = p.point.color < 0 ? muted : palette[p.point.color]
        const radius = Math.max(1.2, Math.min(5.5, (selected ? 5.3 : 2.6) * p.scale))
        const alpha = active ? Math.max(0.28, Math.min(0.94, (1100 / p.depth) * 0.72)) : 0.1
        if (active && (selected || p.depth < 850)) {
          ctx.globalAlpha = selected ? 0.28 : 0.08
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(p.x, p.y, radius * 3.4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = alpha
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.fill()
        if (selected) {
          ctx.globalAlpha = 1
          ctx.fillStyle = text
          ctx.font = '13px sans-serif'
          ctx.textAlign = 'left'
          const width = ctx.measureText(p.point.name).width
          ctx.fillStyle = background
          ctx.fillRect(p.x + 9, p.y - 11, width + 9, 22)
          ctx.fillStyle = text
          ctx.fillText(p.point.name, p.x + 13, p.y + 5)
        }
      }
      ctx.globalAlpha = 1
      if (zoomText.current) zoomText.current.textContent = Math.round(c.zoom * 100) + '%'
      el.dataset.camera = [c.yaw, c.pitch, c.zoom, c.x, c.y, c.z].map((v) => v.toFixed(3)).join(',')
      el.dataset.projected = String(projected.length)
      if ((!paused || transition.current) && !document.hidden) frame = requestAnimationFrame(draw)
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
  }, [points, focus, personId, paused, size])
  function hit(clientX: number, clientY: number) {
    const r = canvas.current!.getBoundingClientRect(),
      x = clientX - r.left,
      y = clientY - r.top
    let found: SpatialPoint | undefined,
      near = 11
    // Prefer foreground points when projected distances are comparable.
    for (const p of [...projection.current].reverse()) {
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < near) {
        near = d
        found = p.point
      }
    }
    return found
  }
  function start(e: PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0 || drag.current) return
    drag.current = {
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      point: hit(e.clientX, e.clientY),
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (!d) {
      setHover(hit(e.clientX, e.clientY)?.name || '')
      return
    }
    if (d.pointer !== e.pointerId) return
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return
    d.moved = true
    d.x = e.clientX
    d.y = e.clientY
    transition.current = null
    camera.current.yaw += dx * 0.006
    camera.current.pitch = Math.max(-1.3, Math.min(1.3, camera.current.pitch + dy * 0.006))
    redraw.current()
  }
  function end(e: PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    if (!d.moved && d.point && e.type !== 'pointercancel') onPerson(d.point.id)
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
  function zoom(factor: number) {
    transition.current = null
    camera.current.zoom = Math.max(0.4, Math.min(8, camera.current.zoom * factor))
    redraw.current()
  }
  function rotate(delta: number) {
    transition.current = null
    camera.current.yaw += delta
    redraw.current()
  }
  useEffect(() => {
    const el = canvas.current,
      wheel = (e: WheelEvent) => {
        e.preventDefault()
        zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1)
      }
    el?.addEventListener('wheel', wheel, { passive: false })
    return () => el?.removeEventListener('wheel', wheel)
  }, [])
  return (
    <div className="kg-canvas-wrap kg-space-wrap">
      <div className="kg-canvas kg-space-canvas" ref={host}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`三维人员点云，共 ${points.length} 个数据点${bounds ? '，聚焦簇含 ' + bounds.count + ' 人' : ''}。每人一个点，方向键旋转，点击数据点聚焦证书簇；可通过成员列表选择人员。`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault()
              rotate(e.key === 'ArrowLeft' ? -0.15 : 0.15)
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              transition.current = null
              camera.current.pitch = Math.max(
                -1.3,
                Math.min(1.3, camera.current.pitch + (e.key === 'ArrowUp' ? -0.15 : 0.15)),
              )
              redraw.current()
            }
            if (e.key === 'Escape') onOverview()
          }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={() => setHover('')}
        />
        <div className="kg-space-label" aria-hidden="true">
          <span>3D</span>
          <small>{focus ? '簇内聚焦' : '全量关系空间'}</small>
        </div>
        {hover && <span className="kg-canvas-tooltip">{hover} · 点击旋转聚焦</span>}
      </div>
      <div className="kg-canvas-tools" aria-label="三维视角操作">
        <button className="icon-button" aria-label="向左旋转" onClick={() => rotate(-0.2)}>
          <RotateCcw size={16} />
        </button>
        <button className="icon-button" aria-label="向右旋转" onClick={() => rotate(0.2)}>
          <RotateCw size={16} />
        </button>
        <button className="icon-button" aria-label="放大图谱" onClick={() => zoom(1.25)}>
          <Plus size={17} />
        </button>
        <span ref={zoomText}>100%</span>
        <button className="icon-button" aria-label="缩小图谱" onClick={() => zoom(0.8)}>
          <Minus size={17} />
        </button>
        <button className="icon-button" aria-label="图谱居中" onClick={onOverview}>
          <Scan size={17} />
        </button>
      </div>
      <div className="kg-canvas-hint">拖拽旋转 · 滚轮缩放 · 点击人员聚焦所在簇</div>
    </div>
  )
}
