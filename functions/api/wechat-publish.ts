import { handleWeChatPublishRequest, wechatEnvFrom } from '../../src/lib/wechatOfficial'

export async function onRequestGet(context: {
  request: Request
  env: Record<string, unknown>
}) {
  const result = await handleWeChatPublishRequest(
    context.request.url,
    wechatEnvFrom(context.env),
  )
  return Response.json(result.body, { status: result.status })
}
