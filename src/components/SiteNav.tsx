import { useI18n } from '../i18n.js'

export function SiteNav() {
  const { locale, setLocale, text } = useI18n()
  const aboutUrl =
    locale === 'zh'
      ? 'https://about.ajia.site/zh/'
      : 'https://about.ajia.site/en/'

  return (
    <div className="site-nav">
      <nav aria-label={text('Ajia.site links', 'Ajia.site 站内链接')}>
        <a href="/">{text('Home', '首页')}</a>
        <a href="/blog/">Blog</a>
        <a href={aboutUrl}>About</a>
        <a href="/tools/">{text('All tools', '全部工具')}</a>
      </nav>
      <div
        aria-label={text('Interface language', '界面语言')}
        className="language-switch"
        role="group"
      >
        <button
          aria-pressed={locale === 'en'}
          onClick={() => {
            setLocale('en')
          }}
          type="button"
        >
          EN
        </button>
        <button
          aria-pressed={locale === 'zh'}
          onClick={() => {
            setLocale('zh')
          }}
          type="button"
        >
          中文
        </button>
      </div>
    </div>
  )
}
