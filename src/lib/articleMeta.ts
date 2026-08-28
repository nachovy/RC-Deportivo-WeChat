export type ArticleMeta = {
  title: string
  summary: string
  cover: string
  publishedAt: string
  url: string
}

const FETCH_HEADERS = {
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50 NetType/WIFI Language/zh_CN',
}

const GENERIC_TITLES = new Set([
  '',
  '未命名文章',
  '微信公众平台',
  'Weixin Official Accounts Platform',
])

export function decodeCopiedUrl(raw: string): string {
  let current = raw.trim().replace(/\s+/g, '')
  for (let i = 0; i < 4; i += 1) {
    const next = current
      .replace(/&amp;/gi, '&')
      .replace(/&amp%3B/gi, '&')
      .replace(/%26amp%3B/gi, '&')
    if (next === current) break
    current = next
  }
  return current
}

export function normalizeArticleUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(decodeCopiedUrl(raw))
  } catch {
    throw new Error('请输入有效的文章链接')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('只支持 http/https 链接')
  }

  if (!isWeChatHost(url.hostname)) {
    return url.toString()
  }

  if (url.pathname.includes('wappoc_appmsgcaptcha')) {
    const target = url.searchParams.get('target_url')
    if (target) return normalizeArticleUrl(target)
    throw new Error(
      '微信要求安全验证，无法自动读取。请改用文章分享链接，或手动填写标题、封面和日期。',
    )
  }

  const biz = firstSearchParam(url, ['__biz', 'amp;__biz'])
  const mid = firstSearchParam(url, ['mid', 'amp;mid'])
  const idx = firstSearchParam(url, ['idx', 'amp;idx'])
  const sn = firstSearchParam(url, ['sn', 'amp;sn'])
  if (biz && mid && idx && sn) {
    const clean = new URL('https://mp.weixin.qq.com/s')
    clean.searchParams.set('__biz', biz)
    clean.searchParams.set('mid', mid)
    clean.searchParams.set('idx', idx)
    clean.searchParams.set('sn', sn)
    return clean.toString()
  }

  const shortId = url.pathname.match(/^\/s\/([A-Za-z0-9_-]+)$/)
  if (shortId?.[1] && shortId[1] !== 's') {
    return `https://mp.weixin.qq.com/s/${shortId[1]}`
  }

  return `https://mp.weixin.qq.com${url.pathname}${url.search}`
}

export function assertHttpUrl(raw: string): string {
  return normalizeArticleUrl(raw)
}

export function weChatReadError(html: string, finalUrl = ''): string | null {
  const url = finalUrl.toLowerCase()
  if (
    url.includes('wappoc_appmsgcaptcha') ||
    url.includes('appmsgcaptcha') ||
    /wappoc_appmsgcaptcha/i.test(html) ||
    /secitptpage\/verify/i.test(html)
  ) {
    return '微信要求安全验证，无法自动读取。请不要从公众号后台复制带 token 的地址，改用已发布文章的分享链接；或手动填写标题、封面和日期。'
  }
  if (
    html.includes('参数错误') ||
    /var\s+ret\s*=\s*['"]-2['"]/.test(html)
  ) {
    return '微信返回参数错误。请粘贴完整公开链接（含 __biz、mid、idx、sn，或 /s/短链），不要只用后台里的 sn。'
  }
  return null
}

export function parseArticleMeta(html: string, sourceUrl = ''): ArticleMeta {
  const title = firstNonEmpty(
    metaContent(html, 'og:title'),
    metaContent(html, 'twitter:title'),
    jsString(html, 'msg_title'),
    tagText(html, 'activity-name'),
    usableTitle(titleTag(html)),
  )

  const summary = firstNonEmpty(
    metaContent(html, 'og:description'),
    metaContent(html, 'description'),
    metaContent(html, 'twitter:description'),
    jsString(html, 'msg_desc'),
  )

  const cover = normalizeCover(
    firstNonEmpty(
      metaContent(html, 'og:image'),
      metaContent(html, 'twitter:image'),
      jsString(html, 'msg_cdn_url'),
      jsString(html, 'cdn_url_1_1'),
      mmbizImage(html),
    ),
  )

  const publishedAt = normalizeDate(
    firstNonEmpty(
      jsString(html, 'ct'),
      jsString(html, 'createTime'),
      metaContent(html, 'og:article:published_time'),
      metaContent(html, 'article:published_time'),
      tagText(html, 'publish_time'),
      chineseDate(html),
    ),
  )

  const canonical = firstNonEmpty(
    metaContent(html, 'og:url'),
    sourceUrl,
  )

  return {
    title: decodeEntities(title).trim(),
    summary: decodeEntities(summary).trim(),
    cover,
    publishedAt,
    url: canonical,
  }
}

const META_PREFIX_CHARS = 400_000
const META_SNIPPET_RADIUS = 1_200
const META_MARKERS = [
  'og:title',
  'og:image',
  'og:description',
  'msg_title',
  'msg_desc',
  'msg_cdn_url',
  'cdn_url_1_1',
  'createTime',
  'activity-name',
  'publish_time',
]

export function excerptHtmlForMeta(html: string): string {
  if (html.length <= META_PREFIX_CHARS) return html
  const parts = [html.slice(0, META_PREFIX_CHARS)]
  for (const marker of META_MARKERS) {
    let from = 0
    let found = 0
    while (found < 3) {
      const index = html.indexOf(marker, from)
      if (index === -1) break
      if (index > META_PREFIX_CHARS - 200) {
        parts.push(
          html.slice(
            Math.max(0, index - 200),
            Math.min(html.length, index + META_SNIPPET_RADIUS),
          ),
        )
      }
      from = index + marker.length
      found += 1
    }
  }
  return parts.join('\n')
}

export async function fetchAndParseArticleMeta(
  targetUrl: string,
): Promise<ArticleMeta> {
  const url = assertHttpUrl(targetUrl)
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(`原文读取失败（${response.status}）`)
  }
  const html = await response.text()
  const finalUrl = response.url || url
  const blocked = weChatReadError(html.slice(0, 80_000), finalUrl)
  if (blocked) {
    throw new Error(blocked)
  }
  const meta = parseArticleMeta(
    excerptHtmlForMeta(html),
    preferPublicUrl(finalUrl, url),
  )
  if (GENERIC_TITLES.has(meta.title.trim()) && !meta.cover) {
    throw new Error(
      '没有解析到标题或封面。微信可能拦截了自动读取，请换用可公开打开的分享链接，或手动填写。',
    )
  }
  if (GENERIC_TITLES.has(meta.title.trim())) {
    throw new Error('没有解析到标题。请确认链接可公开访问，或手动填写标题。')
  }
  return { ...meta, url: preferPublicUrl(meta.url, url) }
}

function isWeChatHost(hostname: string): boolean {
  return /(^|\.)mp\.weixin\.qq\.com$/i.test(hostname)
}

function firstSearchParam(url: URL, names: string[]): string {
  for (const name of names) {
    const value = url.searchParams.get(name)?.trim()
    if (value) return value
  }
  return ''
}

function preferPublicUrl(candidate: string, fallback: string): string {
  if (!candidate) return fallback
  try {
    return normalizeArticleUrl(candidate)
  } catch {
    return fallback
  }
}

function usableTitle(title: string): string {
  const value = title.trim()
  return GENERIC_TITLES.has(value) ? '' : value
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim())?.trim() ?? ''
}

function metaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
      'i',
    ),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }
  return ''
}

function jsString(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`${escaped}\\s*=\\s*htmlDecode\\((['"])(.*?)\\1\\)`, 'i'),
    new RegExp(`${escaped}\\s*=\\s*(['"])(.*?)\\1`, 'i'),
    new RegExp(`${escaped}\\s*=\\s*(\\d{10,13})\\s*;`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[2]) return match[2]
    if (match?.[1] && /^\d{10,13}$/.test(match[1])) return match[1]
  }
  return ''
}

function tagText(html: string, id: string): string {
  const pattern = new RegExp(
    `<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)</`,
    'i',
  )
  const match = html.match(pattern)
  return match?.[1] ? stripTags(match[1]) : ''
}

function titleTag(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1] ? stripTags(match[1]) : ''
}

function mmbizImage(html: string): string {
  const match = html.match(
    /https?:\/\/mmbiz\.qpic\.cn\/[^"'()\s>]+/i,
  )
  return match?.[0] ?? ''
}

function chineseDate(html: string): string {
  const match = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (!match) return ''
  return `${match[1]}-${pad(match[2])}-${pad(match[3])}`
}

function normalizeCover(url: string): string {
  if (!url) return ''
  return url.replace(/^http:\/\//i, 'https://').replace(/&amp;/g, '&')
}

export function normalizeDate(raw: string): string {
  const value = decodeEntities(raw).trim()
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  if (/^\d{10,13}$/.test(value)) {
    const timestamp = value.length === 13 ? Number(value) : Number(value) * 1000
    const date = new Date(timestamp)
    if (!Number.isNaN(date.getTime())) return formatDate(date)
  }
  const chinese = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (chinese) {
    return `${chinese[1]}-${pad(chinese[2])}-${pad(chinese[3])}`
  }
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return formatDate(parsed)
  return ''
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function pad(value: string | number): string {
  return String(value).padStart(2, '0')
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num: string) =>
      String.fromCharCode(Number(num)),
    )
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
