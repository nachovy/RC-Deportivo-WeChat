import type { IncomingMessage, ServerResponse } from 'node:http'
import { fetchWeChatCover } from '../src/lib/wechatCover'

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const target =
    new URL(request.url ?? '', 'http://localhost').searchParams.get('url') ?? ''
  try {
    const cover = await fetchWeChatCover(target)
    response.statusCode = 200
    response.setHeader('content-type', cover.contentType)
    response.setHeader('cache-control', 'public, max-age=86400')
    response.end(Buffer.from(cover.body))
  } catch (error) {
    const message = error instanceof Error ? error.message : '封面读取失败'
    response.statusCode = 400
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ error: message }))
  }
}
