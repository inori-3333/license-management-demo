import type { DemoStep } from './driver'
import { fields } from '../io'

const step = (
  chapter: string,
  title: string,
  description: string,
  // 脚本直接调用的动作数（不含 text 断言）；复合动作如 go / saved 计一次。
  actions: DemoStep['actions'],
  run: DemoStep['run'],
): DemoStep => ({ chapter, title, description, actions, run })
const csv = (kind: keyof typeof fields, values: string[][]) =>
  [fields[kind], ...values]
    .map((r) => r.map((v) => '"' + v.replaceAll('"', '""') + '"').join(','))
    .join('\n')
const personRow = [
  'AUTO-IMPORT',
  '批量导入演示员',
  'A公司',
  '生产技术部',
  '',
  '电修技术员',
  '电气检修',
  '生产岗位',
  '高压电气作业',
  '是',
  '2024-01-01',
]

// 一段对应一个完整业务结果；同类选项展示代表用法，不再逐个反复切换。
export const demoSteps: DemoStep[] = [
  step(
    '管理总览',
    '总览与单位筛选',
    '选择公司后，待办和持证指标同步更新，快速定位管理重点。',
    3,
    async (u) => {
      await u.go('/', '管理总览')
      await u.fill('所属公司', 'A公司')
      await u.show('.kpi-grid')
    },
  ),
  step(
    '人岗证台账',
    '查询与维护人员',
    '通过工号找到人员，集中查看并维护任职信息和证书缺口。',
    (u) => (u.win.innerWidth <= 640 ? 9 : 10),
    async (u) => {
      await u.go('/people', '人岗证台账')
      await u.fill('每页条数', '10')
      await u.click('下一页')
      if (u.win.innerWidth > 640) await u.click('紧凑表格')
      await u.fill('搜索姓名、工号、岗位', 'SCENE001')
      await u.clickCSS('a[href*="/people/scene-hv"]')
      await u.click('编辑人员与任职')
      await u.fill('班组', '自动演示班组')
      await u.saved()
      await u.show('.detail-summary')
    },
  ),
  step(
    '人岗证台账',
    '新增人员与兼岗',
    '一名员工可以记录多个岗位，后续按各项任职检查持证要求。',
    16,
    async (u) => {
      await u.go('/people', '人岗证台账')
      await u.click('新增人员')
      await u.click('保存')
      await u.text('请检查必填项')
      await u.fill('姓名', '自动演示员')
      await u.fill('工号', 'AUTO-NEW')
      await u.fill('公司', 'A公司')
      await u.fill('部门', '演示培训部')
      await u.fill('岗位', '培训专员')
      await u.click('添加兼岗')
      const inputs = u
        .scope()
        .querySelectorAll('.form-section')[1]
        .querySelectorAll<HTMLInputElement>('input')
      for (const [i, value] of [
        [0, 'A公司'],
        [1, '综合管理部'],
        [3, '培训联络员'],
      ] as const)
        await u.fillElement(inputs[i], value, { 0: '兼岗公司', 1: '兼岗部门', 3: '兼岗岗位' }[i])
      await u.saved()
      await u.fill('搜索姓名、工号、岗位', 'AUTO-NEW')
      await u.clickCSS('a[href*="/people/person"]')
      await u.show('.assignment-grid')
    },
  ),
  step(
    '人岗证台账',
    '持证维护与台账导出',
    '持证记录支持补录、修改和确认删除，台账可按筛选范围导出。',
    11,
    async (u) => {
      await u.click('补录证书')
      await u.click('填入演示有效日期')
      await u.saved()
      await u.click('编辑')
      await u.fill('证书编号', 'AUTO-CERT-EDIT')
      await u.saved()
      await u.click('删除证书', false)
      await u.click('删除持证记录')
      await u.go('/people?q=AUTO-NEW', '人岗证台账')
      await u.click('导出筛选结果')
      await u.show('.table-panel')
    },
  ),
  step(
    '导入与归并',
    '原始来源与批量导入',
    '原表可以追溯，导入会校验错误行，同一工号再次导入会更新。',
    19,
    async (u) => {
      await u.go('/data?tab=source', '数据导入与名称归并')
      await u.click('导出原始值', false)
      await u.click('批量导入', false)
      for (const kind of ['positions', 'people', 'credentials'] as const) {
        const name = { positions: '原始岗位表', people: '人员与任职', credentials: '持证记录' }[
          kind
        ]
        const rows =
          kind === 'positions'
            ? [['A公司', '演示培训部', '', '演示岗位']]
            : kind === 'people'
              ? [personRow, ['', '待修正示例', ...personRow.slice(2)]]
              : [
                  [
                    'AUTO-IMPORT-CERT',
                    'AUTO-IMPORT',
                    '高压电工作业证',
                    'AUTO-001',
                    '2026-09-13',
                    '指定日期',
                    '2028-09-13',
                    '指定日期',
                    '2027-09-13',
                    '正常',
                  ],
                ]
        await u.click(name, false)
        await u.click('下载对应模板')
        await u.upload('选择导入文件', kind + '-demo.csv', csv(kind, rows))
        await u.text('确认列映射')
        await u.click('导入可用记录')
        await u.text('本批次已导入')
      }
      await u.click('人员与任职', false)
      await u.upload(
        '选择导入文件',
        'people-update.csv',
        csv('people', [[personRow[0], '批量导入演示员（已更新）', ...personRow.slice(2)]]),
      )
      await u.text('更新')
      await u.click('导入可用记录')
      await u.show('.table-panel')
    },
  ),
  step(
    '导入与归并',
    '统一名称口径',
    '岗位、部门和证书名称经确认后统一统计，原始名称始终保留。',
    16,
    async (u) => {
      await u.click('名称归并', false)
      for (const [kind, raw, standard] of [
        ['job', '电修技术员', '电气检修技术员'],
        ['department', '生技部', '生产技术部'],
        ['cert', '注安师', '注册安全工程师证'],
      ] as const) {
        await u.fill('归并类型', kind)
        await u.fill('原始名称', raw)
        await u.fill(kind === 'cert' ? '标准证书名称' : '确认采用的标准名称', standard)
        await u.click('确认名称映射')
      }
      await u.click('修改映射')
      await u.click('确认名称映射')
      await u.show('.table-panel')
    },
  ),
  step(
    '证书与规则',
    '维护证书目录',
    '证书按管理性质分类，适用范围和依据都在统一目录中维护。',
    17,
    async (u) => {
      await u.go('/rules', '证书与持证规则')
      await u.click('统计口径与来源差异', false)
      await u.click('新增类别')
      await u.fill('类别名称', '自动演示培训类')
      await u.fill('管理性质', 'development')
      await u.saved()
      await u.click('证书目录', false)
      await u.click('新增证书类型')
      await u.fill('证书名称', '自动演示培训证')
      await u.fill('证书类别', '自动演示培训类', true)
      await u.fill('适用人员范围', '演示培训部')
      await u.saved()
      await u.fill('搜索规则或证书名称', '自动演示培训证')
      await u.click('编辑证书')
      await u.fill('依据', '仅用于自动演示的培训记录')
      await u.saved()
      await u.show('.table-panel')
    },
  ),
  step(
    '证书与规则',
    '配置持证规则',
    '规则支持个人期限、群体阶段目标和培养建议，并可按需停用。',
    19,
    async (u) => {
      await u.click('清空搜索')
      await u.click('持证规则', false)
      await u.click('新增规则')
      await u.fill('规则名称', '自动演示岗位规则')
      await u.fill('要求证书', '自动演示培训证', true)
      await u.fill('标准岗位', '演示岗位')
      await u.fill('个人达标期限', '2027-12-31')
      await u.saved()
      await u.fill('搜索规则或证书名称', '自动演示岗位规则')
      await u.click('编辑规则')
      await u.fill('管理方式', 'group')
      await u.click('添加阶段')
      await u.fill('目标持证率（%）', '80')
      await u.saved()
      await u.click('编辑规则')
      await u.fill('管理方式', 'development')
      await u.clickCSS('input[type="checkbox"]')
      await u.saved()
      await u.show('.table-panel')
    },
  ),
  step(
    '预警与整改',
    '分派、整改与复核',
    '问题经分派和整改后提交复核，缺证尚未解决时系统会阻止销项。',
    17,
    async (u) => {
      await u.go('/people?q=SCENE001', '人岗证台账')
      await u.clickCSS('a[href*="/people/scene-hv"]')
      await u.click('查看相关问题', false)
      await u.fill('搜索人员、问题或负责人', '高压电工作业证')
      await u.click('处理详情')
      await u.fill('整改负责人', '演示负责人')
      await u.fill('复核人', '演示复核人')
      await u.fill('整改／复核说明', '补齐高压作业证书')
      await u.click('分派整改')
      await u.click('处理详情')
      await u.click('开始整改')
      await u.click('处理详情')
      await u.fill('整改／复核说明', '提交材料供复核')
      await u.click('提交复核')
      await u.click('处理详情')
      await u.click('复核通过并销项')
      await u.show('[role="alert"]')
    },
  ),
  step(
    '预警与整改',
    '补证并完成销项',
    '退回补齐有效证书后，再次复核通过，完整处理过程保留在时间线。',
    19,
    async (u) => {
      await u.fill('复核结论', 'reject')
      await u.fill('整改／复核说明', '请补录证书')
      await u.click('退回整改')
      await u.click('处理详情')
      await u.click('查看并更新人员证书', false)
      await u.click('补录证书')
      await u.fill('标准证书', '高压电工作业证', true)
      await u.click('填入演示有效日期')
      await u.saved()
      await u.click('查看相关问题', false)
      await u.fill('搜索人员、问题或负责人', '高压电工作业证')
      await u.click('处理详情')
      await u.click('提交复核')
      await u.click('处理详情')
      await u.click('复核通过并销项')
      await u.click('已销项', false)
      await u.click('导出问题清单')
      await u.click('处理详情')
      await u.show('.timeline')
    },
  ),
  step(
    '预警与整改',
    '风险再次出现',
    '证书过期后系统会重新发现问题，原有整改历史不会丢失。',
    5,
    async (u) => {
      await u.close()
      await u.fill('统计日期', '2029-09-13')
      await u.click('待处理', false)
      await u.click('处理详情')
      await u.text('重新发现')
      await u.show('.timeline')
    },
  ),
  step(
    '统计报表',
    '报表明细与分布分析',
    '报表可以追溯计算口径，也能按公司、专业或证书比较持证分布。',
    12,
    async (u) => {
      await u.close()
      await u.fill('统计日期', '2026-09-13')
      await u.go('/reports', '统计报表')
      await u.click('查看明细')
      await u.show('.report-facts')
      await u.close()
      await u.click('全部指标')
      await u.click('选择显示与导出的列')
      await u.clickCSS('.column-options input[type="checkbox"]')
      await u.fill('报表类型', 'distribution')
      await u.fill('分组维度', 'specialty')
      await u.show('.report-output')
    },
  ),
  step(
    '统计报表',
    '保存方案与导出',
    '常用分析条件可以保存，结果支持 Excel、CSV 导出及打印。',
    13,
    async (u) => {
      await u.fill('报表类型', 'expiry')
      await u.fill('提醒时间范围', '30')
      await u.fill('所属公司', 'A公司')
      await u.click('保存方案')
      await u.fill('方案名称', '自动演示 · 30天临期')
      await u.saved()
      await u.fill('已保存方案', '')
      await u.fill('已保存方案', '自动演示 · 30天临期', true)
      await u.fill('所属公司', '')
      await u.fill('提醒时间范围', '0')
      await u.click('导出 Excel')
      await u.click('CSV')
      u.doc.documentElement.classList.add('demo-print-preview')
      await u.show('.print-only')
    },
  ),
  step(
    '人才画像',
    '按岗位与持证条件筛选',
    '按公司和当前岗位缩小人选范围，多选证书时须同时持有且在评估日期有效。',
    10,
    async (u) => {
      u.doc.documentElement.classList.remove('demo-print-preview')
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
    },
  ),
  step(
    '人才画像',
    '岗位匹配与培训需求',
    '按目标岗位和上岗日期筛选人选，将所选人员的取证缺口转为培训需求。',
    18,
    async (u) => {
      await u.click('选择目标岗位')
      await u.fill('搜索岗位名称或专业', '储能')
      await u.click('储能运维工程师', false)
      await u.click('调整目标专业、职责、作业范围与上岗日期')
      await u.fill('任职开始日期', '2027-01-01')
      await u.click('调整目标专业、职责、作业范围与上岗日期')
      await u.fill('匹配结果', '存在取证缺口')
      await u.clickCSS('input[aria-label^="选择 "]')
      await u.click('导出培训需求', false)
      await u.click('清除选择', false)
      await u.click('清空证书筛选')
      await u.click('按当前岗位筛选')
      await u.click('全部岗位')
      await u.fill('所属公司', '')
      await u.fill('搜索姓名、工号、岗位', '不存在的演示人员')
      await u.show('.empty')
      await u.click('清空搜索')
      await u.show('.talent-summary')
    },
  ),
  step(
    '知识图谱',
    '关系全景与人员定位',
    '从六类节点的关系全景出发，按类型和工号定位人员，查看任职与持证关联。',
    (u) => (u.win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 9 : 10),
    async (u) => {
      await u.go('/knowledge-graph?view=entities', '知识图谱')
      if (!u.win.matchMedia('(prefers-reduced-motion: reduce)').matches) await u.click('暂停动效')
      await u.show('.kg-canvas')
      await u.click('放大图谱')
      await u.click('缩小图谱')
      await u.click('图谱居中')
      await u.fill('节点类型', 'person')
      await u.fill('搜索人员、岗位、证书或规则', 'SCENE001')
      await u.clickCSS('.kg-result.kg-person')
      await u.text('局部关联')
      await u.show(u.win.innerWidth <= 640 ? '.kg-inspector .kg-result.kg-cert' : '.kg-inspector')
    },
  ),
  step(
    '知识图谱',
    '关联追溯与业务跳转',
    '从人员详情追溯证书与适用规则，打开业务页面核对，并演示清除空结果。',
    18,
    async (u) => {
      await u.click('打开人员详情')
      await u.show('.detail-summary')
      await u.go('/knowledge-graph?view=entities', '知识图谱')
      await u.fill('节点类型', 'cert')
      await u.fill('搜索人员、岗位、证书或规则', '高压电工作业证')
      await u.clickCSS('.kg-result.kg-cert')
      await u.show('.kg-inspector')
      await u.clickCSS('.kg-result.kg-rule')
      await u.text('高压电工作业证持证要求')
      await u.click('展开关联')
      await u.show('.kg-inspector')
      await u.click('打开证书与规则')
      await u.show('.table-panel')
      await u.go('/knowledge-graph?view=entities', '知识图谱')
      await u.fill('搜索人员、岗位、证书或规则', '不存在的演示节点')
      await u.show('.kg-no-results')
      await u.click('清除筛选')
      await u.click('回到全景')
      await u.show('.kg-canvas')
    },
  ),
  step(
    '演示设置',
    '提醒设置与备份恢复',
    '提醒天数可以自定义，完整备份支持恢复人员、规则和处理记录。',
    8,
    async (u) => {
      await u.go('/settings', '演示设置')
      await u.fill('提醒天数', '180，90，30，14，7')
      await u.click('保存提醒设置')
      await u.click('导出 JSON 备份')
      const backup = [...u.artifacts()].reverse().find((a) => a.name.endsWith('.json'))
      if (!backup) throw new Error('未生成演示备份')
      await u.upload('选择 JSON 备份', backup.name, backup.blob)
      await u.click('恢复备份')
      await u.text('备份已恢复')
      await u.downloadLink('a[download]')
      await u.show('main .panel')
    },
  ),
  step(
    '演示设置',
    '回到演示起点',
    '演示已覆盖九个业务模块，退出后回到您原来的页面和数据。',
    4,
    async (u) => {
      await u.click('重置演示数据')
      await u.click('重置演示数据')
      await u.go('/', '管理总览')
      await u.show('.kpi-grid')
    },
  ),
]
