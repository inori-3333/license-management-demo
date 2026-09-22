import { test, expect, type Page } from '@playwright/test'
import { demoSteps } from '../src/demo/steps'
import * as XLSX from 'xlsx'
const key = 'license-management-demo.v1'
async function installClock(page: Page) {
  const time = Date.now()
  await page.clock.install({ time })
  // 仅由 tick 推进，避免截图和断言耗时令短暂的结果停留自动结束。
  await page.clock.pauseAt(time + 1000)
}
async function tick(page: Page, ms = 100) {
  await page.clock.runFor(ms)
}
async function until(page: Page, predicate: () => Promise<boolean>, limit = 1800) {
  for (let i = 0; i < limit; i++) {
    const error = (await page.locator('.demo-error').allTextContents()).join('')
    if (error) throw new Error(error)
    if (await predicate()) return
    await tick(page)
  }
  throw new Error('演示未到达预期状态：' + (await page.locator('.demo-callout').textContent()))
}

test('原页面完整演示与原数据保护', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#/settings')
  await page.getByLabel('提醒天数').fill('90，31，7')
  await page.getByRole('button', { name: '保存提醒设置', exact: true }).click()
  const before = await page.evaluate((k) => localStorage.getItem(k), key)
  const density = await page.evaluate(() => localStorage.getItem('license-management.ui-density'))
  await installClock(page)
  await page.getByRole('button', { name: '自动演示', exact: true }).click()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(page.locator('.app')).toHaveCount(1)
  // 只加速完整业务回归；可见鼠标、阅读时间和暂停另按标准速度验证。
  await page.getByLabel('演示播放速度').evaluate((el) => {
    const select = el as HTMLSelectElement
    select.add(new Option('回归测试时钟', '100'))
    select.value = '100'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(demoSteps).toHaveLength(17)
  const seen = new Set<string>()
  for (let i = 0; i < demoSteps.length; i++) {
    await until(
      page,
      async () =>
        (await page.locator('.demo-callout').getAttribute('data-step')) === String(i) &&
        (await page.locator('.demo-callout').getAttribute('data-ready')) === 'true',
    )
    await expect(page.locator('.demo-karaoke')).toHaveAttribute('data-progress', '1')
    const step = demoSteps[i]
    expect([...step.description].length).toBeLessThanOrEqual(40)
    console.log(`${i + 1}/${demoSteps.length} ${step.title}`)
    if (!seen.has(step.chapter)) {
      seen.add(step.chapter)
      await page.screenshot({
        path: `docs/inline-demo/${testInfo.project.name}-chapter-${seen.size}.png`,
      })
    }
    if (step.title === '分派、整改与复核')
      await expect(page.locator('dialog[open] [role="alert"]')).toContainText('问题尚未解决')
    if (step.title === '补证并完成销项')
      await expect(page.locator('.timeline')).toContainText('销项')
    if (step.title === '按岗位与持证条件筛选') {
      const filters = new URLSearchParams(new URL(page.url()).hash.split('?')[1])
      expect(filters.get('company')).toBe('A公司')
      expect(filters.get('job')).toBe('检修工')
      expect(filters.get('certificates')?.split(',')).toEqual(['production', 'power-safety'])
      await expect(page.getByLabel('生产岗位能力认证证书', { exact: true })).toBeChecked()
      await expect(page.getByLabel('电力安全技能认证证书', { exact: true })).toBeChecked()
      const rows = page.locator('.table-panel tbody tr')
      expect(await rows.count()).toBeGreaterThan(0)
      for (const row of await rows.all()) {
        await expect(row).toContainText('检修工')
        await expect(row).toContainText('A公司')
        await expect(row).toContainText('生产岗位能力认证证书')
        await expect(row).toContainText('电力安全技能认证证书')
      }
      await page.screenshot({
        path: `docs/inline-demo/${testInfo.project.name}-talent-filters.png`,
      })
    }
    if (step.title === '岗位匹配与培训需求') {
      const filters = new URLSearchParams(new URL(page.url()).hash.split('?')[1])
      for (const name of ['company', 'job', 'certificates', 'q'])
        expect(filters.get(name)).toBeNull()
      await expect(page.getByRole('button', { name: '清空证书筛选' })).toHaveCount(0)
      await page.screenshot({
        path: `docs/inline-demo/${testInfo.project.name}-talent-training.png`,
      })
    }
    if (i < demoSteps.length - 1)
      await page.getByRole('button', { name: '下一条', exact: true }).click()
  }
  await until(page, async () => (await page.locator('.flow-overview').count()) === 1)
  await expect(page.getByRole('heading', { name: '把每个环节，连成管理闭环' })).toBeFocused()
  await expect(page.locator('.demo-presentation')).toHaveCount(0)
  await expect(page.locator('.flow-node')).toHaveCount(6)
  await tick(page, 4500)
  const mapped = await page.locator('.flow-node-steps b').allTextContents()
  expect(mapped.map(Number).sort((a, b) => a - b)).toEqual(
    Array.from({ length: 15 }, (_, i) => i + 1),
  )
  await page.screenshot({
    path: `docs/inline-demo/${testInfo.project.name}-flow-overview.png`,
    fullPage: true,
  })
  await page
    .locator('.flow-canvas')
    .screenshot({ path: `docs/inline-demo/${testInfo.project.name}-flow-map.png` })
  const nodes = page.locator('.flow-node')
  for (const node of await nodes.all()) {
    await node.click()
    await expect(node).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#flow-stage-detail h2')).toHaveText(
      await node.locator('strong').innerText(),
    )
    if (testInfo.project.name === 'mobile')
      await expect(node.locator('.flow-inline-detail')).toBeVisible()
  }
  await page.locator('.flow-support').click()
  await expect(page.locator('.flow-support')).toContainText(
    '16 提醒设置与备份恢复 · 17 回到演示起点',
  )
  await expect(page.locator('#flow-stage-detail')).toContainText('提醒设置与备份恢复')
  await expect(page.locator('#flow-stage-detail')).toContainText('回到演示起点')
  // 键盘可选择节点；窄屏自然纵向阅读，不产生整页横向滚动。
  await page.locator('[data-stage="fix"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#flow-stage-detail')).toContainText('补证并完成销项')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('button', { name: '已减少动态效果' })).toBeDisabled()
    expect(
      await page
        .locator('.flow-line-stream')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none')
  } else {
    await page.getByRole('button', { name: '暂停连线', exact: true }).click()
    expect(
      await page
        .locator('.flow-line-stream')
        .first()
        .evaluate((el) => getComputedStyle(el).animationPlayState),
    ).toBe('paused')
    await page.getByRole('button', { name: '播放连线', exact: true }).click()
    expect(
      await page
        .locator('.flow-line-stream')
        .first()
        .evaluate((el) => getComputedStyle(el).animationPlayState),
    ).toBe('running')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '播放连线', exact: true })).toBeVisible()
  }
  await page.locator('.demo-options-panel summary').click()
  const files = await page.locator('.demo-file-list a').evaluateAll(async (links) =>
    Promise.all(
      links.map(async (a) => ({
        name: a.getAttribute('download')!,
        bytes: Array.from(
          new Uint8Array(await (await fetch((a as HTMLAnchorElement).href)).arrayBuffer()),
        ),
      })),
    ),
  )
  expect(files).toHaveLength(11)
  const db = JSON.parse(
    new TextDecoder().decode(new Uint8Array(files.find((f) => f.name.endsWith('.json'))!.bytes)),
  )
  expect(db.warningDays).toContain(14)
  expect(
    db.people.find((p: { employeeNo: string }) => p.employeeNo === 'AUTO-NEW').assignments,
  ).toHaveLength(2)
  expect(
    db.people.find((p: { employeeNo: string }) => p.employeeNo === 'AUTO-IMPORT').name,
  ).toContain('已更新')
  expect(db.aliases).toHaveLength(3)
  expect(db.reports.some((r: { name: string }) => r.name.includes('30天临期'))).toBeTruthy()
  expect(
    db.issues.some((i: { history: { action: string }[] }) =>
      i.history.some((h) => h.action === '重新发现'),
    ),
  ).toBeTruthy()
  expect(
    XLSX.read(new Uint8Array(files.find((f) => f.name === '人员岗位台账.xlsx')!.bytes)).SheetNames,
  ).toEqual(['数据'])
  const trainingBook = XLSX.read(
    new Uint8Array(files.find((f) => f.name === '目标岗位培训需求.xlsx')!.bytes),
  )
  const training = XLSX.utils.sheet_to_json<Record<string, string>>(trainingBook.Sheets['数据'])
  expect(training.length).toBeGreaterThan(0)
  expect(new Set(training.map((row) => row['工号'])).size).toBe(1)
  for (const row of training) {
    expect(row['当前公司']).toBe('A公司')
    expect(row['目标岗位']).toBe('储能运维工程师')
    expect(row['资格评估日期']).toBe('2027-01-01')
    const person = db.people.find((p: { employeeNo: string }) => p.employeeNo === row['工号'])
    expect(person.assignments.some((a: { job: string }) => a.job === '检修工')).toBe(true)
  }
  await page.screenshot({ path: `docs/inline-demo/${testInfo.project.name}-completed.png` })
  if (testInfo.project.name === 'desktop') {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.getByRole('button', { name: '已减少动态效果' })).toBeDisabled()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 684, height: 900 })
    await tick(page)
    await expect(page.locator('[data-stage="fix"] .flow-inline-detail')).toBeVisible()
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .filter(
          (el) =>
            el.getBoundingClientRect().right > innerWidth + 1 &&
            getComputedStyle(el).position !== 'fixed',
        )
        .map((el) => ({
          tag: el.tagName,
          class: el.className,
          right: el.getBoundingClientRect().right,
        })),
    )
    expect(overflow).toEqual([])
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: 'docs/inline-demo/tablet-flow-overview.png', fullPage: true })
    await page.setViewportSize({ width: 1280, height: 720 })
    await tick(page)
    await expect(page.locator('[data-stage="fix"] .flow-inline-detail')).toBeHidden()
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: 'docs/inline-demo/laptop-flow-overview.png', fullPage: true })
    await page.getByRole('button', { name: '重新演示', exact: true }).click()
    await tick(page)
    await expect(page.locator('.flow-overview')).toHaveCount(0)
    await expect(page.locator('.demo-callout')).toHaveAttribute('data-step', '0')
    await page.getByRole('button', { name: '退出演示', exact: true }).click()
  } else {
    await page.getByRole('button', { name: '结束演示', exact: true }).click()
  }
  await tick(page, 100)
  await expect(page).toHaveURL(/#\/settings$/)
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before)
  expect(await page.evaluate(() => localStorage.getItem('license-management.ui-density'))).toBe(
    density,
  )
  await expect(page.locator('.demo-presentation')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('人才筛选支持证书交集、有效日期、清空及键盘操作', async ({ page }) => {
  await page.goto('/#/talent')
  await page.getByLabel('所属公司', { exact: true }).selectOption('A公司')
  await page.getByRole('button', { name: '按当前岗位筛选', exact: true }).click()
  await page.getByPlaceholder('搜索岗位名称或专业').fill('检修工')
  await page.getByRole('button', { name: '检修工', exact: true }).click()
  await expect(page).toHaveURL(/job=/)
  await page.getByText('按已持有证书筛选（不限，可多选）', { exact: true }).click()
  for (const name of ['生产岗位能力认证证书', '电力安全技能认证证书']) {
    await page.locator('label').filter({ hasText: name }).click()
    await expect(page.getByLabel(name, { exact: true })).toBeChecked()
  }
  await expect(page.locator('.pagination')).toContainText('共 6 条')
  const lowVoltage = page.getByLabel('低压电工作业证', { exact: true })
  await lowVoltage.focus()
  await lowVoltage.press('Space')
  await expect(lowVoltage).toBeChecked()
  await expect(page.locator('.empty')).toContainText('暂无匹配结果')
  await lowVoltage.press('Space')
  await expect(lowVoltage).not.toBeChecked()
  await expect(page.locator('.pagination')).toContainText('共 6 条')
  await page.getByText('调整目标专业、职责、作业范围与上岗日期', { exact: true }).click()
  await page.getByLabel('任职开始日期', { exact: true }).fill('2029-01-01')
  await expect(page.locator('.empty')).toBeVisible()
  await page.getByLabel('任职开始日期', { exact: true }).fill('2026-09-13')
  await expect(page.locator('.pagination')).toContainText('共 6 条')
  await page.getByRole('button', { name: '清空证书筛选', exact: true }).click()
  await expect(page.getByLabel('生产岗位能力认证证书', { exact: true })).not.toBeChecked()
  await expect(page.getByLabel('电力安全技能认证证书', { exact: true })).not.toBeChecked()
  await page.getByRole('button', { name: '按当前岗位筛选', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '按当前岗位筛选', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: '按当前岗位筛选', exact: true })).toContainText(
    '检修工',
  )
  await page.getByRole('button', { name: '按当前岗位筛选', exact: true }).click()
  await page.getByRole('button', { name: '全部岗位', exact: true }).click()
  await expect(page).not.toHaveURL(/job=|certificates=/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('顶部紧凑表格的演示点击落在按钮中心', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', '窄屏不显示表格密度按钮')
  await page.goto('/')
  await installClock(page)
  await page.getByRole('button', { name: '自动演示', exact: true }).click()
  await until(
    page,
    async () => (await page.locator('.demo-callout').getAttribute('data-ready')) === 'true',
  )
  await page.getByRole('button', { name: '下一条', exact: true }).click()
  await until(
    page,
    async () =>
      (await page.locator('.demo-cursor.is-clicking').count()) > 0 &&
      (await page.locator('[data-demo-target]').textContent())?.trim() === '紧凑表格',
  )
  const target = await page.locator('[data-demo-target]').boundingBox()
  const cursor = await page.locator('.demo-cursor').boundingBox()
  expect(target!.y + target!.height).toBeLessThan(70)
  await page.screenshot({ path: testInfo.outputPath('topbar-click.png') })
  expect(Math.abs(cursor!.x - (target!.x + target!.width / 2))).toBeLessThan(1)
  expect(Math.abs(cursor!.y - (target!.y + target!.height / 2))).toBeLessThan(1)
  await tick(page, 400)
  await expect(page.getByRole('button', { name: '紧凑表格', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: '退出演示', exact: true }).click()
})

test('鼠标轨迹、逐字讲解、稳定焦点与立即暂停', async ({ page }, testInfo) => {
  await page.goto('/')
  await installClock(page)
  await page.getByRole('button', { name: '自动演示', exact: true }).click()
  await expect(page.locator('iframe,dialog[open]')).toHaveCount(0)
  await until(
    page,
    async () => (await page.locator('.demo-callout').getAttribute('data-phase')) === 'moving',
  )
  const words = page.locator('.demo-karaoke')
  expect(Number(await words.getAttribute('data-progress'))).toBeGreaterThan(0)
  expect(Number(await words.getAttribute('data-progress'))).toBeLessThan(1)
  const first = await page.locator('.demo-cursor').evaluate((e) => getComputedStyle(e).transform)
  const action = page.locator('.demo-action')
  await expect(action).toBeVisible()
  expect(await action.textContent()).not.toBe('')
  expect((await action.boundingBox())!.height).toBeLessThanOrEqual(40)
  await tick(page, 200)
  const second = await page.locator('.demo-cursor').evaluate((e) => getComputedStyle(e).transform)
  expect(second).not.toBe(first)
  await page.getByRole('button', { name: '暂停演示', exact: true }).click()
  await expect(action).toBeEmpty()
  await expect(action).toBeHidden()
  const frozenWords = await words.getAttribute('data-progress')
  const frozen = await page.locator('.demo-cursor').evaluate((e) => getComputedStyle(e).transform)
  await tick(page, 4000)
  await expect(words).toHaveAttribute('data-progress', frozenWords!)
  expect(await page.locator('.demo-cursor').evaluate((e) => getComputedStyle(e).transform)).toBe(
    frozen,
  )
  await page.getByRole('button', { name: '继续演示', exact: true }).click()
  await until(page, async () => (await page.locator('.demo-select-preview').count()) > 0)
  await page.getByRole('button', { name: '暂停演示', exact: true }).click()
  await page.screenshot({ path: `docs/inline-demo/${testInfo.project.name}-selection.png` })
  const rects = await page.evaluate(() => ({
    card: document.querySelector('.demo-callout')!.getBoundingClientRect().toJSON(),
    target: document.querySelector('[data-demo-target]')!.getBoundingClientRect().toJSON(),
    width: innerWidth,
    height: innerHeight,
  }))
  expect(rects.card.x).toBeGreaterThanOrEqual(0)
  expect(rects.card.right).toBeLessThanOrEqual(rects.width)
  expect(rects.card.bottom).toBeLessThanOrEqual(rects.height)
  const overlap =
    Math.max(
      0,
      Math.min(rects.card.right, rects.target.right) - Math.max(rects.card.x, rects.target.x),
    ) *
    Math.max(
      0,
      Math.min(rects.card.bottom, rects.target.bottom) - Math.max(rects.card.y, rects.target.y),
    )
  expect(overlap).toBe(0)
  await page.getByRole('button', { name: '继续演示', exact: true }).click()
  const card = page.locator('.demo-callout'),
    lyrics = page.locator('.demo-karaoke')
  await until(page, async () => (await card.getAttribute('data-ready')) === 'true')
  await tick(page, 300)
  await expect(card).toHaveAttribute('data-phase', 'holding')
  await expect(lyrics).toHaveAttribute('data-progress', '1')
  await expect(action).toBeEmpty()
  await expect(action).toBeHidden()
  const stableView = () =>
    page.evaluate(() => ({
      url: location.href,
      x: scrollX,
      y: scrollY,
      target: document.querySelector('[data-demo-target]')?.getBoundingClientRect().toJSON(),
      card: document.querySelector('.demo-callout')?.getBoundingClientRect().toJSON(),
    }))
  const settled = await stableView()
  const a = settled.card!,
    b = settled.target!
  expect(a.right <= b.x || a.x >= b.right || a.bottom <= b.y || a.y >= b.bottom).toBe(true)
  await page.getByRole('button', { name: '暂停演示', exact: true }).click()
  const pausedWords = await lyrics.getAttribute('data-progress')
  await page.screenshot({ path: `docs/inline-demo/${testInfo.project.name}-karaoke.png` })
  await tick(page, 2000)
  await expect(lyrics).toHaveAttribute('data-progress', pausedWords!)
  expect(await stableView()).toEqual(settled)
  await page.getByRole('button', { name: '继续演示', exact: true }).click()
  await until(page, async () => (await card.getAttribute('data-phase')) === 'holding')
  await expect(lyrics).toHaveAttribute('data-progress', '1')
  expect(await page.locator('.demo-character[data-read="true"]').count()).toBe(
    [...demoSteps[0].description].length,
  )
  await tick(page, 600)
  await expect(card).toHaveAttribute('data-step', '0')
  expect(await stableView()).toEqual(settled)
  await until(page, async () => (await card.getAttribute('data-step')) === '1')
  await page.getByRole('button', { name: '退出演示', exact: true }).click()
  await tick(page, 100)
  await expect(page.getByRole('button', { name: '自动演示', exact: true })).toBeFocused()
})

test('逐字输入可暂停，业务弹窗中退出与重播恢复数据', async ({ page }, testInfo) => {
  await page.goto('/#/settings')
  await page.getByLabel('提醒天数').fill('90，31，7')
  await page.getByRole('button', { name: '保存提醒设置', exact: true }).click()
  const before = await page.evaluate((k) => localStorage.getItem(k), key)
  await installClock(page)
  await page.getByRole('button', { name: '自动演示', exact: true }).click()
  const speed = page.getByLabel('演示播放速度')
  await speed.evaluate((el) => {
    const select = el as HTMLSelectElement
    select.add(new Option('测试时钟', '100'))
    select.value = '100'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await until(
    page,
    async () =>
      (await page.locator('.demo-callout').getAttribute('data-step')) === '1' &&
      (await page.locator('.demo-callout').getAttribute('data-ready')) === 'true',
  )
  await speed.evaluate((el) => {
    ;(el as HTMLSelectElement).value = '1'
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.getByRole('button', { name: '下一条', exact: true }).click()
  for (let i = 0; i < 2400; i++) {
    if (
      (await page.locator('.demo-callout').getAttribute('data-phase')) === 'typing' &&
      (await page
        .locator('input[data-demo-target]')
        .inputValue()
        .catch(() => '')) === '自动'
    )
      break
    await tick(page, 50)
    if (i === 2399) throw new Error('未捕获逐字输入')
  }
  const input = page.locator('input[data-demo-target]')
  await page.getByRole('button', { name: '暂停演示', exact: true }).click()
  const partial = await input.inputValue()
  expect(partial).not.toBe('自动演示员')
  await tick(page, 3000)
  await expect(input).toHaveValue(partial)
  await expect(page.locator('dialog[open]')).toHaveCount(1)
  await page.screenshot({ path: `docs/inline-demo/${testInfo.project.name}-typing-paused.png` })
  await page.locator('.demo-options-panel summary').click()
  await page.getByRole('button', { name: '重新演示', exact: true }).click()
  await tick(page, 100)
  await expect(page.locator('.demo-callout')).toHaveAttribute('data-step', '0')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await page.getByRole('button', { name: '退出演示', exact: true }).click()
  await tick(page, 3000)
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before)
  await expect(page).toHaveURL(/#\/settings$/)
  await expect(page.locator('[data-demo-ui], [data-demo-target]')).toHaveCount(0)
})
