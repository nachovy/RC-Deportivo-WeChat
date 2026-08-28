import type { Article } from '../types'
import { Cover } from './Cover'

type ArticleListProps = {
  articles: Article[]
}

export function ArticleList({ articles }: ArticleListProps) {
  if (articles.length === 0) return null

  return (
    <ul>
      {articles.map((article) => (
        <li key={article.id}>
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-3 border-b border-slate-100 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[15px] font-medium leading-snug text-slate-900">
                {article.title}
              </p>
              {article.publishedAt ? (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                  <span aria-hidden>◷</span>
                  {article.publishedAt}
                </p>
              ) : null}
            </div>
            <div className="h-[54px] w-[72px] shrink-0 overflow-hidden rounded bg-slate-100">
              <Cover src={article.cover} title={article.title} crop="right" />
            </div>
          </a>
        </li>
      ))}
    </ul>
  )
}
