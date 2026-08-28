import {
  coverSrcCandidates,
  displayCoverSrc,
  fetchWeChatCover,
  isWeChatCoverUrl,
  wechatCoverProxySrc,
} from './wechatCover'

if (!isWeChatCoverUrl('https://mmbiz.qpic.cn/mmbiz_jpg/cover/640?wx_fmt=jpeg')) {
  throw new Error('mmbiz cover should be detected')
}
if (!isWeChatCoverUrl('http://mmbiz.qlogo.cn/mmbiz/abc/0')) {
  throw new Error('qlogo cover should be detected')
}
if (isWeChatCoverUrl('https://evil.example/mmbiz.qpic.cn/x')) {
  throw new Error('non-wechat host should be rejected')
}

const wechatCover = 'https://mmbiz.qpic.cn/mmbiz_jpg/cover/640?wx_fmt=jpeg'
if (displayCoverSrc(wechatCover) !== wechatCover) {
  throw new Error('GitHub Pages should load WeChat covers directly first')
}
const candidates = coverSrcCandidates(wechatCover)
if (candidates[0] !== wechatCover) {
  throw new Error('first cover candidate should be the original WeChat url')
}
if (candidates[1] !== wechatCoverProxySrc(wechatCover)) {
  throw new Error('second cover candidate should be the local proxy')
}
if (!candidates[1]?.startsWith('/api/wechat-cover?url=')) {
  throw new Error(`expected proxy url, got ${candidates[1]}`)
}
if (displayCoverSrc('https://cdn.example/cover.jpg') !== 'https://cdn.example/cover.jpg') {
  throw new Error('non-wechat covers should stay as-is')
}
if (displayCoverSrc('') !== '') {
  throw new Error('empty cover should stay empty')
}

const encodedCover =
  'https://mmbiz.qpic.cn/sz_mmbiz_jpg/cover/640?wx_fmt=jpeg&amp;from=appmsg'
const proxiedEncoded = wechatCoverProxySrc(encodedCover)
const proxiedTarget = decodeURIComponent(proxiedEncoded.split('url=')[1] ?? '')
if (proxiedTarget.includes('&amp;')) {
  throw new Error('proxy url should decode html entities')
}
if (!proxiedTarget.includes('from=appmsg')) {
  throw new Error('proxy url should keep wechat query params')
}

try {
  await fetchWeChatCover('https://evil.example/cover.jpg')
  throw new Error('non-wechat cover fetch should fail')
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes('只支持代取微信封面图')) {
    throw error
  }
}

console.log('wechat cover checks passed')
