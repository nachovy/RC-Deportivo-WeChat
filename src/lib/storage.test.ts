import { defaultContent } from '../data/defaultContent'
import { isSampleContent, shouldUsePublished } from './storage'
import type { SiteContent } from '../types'

if (!isSampleContent(defaultContent)) {
  throw new Error('bundled default content should be treated as sample data')
}

const published = {
  ...defaultContent,
  articles: defaultContent.articles.map((article, index) => ({
    ...article,
    id: `article-${index + 1}`,
  })),
} satisfies SiteContent

if (isSampleContent(published)) {
  throw new Error('published content without sample ids should not look like sample data')
}

if (!shouldUsePublished(defaultContent, published)) {
  throw new Error('GitHub Pages should replace local sample data with published content')
}

const richerLocal = {
  ...published,
  articles: [
    ...published.articles,
    {
      id: 'article-local',
      categoryId: published.articles[0]?.categoryId ?? 'cat',
      title: '本地未发布',
      cover: '',
      url: 'https://mp.weixin.qq.com/s/local',
      featured: false,
      featuredOrder: 9,
      order: 99,
      publishedAt: '2026-08-28',
    },
  ],
} satisfies SiteContent

if (shouldUsePublished(richerLocal, published)) {
  throw new Error('a richer local database should not be overwritten by a smaller published file')
}

console.log('storage checks passed')
