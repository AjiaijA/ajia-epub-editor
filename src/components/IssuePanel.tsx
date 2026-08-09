import { useId } from 'react'

import type { EpubIssue } from '../models/publication.js'
import { localizeIssueMessage, useI18n } from '../i18n.js'

export function IssuePanel({
  issues,
}: {
  readonly issues: readonly EpubIssue[]
}) {
  const { locale, text } = useI18n()
  const headingId = useId()
  if (issues.length === 0) {
    return (
      <section
        className="issue-panel issue-panel--clear"
        aria-label={text('Check results', '检查结果')}
      >
        <span className="status-dot" aria-hidden="true" />
        {text('No issues to report', '未发现需要提示的问题')}
      </section>
    )
  }

  return (
    <section className="issue-panel" aria-labelledby={headingId}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{text('Open checks', '打开检查')}</p>
          <h2 id={headingId}>
            {text('Issues & compatibility', '问题与兼容性提示')}
          </h2>
        </div>
        <span
          aria-label={text(
            `${String(issues.length)} notices`,
            `${String(issues.length)} 条提示`,
          )}
          className="issue-count"
        >
          {issues.length}
        </span>
      </div>
      <ul className="issue-list">
        {issues.map((issue, index) => (
          <li
            className={`issue issue--${issue.severity}`}
            key={`${issue.code}-${String(index)}`}
          >
            <span className="issue-severity">
              {issue.severity === 'error'
                ? text('Error', '错误')
                : issue.severity === 'warning'
                  ? text('Warning', '提醒')
                  : text('Info', '信息')}
            </span>
            <div>
              <p>{localizeIssueMessage(issue, locale)}</p>
              {issue.path === undefined ? null : <code>{issue.path}</code>}
              {issue.detail === undefined ? null : (
                <details>
                  <summary>{text('Technical details', '技术详情')}</summary>
                  <p>{issue.detail}</p>
                </details>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
