import type { Category, CertType, Rule } from './model'
export const categories: Category[] = [
  { id: 'national', name: '国家管控类', mandatory: true },
  { id: 'group', name: '集团管控类', mandatory: true },
  { id: 'incentive', name: '激励提升类', mandatory: false },
]
type Entry = [string, string, string, string, string, string?, number?]
const entries: Entry[] = [
  [
    'hv',
    '高压电工作业证',
    'national',
    '高压电气作业',
    '电气检修、运行岗位，从事交流 1 千伏以上或直流 1.5 千伏以上高压电气作业',
  ],
  [
    'lv',
    '低压电工作业证',
    'national',
    '低压电气作业',
    '电气检修、运行岗位，从事交流 1 千伏及以下或直流 1.5 千伏及以下低压电气作业',
  ],
  [
    'cable',
    '电力电缆作业证',
    'national',
    '电力电缆作业',
    '电气检修、运行岗位从事电缆运行、维护、安装、检修或试验',
  ],
  [
    'relay',
    '继电保护作业证',
    'national',
    '继电保护作业',
    '继电保护及自动装置运行、维护、调试、检验人员',
  ],
  ['test', '电气试验作业证', 'national', '电气试验作业', '电气设备交接试验、预防性试验人员'],
  ['weld', '焊接与热切割作业证', 'national', '焊接热切割', '检修岗位从事熔化焊接与热切割作业人员'],
  [
    'scaffold',
    '登高架设作业证',
    'national',
    '登高架设',
    '检修岗位高处架设或拆除脚手架、跨越架人员',
  ],
  [
    'height',
    '高处安装维护拆除作业证',
    'national',
    '高处安装维护拆除',
    '在悬空或攀登条件下从事安装、维护、拆除，不含有标准护栏的固定平台',
  ],
  ['hydrogen', '加氢工艺作业证', 'national', '氢气系统操作', '运行岗位涉及氢气系统操作人员'],
  [
    'confined',
    '有限空间安全作业证',
    'national',
    '有限空间作业',
    '进入受限、通风不良等有限空间作业人员',
  ],
  [
    'equipment',
    '特种设备安全管理证',
    'national',
    '特种设备管理',
    '生产技术部、安全环保部、车间、班组特种设备安全管理人员',
  ],
  ['crane-driver', '起重机司机作业证', 'national', '起重机操作', '检修岗位从事起重机操作人员'],
  ['crane-command', '起重机指挥作业证', 'national', '起重机指挥', '检修岗位从事起重机指挥人员'],
  ['elevator', '电梯修理作业证', 'national', '电梯修理', '检修岗位从事电梯维修人员'],
  ['forklift', '叉车司机作业证', 'national', '叉车操作', '生产、检修工作中操作叉车人员'],
  [
    'pressure',
    '快开门式压力容器操作证',
    'national',
    '快开门压力容器操作',
    '运行、检修岗位从事快开门式压力容器操作人员',
  ],
  ['fill', '移动式压力容器充装证', 'national', '移动压力容器充装', '移动式压力容器充装人员'],
  ['valve', '安全阀校验作业证', 'national', '安全阀校验', '负责安全阀定期校验、调试和维修人员'],
  [
    'equipment-weld',
    '特种设备焊接作业证',
    'national',
    '特种设备焊接',
    '从事特种设备金属或非金属焊接人员',
  ],
  ['fire', '消防设施操作员证', 'national', '消防设施操作', '自动消防系统操作岗位'],
  ['safety', '注册安全工程师证', 'national', '专职安全监督', '厂级、车间级专职安全监督人员'],
  ['legal', '法律职业资格证', 'national', '专职法务', '专职法务人员'],
  [
    'production',
    '生产岗位能力认证证书',
    'group',
    '生产岗位',
    '火电、燃机、水电、新能源、储能、制氢等生产人员',
  ],
  [
    'power-safety',
    '电力安全技能认证证书',
    'group',
    '安全生产相关',
    '安全管理、生产管理、基建管理、检修维护、运行操作、施工作业人员',
  ],
  ['supervision', '技术监督证', 'group', '专业技术监督', '生产技术部门专业技术监督专责人员'],
  ['fuel', '燃料采制化及化验证', 'group', '燃料采制化', '燃料采制化工作人员'],
  ['water', '水处理证', 'group', '水处理值班', '水处理值班人员'],
  ['lab', '水煤油化验证', 'group', '水煤油化验', '水煤油化验人员'],
  ['dispatch', '国家电网调度证', 'group', '运行调度', '运行值长、新能源场站运维人员'],
  [
    'account-junior',
    '初级会计师证',
    'group',
    '财务一般管理',
    '财务部门一般管理岗位人员',
    'accounting',
    1,
  ],
  [
    'account-middle',
    '中级会计师证',
    'group',
    '财务负责人主管',
    '财务部门负责人、主管',
    'accounting',
    2,
  ],
  [
    'account-senior',
    '高级会计师证',
    'incentive',
    '财务负责人主管',
    '财务相关人员',
    'accounting',
    3,
  ],
  [
    'skill-1',
    '职业技能等级证书（初级工）',
    'incentive',
    '技能岗位',
    '生产一线、碳排放管理、电力交易人员',
    'skill',
    1,
  ],
  [
    'skill-2',
    '职业技能等级证书（中级工）',
    'incentive',
    '技能岗位',
    '生产一线、碳排放管理、电力交易人员',
    'skill',
    2,
  ],
  [
    'skill-3',
    '职业技能等级证书（高级工）',
    'incentive',
    '技能岗位',
    '生产一线、碳排放管理、电力交易人员',
    'skill',
    3,
  ],
  [
    'skill-4',
    '职业技能等级证书（技师）',
    'incentive',
    '技能岗位',
    '生产一线、碳排放管理、电力交易人员',
    'skill',
    4,
  ],
  [
    'skill-5',
    '职业技能等级证书（高级技师）',
    'incentive',
    '技能岗位',
    '生产一线、碳排放管理、电力交易人员',
    'skill',
    5,
  ],
  ['engineering-supervisor', '注册监理工程师证', 'incentive', '工程监理', '从事监理管理工作'],
  ['cost', '注册造价工程师证', 'incentive', '工程造价', '从事造价管理工作'],
  ['builder', '注册建造师证', 'incentive', '工程建造', '从事建造管理工作'],
  ['audit', '中级审计师证', 'incentive', '审计', '专、兼职审计人员', 'audit', 2],
  ['economics', '中级经济师证', 'incentive', '经济', '经济相关人员', 'economics', 2],
  ['statistics', '中级统计师证', 'incentive', '统计', '统计相关人员', 'statistics', 2],
  ['tax', '税务师证', 'incentive', '税务', '税务相关人员'],
  ['engineer', '中级工程师职称', 'incentive', '工程技术', '工程技术人员', 'engineering', 2],
  ['engineer-senior', '高级工程师职称', 'incentive', '工程技术', '工程技术人员', 'engineering', 3],
]
export const certTypes: CertType[] = entries.map(
  ([id, name, categoryId, , scope, family, level]) => ({
    id,
    name,
    categoryId,
    scope,
    family: family || id,
    level: level || 1,
    basis: '《指导意见》第二部分持证范围、附件 1 与附件 2；正文优先',
  }),
)
export const rules: Rule[] = entries
  .filter(
    (e) =>
      !['account-senior', 'skill-2', 'skill-3', 'skill-4', 'skill-5', 'engineer-senior'].includes(
        e[0],
      ),
  )
  .map(([id, name, categoryId, tag]) => {
    const special = categoryId === 'national' && !['fire', 'safety', 'legal'].includes(id)
    const group = ['safety', 'legal'].includes(id)
    return {
      id: 'rule-' + id,
      title: name + '持证要求',
      certId: id,
      specialties: ['hv', 'lv', 'cable', 'relay', 'test'].includes(id)
        ? ['电气检修', '运行', '新能源', '储能']
        : ['weld', 'scaffold', 'height', 'crane-driver', 'crane-command', 'elevator'].includes(id)
          ? ['电气检修', '热控检修', '锅炉检修', '汽机检修', '新能源', '储能']
          : id === 'hydrogen'
            ? ['运行']
            : [],
      jobs: [],
      duties:
        categoryId === 'national' && !['safety', 'legal', 'equipment'].includes(id) ? [] : [tag],
      scopes:
        categoryId === 'national' && !['safety', 'legal', 'equipment'].includes(id) ? [tag] : [],
      mode: categoryId === 'incentive' ? 'development' : group ? 'group' : 'individual',
      deadline: special
        ? '2026-09-13'
        : id === 'account-junior'
          ? '2029-12-31'
          : id === 'account-middle'
            ? '2028-12-31'
            : '2026-12-31',
      milestones:
        id === 'safety'
          ? [
              { date: '2026-12-31', ratio: 0.5 },
              { date: '2028-12-31', ratio: 0.75 },
              { date: '2029-12-31', ratio: 1 },
            ]
          : id === 'legal'
            ? [
                { date: '2027-12-31', ratio: 0.8 },
                { date: '2028-12-31', ratio: 1 },
              ]
            : [],
      enabled: true,
      basis:
        '《指导意见》正文第二、三部分；特种作业以演示基准日视为已生效；证书具体范围参见附件 2。',
      difference:
        id === 'legal'
          ? '正文为 2027 年底 80%，附件为 2026 年底。本 Demo 按正文。'
          : id.startsWith('account-')
            ? '正文区分一般管理与负责人、主管的等级和期限；附件概括为初级及以上 100%。本 Demo 按正文。'
            : ['production', 'power-safety'].includes(id)
              ? '正文适用范围宽于附件列举岗位。本 Demo 采用正文范围。'
              : '',
    }
  })
export const scopeOptions = [...new Set(rules.flatMap((r) => r.scopes))]
export const dutyOptions = [...new Set(rules.flatMap((r) => r.duties))]
export const specialties = [
  '电气检修',
  '热控检修',
  '锅炉检修',
  '汽机检修',
  '运行',
  '燃料',
  '化学',
  '安全管理',
  '财务',
  '法务',
  '审计',
  '新能源',
  '储能',
  '综合管理',
]
