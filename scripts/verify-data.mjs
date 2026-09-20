import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const workbook = XLSX.read(readFileSync(new URL('../sources/岗位示例表.xlsx', import.meta.url)))
const cells = XLSX.utils.sheet_to_json(workbook.Sheets.Sheet1, { header: 1, defval: null }).slice(1)
const data = JSON.parse(readFileSync(new URL('../src/data/source.json', import.meta.url), 'utf8'))
assert.equal(data.length, 1315)
cells.forEach((row, i) => {
  assert.equal(data[i].row, i + 2)
  assert.deepEqual([data[i].company, data[i].department, data[i].team, data[i].job], row)
})
assert.equal(data.filter((x) => x.team === null).length, 124)
assert.equal(data.filter((x) => x.job === null).length, 4)
assert.equal(new Set(data.map((x) => x.company)).size, 15)
console.log('PASS: 原表 1315 行逐字段一致；15 家公司；124 处班组空白；4 处岗位空白。')
