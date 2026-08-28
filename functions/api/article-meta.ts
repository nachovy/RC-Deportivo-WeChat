import { fetchAndParseArticleMeta } from '../../src/lib/articleMeta'

export async function onRequestGet(context: { request: Request }) {
  const target = new URL(context.request.url).searchParams.get('url') ?? ''
  try {
    const meta = await fetchAndParseArticleMeta(target)
    return Response.json(meta)
  } catch (error) {
    const message = error instanceof Error ? error.message : '原文读取失败'
    return Response.json({ error: message }, { status: 400 })
  }
}
