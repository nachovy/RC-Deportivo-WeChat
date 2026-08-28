import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import { fetchAndParseArticleMeta } from './src/lib/articleMeta.ts'
import { fetchWeChatCover } from './src/lib/wechatCover.ts'
import {
  handleWeChatPublishRequest,
  wechatEnvFrom,
} from './src/lib/wechatOfficial.ts'

type ConnectRequest = IncomingMessage & { originalUrl?: string }

function requestUrl(req: ConnectRequest): string {
  return req.originalUrl ?? req.url ?? ''
}

async function handleArticleMeta(req: ConnectRequest, res: ServerResponse) {
  const target =
    new URL(requestUrl(req), 'http://localhost').searchParams.get('url') ?? ''
  try {
    const meta = await fetchAndParseArticleMeta(target)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(meta))
  } catch (error) {
    const message = error instanceof Error ? error.message : '原文读取失败'
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: message }))
  }
}

async function handleWeChatCover(req: ConnectRequest, res: ServerResponse) {
  const target =
    new URL(requestUrl(req), 'http://localhost').searchParams.get('url') ?? ''
  try {
    const cover = await fetchWeChatCover(target)
    res.statusCode = 200
    res.setHeader('Content-Type', cover.contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.end(Buffer.from(cover.body))
  } catch (error) {
    const message = error instanceof Error ? error.message : '封面读取失败'
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: message }))
  }
}

async function handleWeChatPublish(req: ConnectRequest, res: ServerResponse) {
  const env = wechatEnvFrom({
    ...loadEnv('development', process.cwd(), ''),
    ...loadEnv('production', process.cwd(), ''),
    ...(process.env as Record<string, unknown>),
  })
  const result = await handleWeChatPublishRequest(requestUrl(req), env)
  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(result.body))
}

export function articleMetaApi(): Plugin {
  const middleware = (
    req: ConnectRequest,
    res: ServerResponse,
    next: () => void,
  ) => {
    const path = requestUrl(req).split('?')[0]
    if (req.method === 'GET' && path === '/api/article-meta') {
      void handleArticleMeta(req, res)
      return
    }
    if (req.method === 'GET' && path === '/api/wechat-cover') {
      void handleWeChatCover(req, res)
      return
    }
    if (req.method === 'GET' && path === '/api/wechat-publish') {
      void handleWeChatPublish(req, res)
      return
    }
    next()
  }

  return {
    name: 'article-meta-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
