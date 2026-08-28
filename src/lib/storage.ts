import { defaultContent } from '../data/defaultContent'
import { withArticleOrder } from './selectors'
import type { SiteContent } from '../types'

export const STORAGE_KEY = 'rcdeportivo-wechat-content'

export function isSampleContent(content: SiteContent): boolean {
  return content.articles.some((article) => article.id === 'a1')
}

export function normalizeContent(content: SiteContent): SiteContent | null {
  if (!content.seasons || !content.categories || !content.articles) return null
  return {
    ...content,
    articles: withArticleOrder(content.articles),
  }
}

export function loadContent(): SiteContent {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(defaultContent)
    const parsed = JSON.parse(raw) as SiteContent
    return normalizeContent(parsed) ?? structuredClone(defaultContent)
  } catch {
    return structuredClone(defaultContent)
  }
}

export function shouldUsePublished(
  local: SiteContent,
  published: SiteContent,
): boolean {
  if (isSampleContent(local) && !isSampleContent(published)) return true
  return published.articles.length > local.articles.length
}

export async function loadPublishedContent(): Promise<SiteContent | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}content.json`, {
      cache: 'no-store',
    })
    if (!response.ok) return null
    const parsed = (await response.json()) as SiteContent
    return normalizeContent(parsed)
  } catch {
    return null
  }
}

export async function hydrateContent(): Promise<SiteContent> {
  const local = loadContent()
  const published = await loadPublishedContent()
  if (!published) return local
  if (shouldUsePublished(local, published)) {
    saveContent(published)
    return published
  }
  return local
}

export function saveContent(content: SiteContent): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(content))
}

export function resetContent(): SiteContent {
  const next = structuredClone(defaultContent)
  saveContent(next)
  return next
}

export function downloadContent(content: SiteContent): void {
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'content.json'
  link.click()
  URL.revokeObjectURL(url)
}
