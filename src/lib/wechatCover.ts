const WECHAT_IMAGE_HOSTS = [
  'mmbiz.qpic.cn',
  'mmbiz.qlogo.cn',
  'mmecoa.qpic.cn',
  'wx.qlogo.cn',
]

const MAX_COVER_BYTES = 2_000_000

const COVER_HEADERS = {
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  Referer: 'https://mp.weixin.qq.com/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50 NetType/WIFI Language/zh_CN',
}

export function normalizeCoverUrl(raw: string): string {
  return raw.trim().replace(/&amp;/gi, '&')
}

export function isWeChatCoverUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeCoverUrl(raw))
    const host = url.hostname.toLowerCase()
    return WECHAT_IMAGE_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    )
  } catch {
    return false
  }
}

export function wechatCoverProxySrc(src: string): string {
  return `/api/wechat-cover?url=${encodeURIComponent(normalizeCoverUrl(src))}`
}

export function displayCoverSrc(src: string): string {
  return normalizeCoverUrl(src)
}

export function coverSrcCandidates(src: string): string[] {
  const value = normalizeCoverUrl(src)
  if (!value) return []
  if (!isWeChatCoverUrl(value)) return [value]
  return [value, wechatCoverProxySrc(value)]
}

export async function fetchWeChatCover(raw: string): Promise<{
  body: ArrayBuffer
  contentType: string
}> {
  let url: URL
  try {
    url = new URL(normalizeCoverUrl(raw))
  } catch {
    throw new Error('封面地址无效')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('封面地址无效')
  }
  if (url.username || url.password) {
    throw new Error('封面地址无效')
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new Error('封面地址无效')
  }
  if (!isWeChatCoverUrl(url.toString())) {
    throw new Error('只支持代取微信封面图')
  }

  const response = await fetch(url.toString(), {
    headers: COVER_HEADERS,
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error('封面读取失败')
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg'
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error('封面不是图片')
  }
  const body = await response.arrayBuffer()
  if (body.byteLength === 0 || body.byteLength > MAX_COVER_BYTES) {
    throw new Error('封面读取失败')
  }
  return { body, contentType: contentType.split(';')[0] ?? 'image/jpeg' }
}
