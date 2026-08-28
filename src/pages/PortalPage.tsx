import { useEffect, useMemo, useRef } from 'react'
import { ArticleList } from '../components/ArticleList'
import { HeadlineBanner } from '../components/HeadlineBanner'
import {
  articlesForCategory,
  categoriesForSeason,
  headlineArticles,
  sortedSeasons,
} from '../lib/selectors'
import type { SiteContent } from '../types'

type PortalPageProps = {
  content: SiteContent
  seasonId: string
  categoryId: string
  onSelectSeason: (seasonId: string) => void
  onSelectCategory: (categoryId: string) => void
}

export function PortalPage({
  content,
  seasonId,
  categoryId,
  onSelectSeason,
  onSelectCategory,
}: PortalPageProps) {
  const seasons = sortedSeasons(content)
  const categories = categoriesForSeason(content, seasonId)
  const articles = articlesForCategory(content, categoryId)
  const headlines = useMemo(() => headlineArticles(articles, 3), [articles])
  const seasonNavRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const active = seasonNavRef.current?.querySelector('[data-active="true"]')
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [seasonId])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <header className="shrink-0 bg-[var(--club-blue)] text-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src="./crest.svg"
            alt="皇家拉科鲁尼亚队徽"
            className="h-11 w-auto shrink-0 object-contain drop-shadow-sm"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-wide">
              {content.title}
            </h1>
            <p className="truncate text-xs text-white/75">{content.subtitle}</p>
          </div>
        </div>
      </header>

      <div className="shrink-0">
        <HeadlineBanner articles={headlines} />
      </div>

      <nav
        ref={seasonNavRef}
        className="scroll-touch flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2"
      >
        {seasons.map((season) => {
          const active = season.id === seasonId
          return (
            <button
              key={season.id}
              type="button"
              data-active={active}
              onClick={() => onSelectSeason(season.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap ${
                active
                  ? 'bg-[var(--club-blue)] font-semibold text-white'
                  : 'bg-[var(--club-blue)]/10 text-[var(--club-blue)]'
              }`}
            >
              {season.name}
            </button>
          )
        })}
      </nav>

      <div className="flex min-h-0 flex-1">
        <aside className="scroll-touch w-[72px] shrink-0 overflow-y-auto border-r border-slate-100 bg-white">
          {categories.length === 0 ? (
            <p className="p-3 text-xs text-slate-400">暂无分类</p>
          ) : (
            categories.map((category) => {
              const active = category.id === categoryId
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onSelectCategory(category.id)}
                  className={`block w-full border-l-[3px] px-1 py-4 text-center text-[13px] leading-tight ${
                    active
                      ? 'border-[var(--club-blue)] font-semibold text-[var(--club-blue)]'
                      : 'border-transparent text-slate-500'
                  }`}
                >
                  {category.name}
                </button>
              )
            })
          )}
        </aside>

        <main className="scroll-touch min-h-0 min-w-0 flex-1 overflow-y-auto px-3">
          <ArticleList articles={articles} />
        </main>
      </div>
    </div>
  )
}
