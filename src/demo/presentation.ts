export type Point = { x: number; y: number }
export type Rect = Point & { width: number; height: number }
export type DemoVisual = {
  target: HTMLElement | null
  cursor: Point
  action: string
  phase: 'orient' | 'moving' | 'clicking' | 'typing' | 'settling' | 'reading' | 'holding' | 'result'
  pulse: number
  choices: {
    element: HTMLSelectElement
    values: { value: string; label: string }[]
    selected: string
  } | null
}
export type Playback = { paused: boolean; speed: number; skipReading: number }
// 每个实际操作占一段字幕；操作内部使用同一时钟平滑推进，完成后到达该段终点。
export class ActionNarration {
  private completed = 0
  private elapsed = 0
  constructor(
    readonly actions: number,
    readonly update: (progress: number) => void,
  ) {}
  advance(ms: number) {
    this.elapsed += ms
    this.update((this.completed + this.elapsed / (this.elapsed + 1800)) / this.actions)
  }
  complete() {
    this.completed++
    this.elapsed = 0
    this.update(this.completed / this.actions)
  }
}
export const resultHold = 1200
export const characterFill = (index: number, length: number, progress: number) =>
  Math.max(0, Math.min(1, progress * length - index)) * 100
export const initialVisual: DemoVisual = {
  target: null,
  cursor: { x: 80, y: 120 },
  action: '准备开始',
  phase: 'orient',
  pulse: 0,
  choices: null,
}

// 一只可暂停的时钟驱动移动、点击、输入和阅读，暂停不会继续填完表单。
export class DemoClock {
  onAdvance?: (ms: number) => void
  constructor(
    readonly signal: AbortSignal,
    readonly playback: () => Playback,
  ) {}
  async wait(duration: number, tick?: (progress: number) => void) {
    this.signal.throwIfAborted()
    await new Promise<void>((resolve, reject) => {
      let elapsed = 0,
        last = performance.now(),
        frame = 0
      const cancel = () => {
        cancelAnimationFrame(frame)
        reject(new DOMException('演示已结束', 'AbortError'))
      }
      const next = (now: number) => {
        if (!this.playback().paused) {
          const delta = Math.min(
            duration - elapsed,
            Math.min(80, now - last) * this.playback().speed,
          )
          elapsed += delta
          this.onAdvance?.(delta)
        }
        last = now
        tick?.(Math.min(1, elapsed / duration))
        if (elapsed >= duration) {
          this.signal.removeEventListener('abort', cancel)
          resolve()
        } else frame = requestAnimationFrame(next)
      }
      this.signal.addEventListener('abort', cancel, { once: true })
      frame = requestAnimationFrame(next)
    })
    this.signal.throwIfAborted()
  }
  async read(duration: number, progress: (value: number) => void) {
    const skip = this.playback().skipReading
    let elapsed = 0
    while (elapsed < duration && skip === this.playback().skipReading) {
      await this.wait(100)
      elapsed += 100
      progress(Math.min(1, elapsed / duration))
    }
  }
}

export function placeCallout(
  target: Rect,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
  avoid?: Rect,
) {
  const gap = 18,
    margin = 12
  const candidates = [
    { x: target.x + target.width + gap, y: target.y + target.height / 2 - card.height / 2 },
    { x: target.x - card.width - gap, y: target.y + target.height / 2 - card.height / 2 },
    { x: target.x + target.width / 2 - card.width / 2, y: target.y + target.height + gap },
    { x: target.x + target.width / 2 - card.width / 2, y: target.y - card.height - gap },
  ]
  if (avoid) {
    const left = Math.min(target.x, avoid.x),
      right = Math.max(target.x + target.width, avoid.x + avoid.width)
    const top = Math.min(target.y, avoid.y),
      bottom = Math.max(target.y + target.height, avoid.y + avoid.height)
    candidates.push(
      { x: (left + right - card.width) / 2, y: bottom + gap },
      { x: (left + right - card.width) / 2, y: top - card.height - gap },
      { x: right + gap, y: (top + bottom - card.height) / 2 },
      { x: left - card.width - gap, y: (top + bottom - card.height) / 2 },
    )
  }
  const overlap = (a: Rect, b: Rect) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return candidates
    .map((p) => {
      const point = {
        x: Math.max(margin, Math.min(viewport.width - card.width - margin, p.x)),
        y: Math.max(margin, Math.min(viewport.height - card.height - margin, p.y)),
      }
      const rect = { ...point, ...card }
      return {
        ...point,
        score:
          overlap(rect, target) * 100 +
          (avoid ? overlap(rect, avoid) * 100 : 0) +
          Math.hypot(point.x - p.x, point.y - p.y),
      }
    })
    .sort((a, b) => a.score - b.score)[0]
}
