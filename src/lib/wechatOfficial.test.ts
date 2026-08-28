import { handleWeChatPublishRequest, parseFreePublishResponse } from './wechatOfficial'

const sample = {
  total_count: 3,
  item_count: 3,
  item: [
    {
      article_id: 'a1',
      content: {
        news_item: [
          {
            title: '西乙第42轮：拉科鲁尼亚主场收官',
            url: 'https://mp.weixin.qq.com/s/end-of-season',
            thumb_url: 'https://mmbiz.qpic.cn/cover-end.jpg',
            create_time: 1748793600,
          },
        ],
      },
    },
    {
      article_id: 'a2',
      content: {
        news_item: [
          {
            title: '俱乐部季票续订通知',
            url: 'https://mp.weixin.qq.com/s/club-news',
            thumb_url: 'https://mmbiz.qpic.cn/cover-club.jpg',
            create_time: 1746201600,
          },
        ],
      },
    },
    {
      article_id: 'a3',
      content: {
        news_item: [
          {
            title: '西乙第1轮：拉科鲁尼亚客场开战',
            url: 'https://mp.weixin.qq.com/s?__biz=MzA&amp;mid=1&amp;idx=1&amp;sn=abc',
            thumb_url: 'https://mmbiz.qpic.cn/cover-start.jpg',
            create_time: 1722816000,
          },
        ],
      },
    },
  ],
}

const parsed = parseFreePublishResponse(sample)
if (parsed.length !== 3) {
  throw new Error(`expected 3 free-publish articles, got ${parsed.length}`)
}
if (!parsed[2]?.url.includes('__biz=MzA')) {
  throw new Error(`free-publish url should be cleaned: ${parsed[2]?.url}`)
}

const probe = await handleWeChatPublishRequest('http://localhost/api/wechat-publish?probe=1', {})
if (probe.body.configured) {
  throw new Error('empty env should not look configured')
}

const missing = await handleWeChatPublishRequest(
  'http://localhost/api/wechat-publish?keyword=西乙',
  {},
)
if (missing.body.configured || missing.body.articles.length !== 0) {
  throw new Error('missing credentials should return empty articles')
}

const pages: unknown[] = [sample, { item_count: 0, item: [] }]
const fakeFetch = async (input: string, init?: { body?: string }) => {
  if (String(input).includes('/token')) {
    return {
      ok: true,
      json: async () => ({ access_token: 'tok', expires_in: 7200 }),
      text: async () => '',
    }
  }
  const body = JSON.parse(init?.body || '{}') as { offset?: number }
  const payload = pages[body.offset === 0 ? 0 : 1]
  return {
    ok: true,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }
}

const imported = await handleWeChatPublishRequest(
  'http://localhost/api/wechat-publish?keyword=西乙&from=2024-08-01&to=2025-06-30',
  { WECHAT_APPID: 'wx123', WECHAT_APPSECRET: 'secret' },
  fakeFetch,
)
if (!imported.body.configured) {
  throw new Error('configured env should report configured')
}
if (imported.body.articles.map((item) => item.title).join('|') !== '西乙第42轮：拉科鲁尼亚主场收官|西乙第1轮：拉科鲁尼亚客场开战') {
  throw new Error(`unexpected official import titles: ${imported.body.articles.map((item) => item.title).join('|')}`)
}
if (imported.body.scanned !== 3) {
  throw new Error(`expected to scan 3 articles, got ${imported.body.scanned}`)
}

const badDate = await handleWeChatPublishRequest(
  'http://localhost/api/wechat-publish?from=2024/08/01',
  { WECHAT_APPID: 'wx123', WECHAT_APPSECRET: 'secret' },
)
if (badDate.status !== 400 || !badDate.body.error?.includes('YYYY-MM-DD')) {
  throw new Error(`expected date format error, got ${badDate.body.error}`)
}

console.log('wechat official checks passed')
