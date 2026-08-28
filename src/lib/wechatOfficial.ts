import {
  filterPublishArticles,
  parseWeChatPublishList,
  type PublishArticle,
  type PublishImportFilter,
  type WeChatPublishResult,
} from './wechatPublish'

export type WeChatEnv = {
  WECHAT_APPID?: string
  WECHAT_APPSECRET?: string
}

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

const TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token'
const BATCH_URL = 'https://api.weixin.qq.com/cgi-bin/freepublish/batchget'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

export function hasWeChatCredentials(env: WeChatEnv): boolean {
  return Boolean(env.WECHAT_APPID?.trim() && env.WECHAT_APPSECRET?.trim())
}

function envValue(source: Record<string, unknown> | undefined, key: string): string {
  const fromSource = source?.[key]
  if (typeof fromSource === 'string' && fromSource.trim()) return fromSource.trim()
  const runtime = globalThis as { process?: { env?: Record<string, string | undefined> } }
  const fromProcess = runtime.process?.env?.[key]
  return typeof fromProcess === 'string' ? fromProcess.trim() : ''
}

export function wechatEnvFrom(source: Record<string, unknown> | undefined): WeChatEnv {
  return {
    WECHAT_APPID: envValue(source, 'WECHAT_APPID'),
    WECHAT_APPSECRET: envValue(source, 'WECHAT_APPSECRET'),
  }
}

export function parsePublishQuery(search: URLSearchParams): PublishImportFilter {
  const keyword = search.get('keyword')?.trim() ?? ''
  const from = search.get('from')?.trim() ?? ''
  const to = search.get('to')?.trim() ?? ''
  if (from && !DATE_RE.test(from)) throw new Error('开始日期格式应为 YYYY-MM-DD')
  if (to && !DATE_RE.test(to)) throw new Error('结束日期格式应为 YYYY-MM-DD')
  if (from && to && from > to) throw new Error('开始日期不能晚于结束日期')
  if (keyword.length > 40) throw new Error('关键字过长')
  return { keyword, from, to }
}

function wechatErrorMessage(data: Record<string, unknown>): string {
  const code = Number(data.errcode ?? 0)
  const msg = String(data.errmsg ?? '')
  if (code === 40164) return '服务器 IP 未加入公众号接口白名单'
  if (code === 40125 || code === 40001) return 'AppSecret 无效，请重新生成并更新环境变量'
  if (code === 40013) return 'AppID 无效'
  if (code === 48001) return '公众号未授权草稿箱/发布能力接口，请改用粘贴 JSON 导入'
  if (code) return `微信接口错误 ${code}${msg ? `：${msg}` : ''}`
  return ''
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function parseFreePublishResponse(payload: unknown): PublishArticle[] {
  const fromParser = parseWeChatPublishList(
    typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}),
  )
  if (fromParser.length > 0) return fromParser

  const root = asRecord(payload)
  const items = Array.isArray(root?.item) ? root.item : []
  const articles: PublishArticle[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const record = asRecord(item)
    const content = asRecord(record?.content)
    const news = Array.isArray(content?.news_item) ? content.news_item : []
    for (const newsItem of news) {
      const itemRecord = asRecord(newsItem) ?? {}
      const parsed = parseWeChatPublishList(
        JSON.stringify({
          appmsgex: [
            {
              ...itemRecord,
              create_time:
                itemRecord.create_time ??
                itemRecord.update_time ??
                record?.update_time ??
                record?.create_time,
            },
          ],
        }),
      )
      for (const article of parsed) {
        if (seen.has(article.url)) continue
        seen.add(article.url)
        articles.push(article)
      }
    }
  }
  return articles
}

export async function getAccessToken(
  env: WeChatEnv,
  fetchImpl: FetchLike = fetch as FetchLike,
): Promise<string> {
  const appid = env.WECHAT_APPID?.trim() ?? ''
  const secret = env.WECHAT_APPSECRET?.trim() ?? ''
  if (!appid || !secret) throw new Error('未配置公众号 AppID / AppSecret')

  const cached = tokenCache.get(appid)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

  const url = `${TOKEN_URL}?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`
  const response = await fetchImpl(url)
  const data = asRecord(await response.json()) ?? {}
  const token = String(data.access_token ?? '')
  if (!token) throw new Error(wechatErrorMessage(data) || '获取公众号 access_token 失败')

  const expiresIn = Number(data.expires_in)
  tokenCache.set(appid, {
    token,
    expiresAt: Date.now() + Math.max(60, Number.isFinite(expiresIn) ? expiresIn : 7200) * 1000,
  })
  return token
}

export async function listFreePublishArticles(
  env: WeChatEnv,
  filter: PublishImportFilter,
  options: { fetchImpl?: FetchLike; maxPages?: number; pageSize?: number } = {},
): Promise<{ articles: PublishArticle[]; scanned: number; truncated: boolean }> {
  const fetchImpl = options.fetchImpl ?? (fetch as FetchLike)
  const pageSize = Math.min(20, Math.max(1, options.pageSize ?? 20))
  const maxPages = Math.min(50, Math.max(1, options.maxPages ?? 50))
  const token = await getAccessToken(env, fetchImpl)
  const collected: PublishArticle[] = []
  const seen = new Set<string>()
  let truncated = false

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchImpl(`${BATCH_URL}?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset: page * pageSize,
        count: pageSize,
        no_content: 0,
      }),
    })
    const payload = await response.json()
    const record = asRecord(payload) ?? {}
    const apiError = wechatErrorMessage(record)
    if (apiError) throw new Error(apiError)

    const pageArticles = parseFreePublishResponse(payload)
    for (const article of pageArticles) {
      if (seen.has(article.url)) continue
      seen.add(article.url)
      collected.push(article)
    }

    const itemCount = Number(record.item_count ?? pageArticles.length)
    if (!Number.isFinite(itemCount) || itemCount < pageSize) break

    const from = filter.from?.trim()
    if (from && pageArticles.length > 0) {
      const newestOnPage = pageArticles.reduce(
        (latest, article) => (article.publishedAt > latest ? article.publishedAt : latest),
        pageArticles[0]?.publishedAt ?? '',
      )
      const oldestOnPage = pageArticles.reduce(
        (oldest, article) => (article.publishedAt < oldest ? article.publishedAt : oldest),
        pageArticles[0]?.publishedAt ?? '',
      )
      if (newestOnPage && newestOnPage < from && oldestOnPage && oldestOnPage < from) {
        break
      }
    }
    if (page === maxPages - 1) truncated = true
  }

  return {
    articles: filterPublishArticles(collected, filter),
    scanned: collected.length,
    truncated,
  }
}

export async function handleWeChatPublishRequest(
  requestUrl: string,
  env: WeChatEnv,
  fetchImpl?: FetchLike,
): Promise<{ status: number; body: WeChatPublishResult }> {
  const url = new URL(requestUrl, 'http://localhost')
  const configured = hasWeChatCredentials(env)
  if (url.searchParams.get('probe') === '1') {
    return { status: 200, body: { configured, articles: [], scanned: 0, truncated: false } }
  }
  if (!configured) {
    return {
      status: 200,
      body: {
        configured: false,
        articles: [],
        scanned: 0,
        truncated: false,
        error: '未配置公众号 AppID / AppSecret',
      },
    }
  }

  try {
    const filter = parsePublishQuery(url.searchParams)
    const result = await listFreePublishArticles(env, filter, { fetchImpl })
    return { status: 200, body: { configured: true, ...result } }
  } catch (error) {
    return {
      status: 400,
      body: {
        configured: true,
        articles: [],
        scanned: 0,
        truncated: false,
        error: error instanceof Error ? error.message : '公众号文章读取失败',
      },
    }
  }
}
