import { Fragment } from 'react'
import type { Rule } from '../model'

export function RuleConditions({ rule }: { rule: Rule }) {
  const groups = [
    { label: '专业', values: rule.specialties },
    { label: '岗位', values: rule.jobs },
    { label: '职责', values: rule.duties },
    { label: '实际作业', values: rule.scopes },
  ].filter((group) => group.values.length)
  if (!groups.length) return <span>所有在岗人员</span>
  return (
    <div className="rule-conditions">
      {groups.map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 && <span className="condition-join">且</span>}
          <div className="condition-group">
            <strong>{group.label}</strong>
            {group.values.length > 2 ? (
              <details>
                <summary>
                  {group.values.slice(0, 2).join('、')}等 {group.values.length} 项，满足任一项
                </summary>
                <ul>
                  {group.values.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              </details>
            ) : (
              <span>{group.values.join(' 或 ')}</span>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
