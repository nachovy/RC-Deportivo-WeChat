import { defaultContent } from '../data/defaultContent'
import { withArticleOrder } from './selectors'
import type { SiteContent } from '../types'

export const STORAGE_KEY = 'rcdeportivo-wechat-content'

export function loadContent(): SiteContent {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(defaultContent)
    const parsed = JSON.parse(raw) as SiteContent
    if (!parsed.seasons || !parsed.categories || !parsed.articles) {
      return structuredClone(defaultContent)
    }
    return {
      ...parsed,
      articles: withArticleOrder(parsed.articles),
    }
  } catch {
    return structuredClone(defaultContent)
  }
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
