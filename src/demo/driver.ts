import { artifactEvent, type DemoArtifact } from './runtime'
import {
  DemoClock,
  initialVisual,
  type DemoVisual,
  type Playback,
  type Point,
} from './presentation'
export type DemoStep = {
  chapter: string
  title: string
  description: string
  run: (ui: DemoDriver) => Promise<void>
}
const navigation: Record<string, string> = {
  '/': '管理总览',
  '/people': '人岗证台账',
  '/data': '数据导入与归并',
  '/rules': '证书与规则',
  '/issues': '预警与整改',
  '/reports': '统计报表',
  '/talent': '人才画像',
  '/settings': '演示设置',
}
export class DemoDriver {
  readonly clock: DemoClock
  private visual: DemoVisual
  constructor(
    readonly signal: AbortSignal,
    playback: () => Playback,
    readonly present: (patch: Partial<DemoVisual>) => void,
    readonly artifacts: () => DemoArtifact[],
    cursor: Point = initialVisual.cursor,
  ) {
    this.clock = new DemoClock(signal, playback)
    this.visual = { ...initialVisual, cursor }
  }
  get doc() {
    return document
  }
  get win() {
    return window
  }
  patch(patch: Partial<DemoVisual>) {
    this.visual = { ...this.visual, ...patch }
    this.present(patch)
  }
  async settle(ms = 240) {
    await this.clock.wait(ms)
  }
  scope(): Document | HTMLElement {
    return [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) || document
  }
  visible(el: Element) {
    return (
      !el.closest('[data-demo-ui]') &&
      el.checkVisibility({ checkVisibilityCSS: true }) &&
      el.getClientRects().length > 0
    )
  }
  async wait(find: () => HTMLElement | undefined | null, label: string) {
    for (let i = 0; i < 45; i++) {
      this.signal.throwIfAborted()
      const el = find()
      if (el && this.visible(el)) return el
      await this.settle(100)
    }
    throw new Error('暂时无法继续“' + label + '”，可以重新演示。')
  }
  async scroll(el: HTMLElement) {
    const bounds = el.getBoundingClientRect()
    const topInset = innerWidth <= 640 ? 140 : 90
    let clipped = false
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY)) {
        const r = p.getBoundingClientRect()
        if (bounds.top < r.top || bounds.bottom > r.bottom) clipped = true
      }
    }
    // 已可见的控件保持页面原位，避免每填一个字段都把页面重新居中。
    if (
      !clipped &&
      bounds.top >= topInset &&
      bounds.bottom <= innerHeight - 24 &&
      bounds.left >= 10 &&
      bounds.right <= innerWidth - 10
    )
      return
    const scrollers: Element[] = []
    for (let p = el.parentElement; p; p = p.parentElement)
      if (p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth) scrollers.push(p)
    if (document.scrollingElement && !scrollers.includes(document.scrollingElement))
      scrollers.push(document.scrollingElement)
    const before = scrollers.map((p) => ({ p, x: p.scrollLeft, y: p.scrollTop }))
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
    const positions = before.map((p) => ({ ...p, toX: p.p.scrollLeft, toY: p.p.scrollTop }))
    positions.forEach((p) => {
      p.p.scrollLeft = p.x
      p.p.scrollTop = p.y
    })
    if (positions.some((p) => Math.abs(p.toY - p.y) > 2 || Math.abs(p.toX - p.x) > 2)) {
      await this.clock.wait(450, (progress) => {
        const t = 1 - (1 - progress) ** 3
        positions.forEach((p) => {
          p.p.scrollTop = p.y + (p.toY - p.y) * t
          p.p.scrollLeft = p.x + (p.toX - p.x) * t
        })
      })
    }
  }
  async move(point: Point) {
    const from = this.visual.cursor,
      distance = Math.hypot(point.x - from.x, point.y - from.y)
    this.patch({ phase: 'moving' })
    await this.clock.wait(Math.min(950, 450 + distance * 0.4), (p) => {
      const t = p * p * (3 - 2 * p),
        bend = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : Math.sin(p * Math.PI) * Math.min(22, distance * 0.04)
      this.patch({
        cursor: { x: from.x + (point.x - from.x) * t + bend, y: from.y + (point.y - from.y) * t },
      })
    })
  }
  async pulse() {
    this.patch({ phase: 'clicking', pulse: this.visual.pulse + 1 })
    await this.clock.wait(300)
  }
  async mark(el: HTMLElement, action = '查看结果', result = false) {
    await this.scroll(el)
    if (result && innerWidth <= 640 && !el.closest('dialog')) {
      const r = el.getBoundingClientRect()
      const cardHeight =
        document.querySelector('.demo-callout')?.getBoundingClientRect().height || 340
      const desiredTop = cardHeight + 32
      const offset = desiredTop - r.top
      // 手机上的整组结果先为讲解卡片留出空间，再开始读字。
      if (offset > 0 && desiredTop + r.height <= innerHeight - 16 && scrollY >= offset) {
        const start = scrollY
        await this.clock.wait(450, (p) =>
          window.scrollTo({ top: start - offset * (1 - (1 - p) ** 3), behavior: 'instant' }),
        )
      }
    }
    document
      .querySelectorAll('[data-demo-target]')
      .forEach((e) => e.removeAttribute('data-demo-target'))
    el.setAttribute('data-demo-target', '')
    this.patch({ target: el, action, phase: 'orient', choices: null })
    await this.clock.wait(350)
    const r = el.getBoundingClientRect()
    await this.move({
      x: Math.max(12, Math.min(innerWidth - 28, r.x + Math.min(r.width / 2, 140))),
      y: Math.max(70, Math.min(innerHeight - 28, r.y + Math.min(r.height / 2, 55))),
    })
    await this.clock.wait(140)
  }
  async show(selector: string) {
    const el = await this.wait(
      () => [...this.scope().querySelectorAll<HTMLElement>(selector)].find((e) => this.visible(e)),
      '查看本步骤的内容',
    )
    await this.mark(el, '查看结果', true)
    this.patch({ phase: 'result', action: '查看结果' })
  }
  async go(path: string, title: string) {
    const url = new URL(path, location.origin)
    const label = navigation[url.pathname]
    if (!label) throw new Error('缺少演示导航入口')
    const link = [...document.querySelectorAll<HTMLAnchorElement>('.sidebar a')].find(
      (a) => a.getAttribute('aria-label') === label && this.visible(a),
    )
    if (link) await this.activate(link, '打开“' + label + '”')
    else {
      await this.click('打开导航菜单')
      await this.click(label, false)
    }
    await this.settle(350)
    if (url.searchParams.has('person')) {
      await this.go('/people', '人岗证台账')
      await this.fill('搜索姓名、工号、岗位', 'SCENE001')
      await this.clickCSS('a[href*="/people/scene-hv"]')
      await this.click('查看相关问题', false)
    }
    const tab = url.searchParams.get('tab')
    if (tab)
      await this.click(
        (
          { source: '岗位原表', normalize: '名称归并', import: '批量导入' } as Record<
            string,
            string
          >
        )[tab],
        false,
      )
    const q = url.searchParams.get('q')
    if (q)
      await this.fill(
        url.pathname === '/issues' ? '搜索人员、问题或负责人' : '搜索姓名、工号、岗位',
        q,
      )
    await this.wait(
      () => [...document.querySelectorAll<HTMLElement>('h1')].find((e) => e.textContent === title),
      title,
    )
  }
  async click(name: string, exact = true) {
    const el = await this.wait(
      () =>
        [...this.scope().querySelectorAll<HTMLElement>('button,a,summary')].find((e) => {
          const text = (e.getAttribute('aria-label') || e.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
          return this.visible(e) && (exact ? text === name : text.includes(name))
        }),
      name,
    )
    await this.activate(el)
  }
  async clickCSS(selector: string) {
    const el = await this.wait(
      () => [...this.scope().querySelectorAll<HTMLElement>(selector)].find((e) => this.visible(e)),
      '本步骤的操作入口',
    )
    await this.activate(el)
  }
  async activate(el: HTMLElement, action?: string) {
    if (el.matches(':disabled')) throw new Error('当前操作暂不可用')
    const name = (el.getAttribute('aria-label') || el.textContent || '确认选项')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40)
    await this.mark(el, action || '点击“' + name + '”')
    await this.pulse()
    const previousPage = location.hash,
      previousDialog = document.querySelector('dialog[open]')
    el.focus({ preventScroll: true })
    el.click()
    this.patch({ phase: 'result', action: '查看结果' })
    await this.settle(350)
    if (
      location.hash.split('?')[0] !== previousPage.split('?')[0] ||
      document.querySelector('dialog[open]') !== previousDialog
    )
      await this.settle(900)
  }
  async field(name: string) {
    return this.wait(
      () =>
        [
          ...this.scope().querySelectorAll<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          >('input,select,textarea'),
        ].find(
          (e) =>
            this.visible(e) &&
            (e.getAttribute('aria-label') === name ||
              [...(e.labels || [])].some((l) => l.querySelector('span')?.textContent === name)),
        ),
      name,
    ) as Promise<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  }
  async fill(name: string, value: string, optionLabel = false) {
    await this.fillElement(await this.field(name), value, name, optionLabel)
  }
  async fillElement(
    el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    value: string,
    name: string,
    optionLabel = false,
  ) {
    if (el.disabled) throw new Error('“' + name + '”暂不可编辑')
    await this.mark(el, '设置“' + name + '”')
    await this.pulse()
    el.focus({ preventScroll: true })
    const tag = el.tagName
    const proto =
      tag === 'SELECT'
        ? HTMLSelectElement.prototype
        : tag === 'TEXTAREA'
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype
    const set = (v: string) => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v)
      el.dispatchEvent(new Event(tag === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    }
    if (tag === 'SELECT') {
      const options = [...(el as HTMLSelectElement).options]
      const index = options.findIndex((o) => (optionLabel ? o.text === value : o.value === value))
      if (index < 0) throw new Error('没有找到“' + name + '”的目标选项')
      value = options[index].value
      const start = Math.max(0, Math.min(index - 2, options.length - 5))
      this.patch({
        choices: {
          element: el as HTMLSelectElement,
          values: options.slice(start, start + 5).map((o) => ({ value: o.value, label: o.text })),
          selected: value,
        },
        action: '选择“' + options[index].text + '”',
        phase: 'orient',
      })
      await this.clock.wait(700)
      const option = document.querySelector<HTMLElement>('[data-demo-option-selected="true"]')
      if (!option) throw new Error('演示选项尚未显示')
      const r = option.getBoundingClientRect()
      await this.move({ x: r.x + Math.min(r.width / 2, 120), y: r.y + r.height / 2 })
      await this.pulse()
      set(value)
      await this.clock.wait(300)
      this.patch({ choices: null })
    } else if (
      tag === 'TEXTAREA' ||
      !(el as HTMLInputElement).type ||
      ['text', 'search'].includes((el as HTMLInputElement).type)
    ) {
      this.patch({ phase: 'typing', action: '输入“' + name + '”' })
      set('')
      for (const char of [...value]) {
        await this.clock.wait(65)
        set(el.value + char)
      }
    } else {
      this.patch({ phase: 'typing', action: '将“' + name + '”设为 ' + value })
      await this.clock.wait(450)
      set(value)
    }
    this.patch({ phase: 'result', action: '已设置“' + name + '”' })
    await this.clock.wait(400)
    el.blur()
  }
  async upload(name: string, filename: string, contents: string | Blob) {
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="' + name + '"]',
    )
    if (!input) throw new Error('未找到文件导入入口')
    await this.mark(input.closest('label') || input, '选择示例文件：' + filename)
    await this.pulse()
    await this.clock.wait(650)
    const transfer = new DataTransfer()
    transfer.items.add(new File([contents], filename))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    this.patch({ phase: 'result', action: '查看导入预览' })
    await this.settle(450)
  }
  async downloadLink(selector: string) {
    const link = document.querySelector<HTMLAnchorElement>(selector)
    if (!link) throw new Error('未找到方案下载入口')
    await this.mark(link, '下载框架设计方案')
    await this.pulse()
    const response = await fetch(link.href, { signal: this.signal })
    if (!response.ok) throw new Error('方案文件读取失败')
    const blob = await response.blob()
    this.signal.throwIfAborted()
    window.dispatchEvent(new CustomEvent(artifactEvent, { detail: { name: link.download, blob } }))
  }
  async text(value: string) {
    await this.wait(
      () =>
        document.querySelector('main')?.textContent?.includes(value) ||
        document.querySelector('dialog[open]')?.textContent?.includes(value) ||
        document.querySelector('.toast')?.textContent?.includes(value)
          ? document.body
          : undefined,
      value,
    )
  }
  async saved() {
    await this.click('保存')
    await this.wait(
      () => (!document.querySelector('dialog[open]') ? document.body : undefined),
      '保存成功',
    )
  }
  async close() {
    await this.click('关闭弹窗')
  }
}
