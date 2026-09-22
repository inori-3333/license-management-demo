import { test, expect, type Page } from '@playwright/test'
import { demoPlans } from '../src/demo/plans'
import * as XLSX from 'xlsx'
const key = 'license-management-demo.v1'

async function clock(page: Page) {
  await expect(page.locator('#startup-screen')).toHaveCount(0)
  const time = Date.now()
  await page.clock.install({ time })
  await page.clock.pauseAt(time + 1000)
}
async function until(page: Page, predicate: () => Promise<boolean>) {
  for (let i = 0; i < 1800; i++) {
    const error = (await page.locator('.demo-error').allTextContents()).join('')
    if (error) throw new Error(error)
    if (await predicate()) return
    await page.clock.runFor(500)
  }
  throw new Error('精简演示未到达预期结果')
}

test('默认精简演示完整主线、标准速度时长与数据恢复', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/#/settings')
  await page.getByLabel('提醒天数').fill('90，31，7')
  await page.getByRole('button', { name: '保存提醒设置', exact: true }).click()
  const before = await page.evaluate((k) => localStorage.getItem(k), key)
  await clock(page)
  await page.getByRole('button', { name: '自动演示', exact: true }).click()
  await expect(page.getByLabel('演示版本')).toHaveValue('brief')
  await expect(page.getByLabel('演示版本')).toBeFocused()
  await page.screenshot({ path: `docs/inline-demo/${info.project.name}-demo-picker.png` })
  const start = await page.evaluate(() => Date.now())
  await page.getByRole('button', { name: '开始演示', exact: true }).click()
  await expect(page.getByLabel('演示播放速度')).toHaveValue('1')
  const timings: { title: string; seconds: number }[] = []
  let previous = start
  for (let i = 0; i < demoPlans.brief.steps.length; i++) {
    await until(
      page,
      async () =>
        (await page.locator('.demo-callout').getAttribute('data-step')) === String(i) &&
        (await page.locator('.demo-callout').getAttribute('data-ready')) === 'true',
    )
    const step = demoPlans.brief.steps[i]
    const now = await page.evaluate(() => Date.now())
    timings.push({ title: step.title, seconds: (now - previous) / 1000 })
    previous = now
    await expect(page.locator('.demo-callout')).toHaveAttribute('data-mode', 'brief')
    await expect(page.locator('.demo-karaoke')).toHaveAttribute('data-progress', '1')
    expect([...step.description].length).toBeLessThanOrEqual(40)
    console.log(`精简 ${i + 1}/11 ${step.title}: ${timings.at(-1)!.seconds}s`)
    if (i === 1) await expect(page.locator('.assignment-grid')).toContainText('自动演示班组')
    if (i === 4)
      await expect(page.locator('dialog[open] [role="alert"]')).toContainText('问题尚未解决')
    if (i === 5) await expect(page.locator('.timeline')).toContainText('销项')
    if (i === 7) {
      await expect(page.getByLabel('生产岗位能力认证证书', { exact: true })).toBeChecked()
      await expect(page.getByLabel('电力安全技能认证证书', { exact: true })).toBeChecked()
      await expect(page.locator('.table-panel')).toContainText('检修工')
    }
    if (i === 8) {
      await expect(page.getByLabel('聚类依据')).toHaveValue('company')
      await expect(page.locator('.kg-member-list')).toContainText('SCENE001')
      await expect(page.locator('.kg-space-canvas canvas')).toHaveAttribute(
        'aria-label',
        /共 1365 个数据点/,
      )
    }
    if (i === 9) {
      await expect(page).toHaveURL(/#\/rules/)
      await expect(page.locator('.table-panel')).toContainText('高压电工作业证持证要求')
    }
    await page.screenshot({ path: `docs/inline-demo/${info.project.name}-brief-${i + 1}.png` })
  }
  await until(page, async () => (await page.locator('.flow-overview').count()) === 1)
  const seconds = ((await page.evaluate(() => Date.now())) - start) / 1000
  console.log(`精简标准 1× ${info.project.name}: ${seconds}s（受控浏览器时钟，无跳步）`)
  expect(seconds).toBeLessThan(420)
  await info.attach('brief-timing.json', {
    body: JSON.stringify({ seconds, timings }, null, 2),
    contentType: 'application/json',
  })
  await expect(page.locator('.flow-complete')).toContainText('11 个环节')
  await expect(page.locator('.flow-complete')).toContainText('9 个业务模块')
  const mapped = await page.locator('.flow-node-steps b').allTextContents()
  expect(mapped.map(Number).sort((a, b) => a - b)).toEqual(
    Array.from({ length: 10 }, (_, i) => i + 1),
  )
  await expect(page.locator('.flow-support')).toContainText('11 提醒设置与备份恢复')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: `docs/inline-demo/${info.project.name}-brief-overview.png`,
    fullPage: true,
  })
  const files = await page.locator('.demo-file-list a').evaluateAll(async (links) =>
    Promise.all(
      links.map(async (a) => ({
        name: (a as HTMLAnchorElement).download,
        bytes: [
          ...new Uint8Array(await (await fetch((a as HTMLAnchorElement).href)).arrayBuffer()),
        ],
      })),
    ),
  )
  expect(files).toHaveLength(5)
  const backup = JSON.parse(
    Buffer.from(files.find((f) => f.name.endsWith('.json'))!.bytes).toString(),
  )
  expect(backup.people).toHaveLength(1365)
  expect(
    backup.people.filter((p: { employeeNo: string }) => p.employeeNo === 'AUTO-IMPORT'),
  ).toHaveLength(1)
  const training = XLSX.read(Uint8Array.from(files.find((f) => f.name.includes('培训需求'))!.bytes))
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
    training.Sheets[training.SheetNames[0]],
  )
  expect(rows.length).toBeGreaterThan(0)
  expect(new Set(rows.map((r) => r['工号'])).size).toBe(1)
  const person = backup.people.find((p: { employeeNo: string }) => p.employeeNo === rows[0]['工号'])
  expect(person.assignments.some((a: { job: string }) => a.job === '检修工')).toBe(true)
  const contents = JSON.stringify(rows)
  for (const value of ['A公司', '储能运维工程师', '2027-01-01']) expect(contents).toContain(value)
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before)
  await page.getByRole('button', { name: '重新演示', exact: true }).click()
  await expect(page.locator('.demo-callout')).toHaveAttribute('data-mode', 'brief')
  await expect(page.locator('.demo-callout')).toHaveAttribute('data-step', '0')
  await page.getByRole('button', { name: '退出演示', exact: true }).click()
  await page.clock.runFor(100)
  await expect(page).toHaveURL(/#\/settings$/)
  await expect(page.getByRole('button', { name: '自动演示', exact: true })).toBeFocused()
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before)
  expect(errors).toEqual([])
})

test('演示选择可切换、Escape 取消并回焦，退出完整版后默认仍为精简版', async ({ page }) => {
  await page.goto('/#/people?q=SCENE001')
  await clock(page)
  const before = await page.evaluate((k) => localStorage.getItem(k), key)
  const trigger = page.getByRole('button', { name: '自动演示', exact: true })
  await trigger.click()
  await page.getByLabel('演示版本').selectOption('full')
  await expect(page.getByLabel('演示版本')).toHaveValue('full')
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.locator('.demo-callout')).toHaveCount(0)
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before)
  await trigger.click()
  await expect(page.getByLabel('演示版本')).toHaveValue('brief')
  await page.getByLabel('演示版本').selectOption('full')
  await page.getByRole('button', { name: '开始演示', exact: true }).click()
  await expect(page.locator('.demo-callout')).toHaveAttribute('data-mode', 'full')
  await page.getByRole('button', { name: '退出演示', exact: true }).click()
  await page.clock.runFor(100)
  await expect(page).toHaveURL(/#\/people\?q=SCENE001$/)
  await trigger.click()
  await expect(page.getByLabel('演示版本')).toHaveValue('brief')
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(trigger).toBeFocused()
})
