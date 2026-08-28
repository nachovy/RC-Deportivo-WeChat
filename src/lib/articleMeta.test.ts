import {
  excerptHtmlForMeta,
  normalizeArticleUrl,
  normalizeDate,
  parseArticleMeta,
  weChatReadError,
} from './articleMeta'

const sample = `
<html>
  <head>
    <title>浏览器标题</title>
    <meta property="og:title" content="主场击败强敌，蓝白军团连胜继续" />
    <meta property="og:description" content="里亚索球场再度沸腾，德波蒂沃在关键战役中拿下三分。" />
    <meta property="og:image" content="http://mmbiz.qpic.cn/mmbiz_jpg/cover/640?wx_fmt=jpeg" />
    <meta property="og:url" content="https://mp.weixin.qq.com/s/demo" />
  </head>
  <body>
    <h1 id="activity-name">主场击败强敌，蓝白军团连胜继续</h1>
    <em id="publish_time">2026年8月24日 21:00</em>
    <script>
      var msg_title = htmlDecode("主场击败强敌，蓝白军团连胜继续");
      var msg_desc = "里亚索球场再度沸腾";
      var msg_cdn_url = "http://mmbiz.qpic.cn/mmbiz_jpg/cover/640?wx_fmt=jpeg";
      var ct = "1756051200";
    </script>
  </body>
</html>
`

const meta = parseArticleMeta(sample, 'https://example.com/fallback')

if (meta.title !== '主场击败强敌，蓝白军团连胜继续') {
  throw new Error(`unexpected title: ${meta.title}`)
}
if (!meta.summary.includes('里亚索球场')) {
  throw new Error(`unexpected summary: ${meta.summary}`)
}
if (!meta.cover.startsWith('https://mmbiz.qpic.cn/')) {
  throw new Error(`cover should be https: ${meta.cover}`)
}
if (meta.publishedAt !== '2025-08-25') {
  throw new Error(`unexpected publishedAt: ${meta.publishedAt}`)
}
if (normalizeDate('2026年8月24日') !== '2026-08-24') {
  throw new Error('chinese date parse failed')
}
if (normalizeDate('2026-08-24T12:00:00Z') !== '2026-08-24') {
  throw new Error(`iso date failed: ${normalizeDate('2026-08-24T12:00:00Z')}`)
}
if (meta.url !== 'https://mp.weixin.qq.com/s/demo') {
  throw new Error(`unexpected url: ${meta.url}`)
}

if (normalizeDate('2024年1月2日') !== '2024-01-02') {
  throw new Error('padded chinese date failed')
}

const copied =
  'https://mp.weixin.qq.com/s?__biz=MzI3MTY1MDY5NQ==&amp;mid=2247491230&amp;idx=1&amp;sn=f168545d7a2824935661d10e90640131&amp;scene=19&token=371060611&lang=zh_CN&poc_token=abc'
const cleaned = normalizeArticleUrl(copied)
if (!cleaned.includes('__biz=MzI3MTY1MDY5NQ')) {
  throw new Error(`biz missing: ${cleaned}`)
}
if (!cleaned.includes('mid=2247491230') || !cleaned.includes('idx=1')) {
  throw new Error(`mid/idx missing: ${cleaned}`)
}
if (!cleaned.includes('sn=f168545d7a2824935661d10e90640131')) {
  throw new Error(`sn missing: ${cleaned}`)
}
if (cleaned.includes('token=') || cleaned.includes('poc_token') || cleaned.includes('scene=')) {
  throw new Error(`session params should be stripped: ${cleaned}`)
}
if (cleaned.includes('&amp;')) {
  throw new Error(`html entity remains: ${cleaned}`)
}

const captchaUrl =
  'https://mp.weixin.qq.com/mp/wappoc_appmsgcaptcha?poc_token=x&target_url=' +
  encodeURIComponent(
    'https://mp.weixin.qq.com/s?__biz=MzI3MTY1MDY5NQ==&mid=2247491230&idx=1&sn=f168545d7a2824935661d10e90640131',
  )
if (!normalizeArticleUrl(captchaUrl).includes('sn=f168545d7a2824935661d10e90640131')) {
  throw new Error(`captcha target not unwrapped: ${normalizeArticleUrl(captchaUrl)}`)
}

const captchaHtml = `
<title></title>
<link rel="stylesheet" href="//res.wx.qq.com/mmbizwap/zh_CN/htmledition/style/page/secitptpage/verify804d1f.css">
`
const captchaError = weChatReadError(
  captchaHtml,
  'https://mp.weixin.qq.com/mp/wappoc_appmsgcaptcha?poc_token=x',
)
if (!captchaError?.includes('安全验证')) {
  throw new Error(`expected captcha error, got ${captchaError}`)
}

const paramErrorHtml = `
<div class="weui-msg__title warn">参数错误</div>
<script>var biz = '' || ''; var sn = '' || ''; var ret = '-2' * 1;</script>
`
if (!weChatReadError(paramErrorHtml)?.includes('参数错误')) {
  throw new Error('expected param error')
}

const emptyPage = parseArticleMeta('<html><title></title></html>', copied)
if (emptyPage.title !== '') {
  throw new Error(`empty page should not invent a title: ${emptyPage.title}`)
}

const hugeHtml = `${'x'.repeat(1_600_000)}<script>var msg_title = "超长原文标题"; var msg_desc = "摘要"; var msg_cdn_url = "http://mmbiz.qpic.cn/mmbiz_jpg/cover/640"; var ct = "1756051200";</script>`
const excerpt = excerptHtmlForMeta(hugeHtml)
if (excerpt.length >= hugeHtml.length) {
  throw new Error('excerpt should be smaller than the original html')
}
const hugeMeta = parseArticleMeta(excerpt)
if (hugeMeta.title !== '超长原文标题') {
  throw new Error(`huge html title failed: ${hugeMeta.title}`)
}
if (!hugeMeta.cover.includes('mmbiz.qpic.cn')) {
  throw new Error(`huge html cover failed: ${hugeMeta.cover}`)
}

console.log('article meta checks passed')
