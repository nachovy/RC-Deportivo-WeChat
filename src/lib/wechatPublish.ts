import { normalizeArticleUrl } from './articleMeta'
import { createId } from './id'
import type { Article, SiteContent } from '../types'

export type PublishArticle = {
  title: string
  url: string
  cover: string
  publishedAt: string
}

export type PublishImportFilter = {
  keyword?: string
  from?: string
  to?: string
}

export type WeChatPublishResult = {
  configured: boolean
  articles: PublishArticle[]
  scanned: number
  truncated: boolean
  error?: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function unixToDate(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  const ms = n > 1e12 ? n : n * 1000
  const date = new Date(ms + 8 * 60 * 60 * 1000)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function decodeMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function collectPublishCandidates(root: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  const seen = new Set<unknown>()

  function walk(value: unknown) {
    const decoded = decodeMaybeJson(value)
    if (decoded !== value) {
      walk(decoded)
      return
    }
    if (!decoded || typeof decoded !== 'object') return
    if (seen.has(decoded)) return
    seen.add(decoded)
    if (Array.isArray(decoded)) {
      decoded.forEach(walk)
      return
    }
    const record = decoded as Record<string, unknown>
    const title = String(record.title ?? record.msg_title ?? '').trim()
    const url = String(
      record.link ??
        record.content_url ??
        record.content_url_with_params ??
        record.url ??
        record.content_source_url ??
        '',
    ).trim()
    if (title && url) found.push(record)
    Object.values(record).forEach(walk)
  }

  walk(root)
  return found
}

function coverFrom(record: Record<string, unknown>): string {
  const raw = String(
    record.cover ??
      record.cover_url ??
      record.thumb_url ??
      record.cdn_url ??
      record.cdn_url_1_1 ??
      record.pic_cdn_url_235_1 ??
      '',
  ).trim()
  return raw.replace(/&amp;/gi, '&')
}

function publishedAtFrom(record: Record<string, unknown>): string {
  return (
    unixToDate(record.create_time) ||
    unixToDate(record.update_time) ||
    unixToDate(record.send_time) ||
    ''
  )
}

export function parseWeChatPublishList(raw: string): PublishArticle[] {
  const text = raw.trim()
  if (!text) return []

  let root: unknown = text
  try {
    root = JSON.parse(text)
  } catch {
    const start = text.search(/[{[]/)
    if (start < 0) throw new Error('请粘贴公众号后台返回的 JSON')
    try {
      root = JSON.parse(text.slice(start))
    } catch {
      throw new Error('无法解析公众号后台 JSON，请从开发者工具 Network 复制响应')
    }
  }

  const articles: PublishArticle[] = []
  const seen = new Set<string>()
  for (const record of collectPublishCandidates(root)) {
    const title = String(record.title ?? record.msg_title ?? '').trim()
    let url = String(
      record.link ??
        record.content_url ??
        record.content_url_with_params ??
        record.content_source_url ??
        record.url ??
        '',
    )
      .trim()
      .replace(/&amp;/gi, '&')
    if (!title || !url) continue
    try {
      url = normalizeArticleUrl(url)
    } catch {
      /* keep original if it is already a usable http(s) link */
    }
    if (seen.has(url)) continue
    seen.add(url)
    articles.push({
      title,
      url,
      cover: coverFrom(record),
      publishedAt: publishedAtFrom(record),
    })
  }
  return articles
}

export function inDateRange(
  publishedAt: string,
  from = '',
  to = '',
): boolean {
  if (!DATE_RE.test(publishedAt)) return !from && !to
  if (from && publishedAt < from) return false
  if (to && publishedAt > to) return false
  return true
}

export function filterPublishArticles(
  articles: PublishArticle[],
  filter: PublishImportFilter = {},
): PublishArticle[] {
  const keyword = filter.keyword?.trim() ?? ''
  const from = filter.from?.trim() ?? ''
  const to = filter.to?.trim() ?? ''
  return articles.filter(
    (article) =>
      (!keyword || article.title.includes(keyword)) &&
      inDateRange(article.publishedAt, from, to),
  )
}

export function findSeasonCategory(
  content: SiteContent,
  seasonHint: string,
  categoryHint: string,
) {
  const season = content.seasons.find((item) =>
    item.name.replace(/\s+/g, '').includes(seasonHint.replace(/\s+/g, '')),
  )
  if (!season) return undefined
  return content.categories.find(
    (category) =>
      category.seasonId === season.id && category.name.includes(categoryHint),
  )
}

export function mergePublishArticles(
  content: SiteContent,
  categoryId: string,
  incoming: PublishArticle[],
  idFactory: (prefix: string) => string = createId,
): { content: SiteContent; added: number; skipped: number } {
  const existingUrls = new Set(
    content.articles
      .filter((article) => article.categoryId === categoryId)
      .map((article) => article.url),
  )
  const sorted = [...incoming].sort(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title),
  )
  const additions: Article[] = []
  let skipped = 0
  for (const item of sorted) {
    if (existingUrls.has(item.url)) {
      skipped += 1
      continue
    }
    existingUrls.add(item.url)
    additions.push({
      id: idFactory('article'),
      categoryId,
      title: item.title,
      cover: item.cover,
      url: item.url,
      featured: additions.length < 3,
      featuredOrder: additions.length + 1,
      order: additions.length + 1,
      publishedAt: item.publishedAt,
    })
  }

  if (additions.length === 0) {
    return { content, added: 0, skipped }
  }

  const shifted = content.articles.map((article) =>
    article.categoryId === categoryId && article.order >= 0
      ? { ...article, order: article.order + additions.length }
      : article,
  )

  return {
    content: { ...content, articles: [...additions, ...shifted] },
    added: additions.length,
    skipped,
  }
}
