import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleWeChatPublishRequest, wechatEnvFrom } from '../src/lib/wechatOfficial'

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const result = await handleWeChatPublishRequest(
    request.url ?? '/api/wechat-publish',
    wechatEnvFrom(process.env as Record<string, unknown>),
  )
  response.statusCode = result.status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(result.body))
}
