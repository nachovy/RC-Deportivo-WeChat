import type { IncomingMessage, ServerResponse } from 'node:http'
import { fetchAndParseArticleMeta } from '../src/lib/articleMeta'

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const target =
    new URL(request.url ?? '', 'http://localhost').searchParams.get('url') ?? ''
  try {
    const meta = await fetchAndParseArticleMeta(target)
    response.statusCode = 200
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(meta))
  } catch (error) {
    const message = error instanceof Error ? error.message : '原文读取失败'
    response.statusCode = 400
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ error: message }))
  }
}
