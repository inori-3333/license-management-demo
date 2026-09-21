import { describe, expect, it } from 'vitest'
import {
  placeCallout,
  narrationPlan,
  narrationState,
  characterFill,
} from '../src/demo/presentation'
describe('局部讲解布局和阅读时间', () => {
  it('视线落定后才读字，读完仍停留，短句也不会立即跳页', () => {
    const text = '点击保存',
      plan = narrationPlan(text)
    expect(plan.reading).toBeGreaterThanOrEqual(3500)
    expect(narrationState(text, plan.settle - 1).progress).toBe(0)
    const middle = narrationState(text, plan.settle + plan.reading / 2)
    expect(middle.progress).toBe(0.5)
    expect(middle.phase).toBe('reading')
    const end = narrationState(text, plan.settle + plan.reading)
    expect(end.progress).toBe(1)
    expect(end.remaining).toBeGreaterThanOrEqual(1200)
    expect(end.phase).toBe('holding')
    expect(narrationState(text, plan.total).remaining).toBe(0)
  })
  it('逐字颜色按顺序推进，当前字可以部分变色', () => {
    expect([0, 1, 2, 3].map((i) => characterFill(i, 4, 0.375))).toEqual([100, 50, 0, 0])
    expect(characterFill(0, 4, 0)).toBe(0)
    expect(characterFill(3, 4, 1)).toBe(100)
  })
  it('在目标旁有空间时避开目标与展开的选项', () => {
    const result = placeCallout(
      { x: 1040, y: 110, width: 180, height: 38 },
      { width: 340, height: 320 },
      { width: 1440, height: 1000 },
      { x: 1040, y: 150, width: 220, height: 198 },
    )
    expect(
      result.x + 340 <= 1040 || result.x >= 1260 || result.y >= 348 || result.y + 320 <= 110,
    ).toBe(true)
    expect(result.y).toBeGreaterThanOrEqual(12)
  })
  it('窄屏在输入框下方放置卡片并保持可见', () => {
    const result = placeCallout(
      { x: 24, y: 200, width: 330, height: 38 },
      { width: 310, height: 300 },
      { width: 390, height: 844 },
    )
    expect(result.y).toBeGreaterThanOrEqual(238)
    expect(result.x).toBeGreaterThanOrEqual(12)
    expect(result.x + 310).toBeLessThanOrEqual(378)
    expect(result.y + 300).toBeLessThanOrEqual(832)
  })
})

it('窄屏展开下拉时将卡片放在整个选项列表之后', () => {
  const result = placeCallout(
    { x: 20, y: 210, width: 180, height: 38 },
    { width: 310, height: 330 },
    { width: 390, height: 844 },
    { x: 20, y: 254, width: 220, height: 198 },
  )
  expect(result.y).toBeGreaterThanOrEqual(452)
  expect(result.y + 330).toBeLessThanOrEqual(832)
})
