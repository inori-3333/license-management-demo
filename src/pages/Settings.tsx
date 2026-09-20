import { useEffect, useState } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
import { useStore } from '../store'
import { downloadJSON } from '../io'
import { type DB, split } from '../model'
import { Confirm, Field, BusinessForm, Header } from '../ui'
export default function Settings() {
  const { db, update, reset } = useStore()
  const [warning, setWarning] = useState(db.warningDays.join('，')),
    [resetting, setResetting] = useState(false),
    [restore, setRestore] = useState<DB | null>(null),
    [error, setError] = useState('')
  useEffect(() => setWarning(db.warningDays.join('，')), [db.warningDays])
  async function read(file?: File) {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as DB
      if (data.version !== 1 || !Array.isArray(data.people) || !Array.isArray(data.rules))
        throw new Error('请选择本系统导出的版本 1 JSON 备份。')
      setRestore(data)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <>
      <Header title="演示设置" description="调整提醒档位，备份当前演示状态，随时恢复初始数据。" />
      <div className="settings-grid">
        <section className="panel">
          <h2>证书提醒设置</h2>
          <BusinessForm
            onCancel={() => setWarning(db.warningDays.join('，'))}
            submitLabel="保存提醒设置"
            onSubmit={() => {
              const days = split(warning).map(Number)
              if (!days.length || days.some((n) => !Number.isInteger(n) || n <= 0))
                throw new Error('请输入正整数天数，用逗号分隔。')
              update(
                (d) => ({ ...d, warningDays: [...new Set(days)].sort((a, b) => b - a) }),
                '提醒档位已更新',
              )
            }}
          >
            <Field
              label="提醒天数"
              required
              value={warning}
              onChange={(e) => setWarning(e.target.value)}
              hint="默认 180、90、30、7 天；当天到期仍有效，并进入最近提醒档位。"
            />
          </BusinessForm>
        </section>
        <section className="panel">
          <h2>数据备份与恢复</h2>
          <p>包含人员、证书、规则、名称映射、整改记录和报表方案。数据存储在当前浏览器中。</p>
          <div className="actions">
            <button
              className="button secondary"
              onClick={() => downloadJSON('持证上岗演示备份-' + db.asOf, db)}
            >
              <Download size={16} />
              导出 JSON 备份
            </button>
            <label className="button secondary file-button">
              <Upload size={16} />
              选择 JSON 备份
              <input
                aria-label="选择 JSON 备份"
                type="file"
                accept=".json"
                onChange={(e) => read(e.target.files?.[0])}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
        </section>
        <section className="panel">
          <h2>恢复初始演示</h2>
          <p>
            恢复 1,315 条原表来源及补充演示场景，统计日期回到 2026-09-13，清除当前编辑和整改记录。
          </p>
          <button className="button danger-outline" onClick={() => setResetting(true)}>
            <RotateCcw size={16} />
            重置演示数据
          </button>
        </section>
        <section className="panel">
          <h2>使用说明与设计方案</h2>
          <p>查看系统模块、数据处理流程、报表口径及完整演示路线。</p>
          <a
            className="button secondary"
            href="./framework.md"
            download="持证上岗管理系统框架设计方案.md"
          >
            <Download size={16} />
            下载框架设计方案
          </a>
          <p className="muted">
            日期推演使用当前录入数据，不代表历史快照。原始制度附件保存在项目本地资料目录。
          </p>
        </section>
      </div>
      {resetting && (
        <Confirm
          title="重置演示数据"
          description="当前编辑、导入、映射、整改和报表方案将被初始演示数据替换。可以先导出 JSON 备份。"
          onClose={() => setResetting(false)}
          onConfirm={reset}
        />
      )}
      {restore && (
        <Confirm
          title="恢复备份"
          description={
            '将使用备份中的 ' + restore.people.length + ' 名人员及全部业务配置替换当前浏览器数据。'
          }
          onClose={() => setRestore(null)}
          onConfirm={() => update(() => restore, '备份已恢复')}
        />
      )}
    </>
  )
}
