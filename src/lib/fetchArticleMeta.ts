import type { ArticleMeta } from './articleMeta'

export async function fetchArticleMeta(url: string): Promise<ArticleMeta> {
  const endpoint = `/api/article-meta?url=${encodeURIComponent(url.trim())}`
  const response = await fetch(endpoint)
  const data = (await response.json()) as ArticleMeta & { error?: string }
  if (!response.ok) {
    throw new Error(data.error || '原文读取失败')
  }
  return data
}
