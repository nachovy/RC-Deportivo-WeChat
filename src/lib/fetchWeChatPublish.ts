import type {
  PublishArticle,
  PublishImportFilter,
  WeChatPublishResult,
} from './wechatPublish'

export type WeChatAccountStatus = {
  configured: boolean
}

function queryFrom(filter: PublishImportFilter): string {
  const params = new URLSearchParams()
  if (filter.keyword?.trim()) params.set('keyword', filter.keyword.trim())
  if (filter.from?.trim()) params.set('from', filter.from.trim())
  if (filter.to?.trim()) params.set('to', filter.to.trim())
  return params.toString()
}

export async function fetchWeChatAccountStatus(): Promise<WeChatAccountStatus> {
  const response = await fetch('/api/wechat-publish?probe=1')
  const data = (await response.json()) as WeChatPublishResult
  return { configured: Boolean(data.configured) }
}

export async function fetchWeChatPublish(
  filter: PublishImportFilter,
): Promise<WeChatPublishResult> {
  const query = queryFrom(filter)
  const response = await fetch(`/api/wechat-publish${query ? `?${query}` : ''}`)
  const data = (await response.json()) as WeChatPublishResult & { error?: string }
  if (!response.ok) {
    throw new Error(data.error || '公众号文章读取失败')
  }
  return {
    configured: Boolean(data.configured),
    articles: Array.isArray(data.articles) ? (data.articles as PublishArticle[]) : [],
    scanned: Number(data.scanned) || 0,
    truncated: Boolean(data.truncated),
    error: data.error,
  }
}
