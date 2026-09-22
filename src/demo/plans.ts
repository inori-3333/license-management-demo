import { briefSteps } from './brief'
import { demoSteps } from './steps'

export type DemoMode = 'brief' | 'full'
export const demoPlans = {
  brief: {
    label: '精简演示',
    description: '沿业务主线展示九个模块，重点呈现缺证校验、补证复核和分析应用。',
    steps: briefSteps,
    stages: {
      data: [2],
      people: [1],
      rules: [3],
      risk: [0],
      fix: [4, 5],
      insight: [6, 7, 8, 9],
      support: [10],
    },
  },
  full: {
    label: '完整演示',
    description: '逐项展示新增维护、导入归并、规则配置、异常恢复与全部图谱用法。',
    steps: demoSteps,
    stages: {
      data: [4, 5],
      people: [1, 2, 3],
      rules: [6, 7],
      risk: [0, 10],
      fix: [8, 9],
      insight: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      support: [21, 22],
    },
  },
}
export type DemoPlan = (typeof demoPlans)[DemoMode]
