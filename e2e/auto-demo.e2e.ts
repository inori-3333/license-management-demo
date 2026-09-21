import { test, expect, type Page } from '@playwright/test'
import { demoSteps } from '../src/demo/steps'
import * as XLSX from 'xlsx'
const key = 'license-management-demo.v1'
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
  await page.clock.install()
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
  expect(demoSteps).toHaveLength(16)
  const seen = new Set<string>()
  for (let i = 0; i < demoSteps.length; i++) {
    await until(
      page,
      async () =>
        (await page.locator('.demo-callout').getAttribute('data-step')) === String(i) &&
        (await page.locator('.demo-callout').getAttribute('data-ready')) === 'true',
    )
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
    Array.from({ length: 14 }, (_, i) => i + 1),
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

test('鼠标轨迹、逐字讲解、稳定焦点与立即暂停', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.clock.install()
  await page.getByRole('button', { name: '自动演示', exact: true }).click()
  await expect(page.locator('iframe,dialog[open]')).toHaveCount(0)
  await until(
    page,
    async () => (await page.locator('.demo-callout').getAttribute('data-phase')) === 'moving',
  )
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
  const frozen = await page.locator('.demo-cursor').evaluate((e) => getComputedStyle(e).transform)
  await tick(page, 4000)
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
  await expect(card).toHaveAttribute('data-phase', 'settling')
  await expect(lyrics).toHaveAttribute('data-progress', '0')
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
  await until(page, async () => Number(await lyrics.getAttribute('data-progress')) > 0)
  await tick(page, 800)
  const progress = Number(await lyrics.getAttribute('data-progress'))
  expect(progress).toBeGreaterThan(0)
  expect(progress).toBeLessThan(1)
  await expect(action).toBeEmpty()
  expect(await stableView()).toEqual(settled)
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
  await page.clock.install()
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
