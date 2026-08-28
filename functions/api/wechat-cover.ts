import { fetchWeChatCover } from '../../src/lib/wechatCover'

export async function onRequestGet(context: { request: Request }) {
  const target = new URL(context.request.url).searchParams.get('url') ?? ''
  try {
    const cover = await fetchWeChatCover(target)
    return new Response(cover.body, {
      headers: {
        'content-type': cover.contentType,
        'cache-control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '封面读取失败'
    return Response.json({ error: message }, { status: 400 })
  }
}
