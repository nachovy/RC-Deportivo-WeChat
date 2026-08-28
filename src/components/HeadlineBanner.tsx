import { useEffect, useState } from 'react'
import type { Article } from '../types'
import { Cover } from './Cover'

type HeadlineBannerProps = {
  articles: Article[]
}

export function HeadlineBanner({ articles }: HeadlineBannerProps) {
  const [index, setIndex] = useState(0)
  const current = articles[index]

  useEffect(() => {
    setIndex(0)
  }, [articles])

  useEffect(() => {
    if (articles.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % articles.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [articles])

  if (!current) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center bg-slate-100 text-sm text-slate-500">
        当前分类还没有文章。
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-slate-200">
      <a
        href={current.url}
        target="_blank"
        rel="noreferrer"
        className="block aspect-[16/9]"
      >
        <Cover src={current.cover} title={current.title} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-6 pt-10">
          <p className="line-clamp-2 text-center text-base font-medium text-white drop-shadow">
            {current.title}
          </p>
        </div>
      </a>
      {articles.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {articles.map((article, i) => (
            <button
              key={article.id}
              type="button"
              aria-label={`头条 ${i + 1}`}
              className={`h-1.5 rounded-full ${
                i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
              }`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
