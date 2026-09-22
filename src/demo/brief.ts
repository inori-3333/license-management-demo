import { demoSteps, step, csv, personRow } from './steps'
import type { DemoStep } from './driver'

// 汇报主线只保留代表操作；复核拦截与补证闭环复用完整版，避免两套业务语义。
export const briefSteps: DemoStep[] = [
  demoSteps[0],
  step(
    '人岗证台账',
    '人员、任职与持证要求',
    '找到人员，查看任职和证书缺口，并维护班组信息。',
    7,
    async (u) => {
      await u.go('/people', '人岗证台账')
      await u.fill('搜索姓名、工号、岗位', 'SCENE001')
      await u.clickCSS('a[href*="/people/scene-hv"]')
      await u.click('编辑人员与任职')
      await u.fill('班组', '自动演示班组')
      await u.saved()
      await u.show('.detail-summary')
    },
  ),
  step(
    '导入与归并',
    '导入人员并统一岗位名称',
    '导入时校验错误行，再将岗位别名归并到标准名称，保留原始来源。',
    12,
    async (u) => {
      await u.go('/data?tab=import', '数据导入与名称归并')
      await u.click('人员与任职', false)
      await u.upload(
        '选择导入文件',
        'people-demo.csv',
        csv('people', [personRow, ['', '待修正示例', ...personRow.slice(2)]]),
      )
      await u.text('确认列映射')
      await u.show('.table-panel')
      await u.click('导入可用记录')
      await u.click('名称归并', false)
      await u.fill('归并类型', 'job')
      await u.fill('原始名称', '电修技术员')
      await u.fill('确认采用的标准名称', '电气检修技术员')
      await u.click('确认名称映射')
      await u.click('岗位原表', false)
      await u.show('.table-panel')
    },
  ),
  step(
    '证书与规则',
    '核对证书要求与适用条件',
    '持证规则关联标准证书、适用岗位与作业范围，判断有依据可查。',
    7,
    async (u) => {
      await u.go('/rules', '证书与持证规则')
      await u.fill('搜索规则或证书名称', '高压电工作业证')
      await u.click('编辑规则')
      await u.show('form .form-grid:nth-of-type(2)')
      await u.close()
      await u.click('统计口径与来源差异', false)
      await u.show('.policy-disclosure')
    },
  ),
  demoSteps[8],
  demoSteps[9],
  step(
    '统计报表',
    '分析持证分布并导出',
    '查看指标的计算明细，再按专业比较持证分布并导出报表。',
    9,
    async (u) => {
      await u.close()
      await u.go('/reports', '统计报表')
      await u.click('查看明细')
      await u.show('.report-facts')
      await u.close()
      await u.fill('报表类型', 'distribution')
      await u.fill('分组维度', 'specialty')
      await u.click('导出 Excel')
      await u.show('.report-output')
    },
  ),
  step(
    '人才画像',
    '筛选人选并生成培训需求',
    '用当前岗位和持证条件筛选，再按目标岗位与上岗日期生成取证培训需求。',
    21,
    async (u) => {
      await u.go('/talent', '人才画像与岗位匹配')
      await u.fill('所属公司', 'A公司')
      await u.click('按当前岗位筛选')
      await u.fill('搜索岗位名称或专业', '检修工')
      await u.click('检修工')
      await u.click('按已持有证书筛选', false)
      await u.click('生产岗位能力认证证书')
      await u.click('电力安全技能认证证书')
      await u.click('按已持有证书筛选', false)
      await u.show('.table-panel')
      await u.click('选择目标岗位')
      await u.fill('搜索岗位名称或专业', '储能')
      await u.click('储能运维工程师', false)
      await u.click('调整目标专业、职责、作业范围与上岗日期')
      await u.fill('任职开始日期', '2027-01-01')
      await u.click('调整目标专业、职责、作业范围与上岗日期')
      await u.fill('匹配结果', '存在取证缺口')
      await u.clickCSS('input[aria-label^="选择 "]')
      await u.click('导出培训需求', false)
      await u.show('.talent-summary')
      await u.show('.table-panel')
    },
  ),
  step(
    '知识图谱',
    '从全量聚类定位人员',
    '全量人员每人一个点，从共同持证定位人员，再按公司查看同类人员。',
    (u) => (u.win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 10 : 11),
    async (u) => {
      await u.go('/knowledge-graph', '知识图谱')
      if (!u.win.matchMedia('(prefers-reduced-motion: reduce)').matches) await u.click('暂停动效')
      await u.show('.kg-space-canvas')
      await u.fill('搜索证书、姓名或工号', 'SCENE001')
      await u.clickCSS('.kg-inspector .kg-result.kg-person')
      await u.show('.kg-member-card')
      await u.fill('聚类依据', 'company')
      await u.fill('搜索公司、姓名或工号', 'A公司')
      await u.clickCSS('.kg-inspector .kg-result.kg-company')
      await u.fill('搜索簇内姓名、工号或公司', 'SCENE001')
      await u.show('.kg-member-list')
    },
  ),
  step(
    '知识图谱',
    '沿人员、证书追溯规则',
    '从人员关联到有效证书，再追溯适用规则，打开业务页面核对。',
    (u) => (u.win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 10 : 11),
    async (u) => {
      await u.go('/knowledge-graph?view=entities', '知识图谱')
      if (!u.win.matchMedia('(prefers-reduced-motion: reduce)').matches) await u.click('暂停动效')
      await u.fill('节点类型', 'person')
      await u.fill('搜索人员、岗位、证书或规则', 'SCENE001')
      await u.clickCSS('.kg-result.kg-person')
      await u.clickCSS('.kg-inspector .kg-result.kg-cert')
      await u.show('.kg-inspector')
      await u.clickCSS('.kg-inspector .kg-result.kg-rule')
      await u.show('.kg-inspector')
      await u.click('打开证书与规则')
      await u.show('.table-panel')
    },
  ),
  demoSteps[21],
]
