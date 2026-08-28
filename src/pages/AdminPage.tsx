import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SortableList } from '../components/SortableList'
import { normalizeArticleUrl } from '../lib/articleMeta'
import { fetchArticleMeta } from '../lib/fetchArticleMeta'
import {
  fetchWeChatAccountStatus,
  fetchWeChatPublish,
} from '../lib/fetchWeChatPublish'
import { createId } from '../lib/id'
import {
  articlesForCategory,
  categoriesForSeason,
  moveByOrder,
  moveToIndex,
  sortedSeasons,
} from '../lib/selectors'
import { downloadContent } from '../lib/storage'
import {
  filterPublishArticles,
  mergePublishArticles,
  parseWeChatPublishList,
  type PublishArticle,
} from '../lib/wechatPublish'
import type { Article, SiteContent } from '../types'

type AdminPageProps = {
  content: SiteContent
  onChange: (next: SiteContent) => void
  onReset: () => void
}

type Tab = 'site' | 'seasons' | 'categories' | 'articles'

const LAST_FEATURED_ORDER_KEY = 'rcdeportivo-last-featured-order'
const LAST_IMPORT_FILTER_KEY = 'rcdeportivo-last-import-filter'

type ImportFilterForm = {
  keyword: string
  from: string
  to: string
}

function loadLastImportFilter(): ImportFilterForm {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(LAST_IMPORT_FILTER_KEY) ?? '',
    ) as Partial<ImportFilterForm>
    return {
      keyword: typeof parsed.keyword === 'string' ? parsed.keyword : '西乙',
      from: typeof parsed.from === 'string' ? parsed.from : '2024-08-01',
      to: typeof parsed.to === 'string' ? parsed.to : '2025-06-30',
    }
  } catch {
    return { keyword: '西乙', from: '2024-08-01', to: '2025-06-30' }
  }
}

function rememberImportFilter(filter: ImportFilterForm): ImportFilterForm {
  try {
    localStorage.setItem(LAST_IMPORT_FILTER_KEY, JSON.stringify(filter))
  } catch {
    /* ignore quota / private mode */
  }
  return filter
}

function loadLastFeaturedOrder(): number {
  try {
    const raw = localStorage.getItem(LAST_FEATURED_ORDER_KEY)
    const value = raw == null ? NaN : Number(raw)
    return Number.isFinite(value) ? value : 1
  } catch {
    return 1
  }
}

function rememberFeaturedOrder(value: number): number {
  const next = Number.isFinite(value) ? value : 1
  try {
    localStorage.setItem(LAST_FEATURED_ORDER_KEY, String(next))
  } catch {
    /* ignore quota / private mode */
  }
  return next
}

function emptyArticleForm(featuredOrder = loadLastFeaturedOrder()) {
  return {
    title: '',
    cover: '',
    url: 'https://mp.weixin.qq.com/',
    featured: false,
    featuredOrder,
    publishedAt: new Date().toISOString().slice(0, 10),
  }
}

export function AdminPage({ content, onChange, onReset }: AdminPageProps) {
  const [tab, setTab] = useState<Tab>('articles')
  const [seasonName, setSeasonName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [categorySeasonId, setCategorySeasonId] = useState(
    content.seasons[0]?.id ?? '',
  )
  const [articleSeasonId, setArticleSeasonId] = useState(
    content.seasons[0]?.id ?? '',
  )
  const [articleCategoryId, setArticleCategoryId] = useState(
    content.categories[0]?.id ?? '',
  )
  const [articleForm, setArticleForm] = useState(() => emptyArticleForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fetchingMeta, setFetchingMeta] = useState(false)
  const [fetchMessage, setFetchMessage] = useState('')
  const [publishJson, setPublishJson] = useState('')
  const [importFilter, setImportFilter] = useState(loadLastImportFilter)
  const [importing, setImporting] = useState(false)
  const [accountConfigured, setAccountConfigured] = useState<boolean | null>(null)
  const [importMessage, setImportMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void fetchWeChatAccountStatus()
      .then((status) => {
        if (!cancelled) setAccountConfigured(status.configured)
      })
      .catch(() => {
        if (!cancelled) setAccountConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const seasons = sortedSeasons(content)
  const categoryOptions = useMemo(
    () => categoriesForSeason(content, articleSeasonId),
    [content, articleSeasonId],
  )
  const seasonCategories = useMemo(
    () => categoriesForSeason(content, categorySeasonId),
    [content, categorySeasonId],
  )
  const filteredArticles = articlesForCategory(content, articleCategoryId)

  function updateSite(field: 'title' | 'subtitle', value: string) {
    onChange({ ...content, [field]: value })
  }

  function addSeason() {
    const name = seasonName.trim()
    if (!name) return
    const season = {
      id: createId('season'),
      name,
      order: Math.max(0, ...content.seasons.map((item) => item.order)) + 1,
    }
    onChange({ ...content, seasons: [...content.seasons, season] })
    setSeasonName('')
  }

  function removeSeason(id: string) {
    const categoryIds = new Set(
      content.categories
        .filter((category) => category.seasonId === id)
        .map((category) => category.id),
    )
    onChange({
      ...content,
      seasons: content.seasons.filter((season) => season.id !== id),
      categories: content.categories.filter(
        (category) => category.seasonId !== id,
      ),
      articles: content.articles.filter(
        (article) => !categoryIds.has(article.categoryId),
      ),
    })
  }

  function addCategory() {
    const name = categoryName.trim()
    if (!name || !categorySeasonId) return
    const siblings = content.categories.filter(
      (category) => category.seasonId === categorySeasonId,
    )
    onChange({
      ...content,
      categories: [
        ...content.categories,
        {
          id: createId('cat'),
          seasonId: categorySeasonId,
          name,
          order: Math.max(0, ...siblings.map((item) => item.order)) + 1,
        },
      ],
    })
    setCategoryName('')
  }

  function moveSeason(id: string, direction: -1 | 1) {
    onChange({
      ...content,
      seasons: moveByOrder(content.seasons, id, direction),
    })
  }

  function moveCategory(id: string, direction: -1 | 1) {
    const category = content.categories.find((item) => item.id === id)
    if (!category) return
    onChange({
      ...content,
      categories: moveByOrder(
        content.categories,
        id,
        direction,
        (item) => item.seasonId === category.seasonId,
      ),
    })
  }

  function removeCategory(id: string) {
    onChange({
      ...content,
      categories: content.categories.filter((category) => category.id !== id),
      articles: content.articles.filter((article) => article.categoryId !== id),
    })
  }

  async function importFromUrl() {
    const url = articleForm.url.trim()
    if (!url || url === 'https://mp.weixin.qq.com/') {
      setFetchMessage('请先粘贴完整的微信文章链接')
      return
    }
    let cleaned = url
    try {
      cleaned = normalizeArticleUrl(url)
    } catch (error) {
      setFetchMessage(error instanceof Error ? error.message : '请输入有效的文章链接')
      return
    }
    setArticleForm((current) => ({ ...current, url: cleaned }))
    setFetchingMeta(true)
    setFetchMessage('')
    try {
      const meta = await fetchArticleMeta(cleaned)
      setArticleForm((current) => ({
        ...current,
        title: meta.title || current.title,
        cover: meta.cover || current.cover,
        url: meta.url || current.url,
        publishedAt: meta.publishedAt || current.publishedAt,
      }))
      setFetchMessage('已从原文读取标题、封面和日期，可再手动微调')
    } catch (error) {
      setFetchMessage(error instanceof Error ? error.message : '原文读取失败')
    } finally {
      setFetchingMeta(false)
    }
  }

  function saveArticle() {
    if (!articleForm.url.trim() || !articleCategoryId) return
    if (!articleForm.title.trim()) {
      setFetchMessage('请先读取原文，或手动填写标题')
      return
    }
    const featuredOrder = Number.isFinite(Number(articleForm.featuredOrder))
      ? Number(articleForm.featuredOrder)
      : 1
    const pinLast = featuredOrder < 0
    if (editingId) {
      const current = content.articles.find((article) => article.id === editingId)
      const categoryChanged = current?.categoryId !== articleCategoryId
      onChange({
        ...content,
        articles: content.articles.map((article) => {
          if (article.id === editingId) {
            return {
              ...article,
              ...articleForm,
              categoryId: articleCategoryId,
              title: articleForm.title.trim(),
              featuredOrder,
              order: pinLast ? -1 : categoryChanged ? 1 : article.order,
            }
          }
          if (
            !pinLast &&
            categoryChanged &&
            article.categoryId === articleCategoryId &&
            article.order >= 0
          ) {
            return { ...article, order: article.order + 1 }
          }
          return article
        }),
      })
      setEditingId(null)
    } else {
      const article: Article = {
        id: createId('article'),
        categoryId: articleCategoryId,
        title: articleForm.title.trim(),
        cover: articleForm.cover,
        url: articleForm.url,
        featured: articleForm.featured,
        featuredOrder,
        order: pinLast ? -1 : 0,
        publishedAt: articleForm.publishedAt,
      }
      onChange({
        ...content,
        articles: [
          article,
          ...content.articles.map((item) =>
            !pinLast && item.categoryId === articleCategoryId && item.order >= 0
              ? { ...item, order: item.order + 1 }
              : item,
          ),
        ],
      })
    }
    setArticleForm(emptyArticleForm(rememberFeaturedOrder(featuredOrder)))
    setFetchMessage('')
  }

  function editArticle(article: Article) {
    const parent = content.categories.find(
      (category) => category.id === article.categoryId,
    )
    if (parent) setArticleSeasonId(parent.seasonId)
    setArticleCategoryId(article.categoryId)
    setArticleForm({
      title: article.title,
      cover: article.cover,
      url: article.url,
      featured: article.featured,
      featuredOrder: article.featuredOrder,
      publishedAt: article.publishedAt,
    })
    setEditingId(article.id)
    setTab('articles')
  }

  function moveArticle(id: string, toIndex: number) {
    onChange({
      ...content,
      articles: moveToIndex(
        content.articles,
        id,
        toIndex,
        (article) => article.categoryId === articleCategoryId,
      ),
    })
  }

  function applyImportedArticles(
    incoming: PublishArticle[],
    scanned: number,
    extra = '',
  ) {
    const category = content.categories.find(
      (item) => item.id === articleCategoryId,
    )
    if (!category) {
      setImportMessage('请先选择要写入的赛季和分类')
      return
    }
    const season = content.seasons.find((item) => item.id === category.seasonId)
    const filter = rememberImportFilter({
      keyword: importFilter.keyword.trim(),
      from: importFilter.from.trim(),
      to: importFilter.to.trim(),
    })
    const matched = filterPublishArticles(incoming, filter)
    const result = mergePublishArticles(content, category.id, matched)
    onChange(result.content)
    const keywordLabel = filter.keyword ? `「${filter.keyword}」` : '全部标题'
    const rangeLabel =
      filter.from || filter.to
        ? `${filter.from || '不限'} ~ ${filter.to || '不限'}`
        : '不限日期'
    setImportMessage(
      `扫描 ${scanned} 篇，筛出 ${matched.length} 篇（${keywordLabel}，${rangeLabel}）；新增 ${result.added} 篇到「${season?.name ?? ''} / ${category.name}」，跳过 ${result.skipped} 篇重复。${extra}`,
    )
  }

  async function importFromAccount() {
    if (!articleCategoryId) {
      setImportMessage('请先选择要写入的赛季和分类')
      return
    }
    setImporting(true)
    setImportMessage('')
    try {
      const result = await fetchWeChatPublish({
        keyword: importFilter.keyword.trim(),
        from: importFilter.from.trim(),
        to: importFilter.to.trim(),
      })
      setAccountConfigured(result.configured)
      if (!result.configured) {
        setImportMessage(
          result.error ||
            '尚未关联公众号。请配置 WECHAT_APPID / WECHAT_APPSECRET 后重启，或改用下方粘贴 JSON。',
        )
        return
      }
      if (result.error) throw new Error(result.error)
      applyImportedArticles(
        result.articles,
        result.scanned,
        result.truncated ? '已达翻页上限，可缩小日期范围后再导一次。' : '',
      )
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '公众号导入失败')
    } finally {
      setImporting(false)
    }
  }

  function importFromPaste() {
    if (!articleCategoryId) {
      setImportMessage('请先选择要写入的赛季和分类')
      return
    }
    try {
      const parsed = parseWeChatPublishList(publishJson)
      if (parsed.length === 0) {
        setImportMessage('没有解析到文章，请粘贴 appmsgpublish 的 JSON 响应')
        return
      }
      applyImportedArticles(parsed, parsed.length, '可继续粘贴下一页 JSON。')
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '导入失败')
    }
  }

  function removeArticle(id: string) {
    onChange({
      ...content,
      articles: content.articles.filter((article) => article.id !== id),
    })
    if (editingId === id) {
      setEditingId(null)
      setArticleForm(emptyArticleForm())
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'site', label: '站点' },
    { id: 'seasons', label: '赛季' },
    { id: 'categories', label: '类别' },
    { id: 'articles', label: '文章' },
  ]

  return (
    <div className="scroll-touch h-full overflow-y-auto bg-slate-50">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[var(--club-navy)] px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="./crest.svg"
            alt="皇家拉科鲁尼亚队徽"
            className="h-10 w-auto shrink-0 object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-base font-semibold">内容后台</h1>
            <p className="text-xs text-white/70">自由添加赛季、类别和文章</p>
          </div>
        </div>
        <Link to="/" className="rounded-full bg-white/15 px-3 py-1 text-xs">
          返回门户
        </Link>
      </header>

      <nav className="grid grid-cols-4 bg-white text-sm shadow-sm">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`py-3 ${
              tab === item.id
                ? 'border-b-2 border-[var(--club-blue)] font-semibold text-[var(--club-blue)]'
                : 'text-slate-500'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="space-y-4 p-4">
        {tab === 'site' && (
          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <label className="block text-sm">
              站点标题
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={content.title}
                onChange={(event) => updateSite('title', event.target.value)}
              />
            </label>
            <label className="block text-sm">
              副标题
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={content.subtitle}
                onChange={(event) => updateSite('subtitle', event.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-[var(--club-blue)] px-3 py-2 text-sm text-white"
                onClick={() => downloadContent(content)}
              >
                导出 JSON
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-200 px-3 py-2 text-sm"
                onClick={onReset}
              >
                恢复示例
              </button>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              浏览器会把修改保存在本地。GitHub Pages 读取仓库里的
              <code className="mx-1 rounded bg-slate-100 px-1">public/content.json</code>
              。导出 JSON 覆盖该文件并推送到
              <code className="mx-1 rounded bg-slate-100 px-1">main</code>
              后，线上会同步这份内容。
            </p>
          </section>
        )}

        {tab === 'seasons' && (
          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                placeholder="例如 2026/27"
                value={seasonName}
                onChange={(event) => setSeasonName(event.target.value)}
              />
              <button
                type="button"
                className="rounded-lg bg-[var(--club-blue)] px-3 py-2 text-sm text-white"
                onClick={addSeason}
              >
                添加赛季
              </button>
            </div>
            <p className="text-xs text-slate-500">
              用上移 / 下移调整门户顶部赛季顺序。
            </p>
            <ul className="divide-y divide-slate-100">
              {seasons.map((season, index) => (
                <li
                  key={season.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="mr-2 text-xs text-slate-400">{index + 1}</span>
                    {season.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      className="text-[var(--club-blue)] disabled:text-slate-300"
                      disabled={index === 0}
                      onClick={() => moveSeason(season.id, -1)}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      className="text-[var(--club-blue)] disabled:text-slate-300"
                      disabled={index === seasons.length - 1}
                      onClick={() => moveSeason(season.id, 1)}
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={() => removeSeason(season.id)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'categories' && (
          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={categorySeasonId}
              onChange={(event) => setCategorySeasonId(event.target.value)}
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                placeholder="例如 西乙联赛"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
              />
              <button
                type="button"
                className="rounded-lg bg-[var(--club-blue)] px-3 py-2 text-sm text-white"
                onClick={addCategory}
              >
                添加类别
              </button>
            </div>
            <p className="text-xs text-slate-500">
              只调整当前赛季内的类别顺序，对应门户左侧分类。
            </p>
            <ul className="divide-y divide-slate-100">
              {seasonCategories.map((category, index) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="mr-2 text-xs text-slate-400">{index + 1}</span>
                    {category.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      className="text-[var(--club-blue)] disabled:text-slate-300"
                      disabled={index === 0}
                      onClick={() => moveCategory(category.id, -1)}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      className="text-[var(--club-blue)] disabled:text-slate-300"
                      disabled={index === seasonCategories.length - 1}
                      onClick={() => moveCategory(category.id, 1)}
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={() => removeCategory(category.id)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'articles' && (
          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-lg border border-slate-200 px-3 py-2"
                value={articleSeasonId}
                onChange={(event) => {
                  const nextSeason = event.target.value
                  setArticleSeasonId(nextSeason)
                  const nextCategory = categoriesForSeason(content, nextSeason)[0]
                  setArticleCategoryId(nextCategory?.id ?? '')
                }}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2"
                value={articleCategoryId}
                onChange={(event) => setArticleCategoryId(event.target.value)}
              >
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-700">一键导入公众号文章</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {accountConfigured
                  ? '已关联公众号接口，可按关键字和日期筛选后写入上方选中的赛季分类。'
                  : '未配置 AppID / AppSecret 时，可改用下方粘贴 JSON。密钥只放服务端环境变量，不要贴到页面里。'}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input
                  className="col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="标题关键字，可空"
                  value={importFilter.keyword}
                  onChange={(event) =>
                    setImportFilter((current) => ({
                      ...current,
                      keyword: event.target.value,
                    }))
                  }
                />
                <label className="text-xs text-slate-500">
                  开始日期
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={importFilter.from}
                    onChange={(event) =>
                      setImportFilter((current) => ({
                        ...current,
                        from: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-xs text-slate-500">
                  结束日期
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={importFilter.to}
                    onChange={(event) =>
                      setImportFilter((current) => ({
                        ...current,
                        to: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                className="mt-3 w-full rounded-lg bg-slate-800 py-2 text-sm text-white disabled:opacity-60"
                disabled={importing}
                onClick={() => void importFromAccount()}
              >
                {importing ? '正在从公众号读取…' : '从关联公众号导入'}
              </button>
              <textarea
                className="mt-3 h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                placeholder="备用：粘贴公众号后台 appmsgpublish 的 JSON 响应"
                value={publishJson}
                onChange={(event) => setPublishJson(event.target.value)}
              />
              <button
                type="button"
                className="mt-2 w-full rounded-lg bg-slate-700 py-2 text-sm text-white"
                onClick={importFromPaste}
              >
                从粘贴 JSON 导入
              </button>
              {importMessage ? (
                <p className="mt-2 text-xs leading-5 text-slate-500">{importMessage}</p>
              ) : (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  会写入当前选中的赛季分类，已存在的链接会跳过。关键字和日期会记住上次填写。
                </p>
              )}
            </div>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="粘贴微信文章链接"
              value={articleForm.url}
              onChange={(event) =>
                setArticleForm((current) => ({
                  ...current,
                  url: event.target.value,
                }))
              }
            />
            <button
              type="button"
              className="w-full rounded-lg bg-slate-800 py-2 text-sm text-white disabled:opacity-60"
              disabled={fetchingMeta}
              onClick={() => void importFromUrl()}
            >
              {fetchingMeta ? '正在读取原文…' : '读取原文信息'}
            </button>
            {fetchMessage ? (
              <p className="text-xs leading-5 text-slate-500">{fetchMessage}</p>
            ) : (
              <p className="text-xs leading-5 text-slate-500">
                请粘贴已发布文章的分享链接。失败后可手动填写标题、封面和日期。
              </p>
            )}
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="文章标题（读取后自动填入）"
              value={articleForm.title}
              onChange={(event) =>
                setArticleForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="封面图 URL（读取后自动填入，可空）"
              value={articleForm.cover}
              onChange={(event) =>
                setArticleForm((current) => ({
                  ...current,
                  cover: event.target.value,
                }))
              }
            />
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={articleForm.featured}
                  onChange={(event) =>
                    setArticleForm((current) => ({
                      ...current,
                      featured: event.target.checked,
                    }))
                  }
                />
                头条
              </label>
              <label className="flex items-center gap-2">
                顺序
                <input
                  type="number"
                  className="w-16 rounded border border-slate-200 px-2 py-1"
                  value={articleForm.featuredOrder}
                  onChange={(event) =>
                    setArticleForm((current) => ({
                      ...current,
                      featuredOrder: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <input
                type="date"
                className="rounded border border-slate-200 px-2 py-1"
                value={articleForm.publishedAt}
                onChange={(event) =>
                  setArticleForm((current) => ({
                    ...current,
                    publishedAt: event.target.value,
                  }))
                }
              />
            </div>
            <button
              type="button"
              className="w-full rounded-lg bg-[var(--club-blue)] py-2 text-sm text-white"
              onClick={saveArticle}
            >
              {editingId ? '保存修改' : '添加文章'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="w-full text-xs text-slate-500"
                onClick={() => {
                  setEditingId(null)
                  setArticleForm(emptyArticleForm())
                }}
              >
                取消编辑
              </button>
            ) : null}
            <p className="text-xs text-slate-500">
              顺序填 -1 会排在最后。按住左侧 ⋮⋮ 拖动，也可调整当前分类在门户里的文章顺序。新文章默认排在最前。
            </p>
            <div className="scroll-touch max-h-[50vh] overflow-y-auto rounded-lg border border-slate-100 px-1">
              <SortableList
                items={filteredArticles}
                onMove={moveArticle}
                renderItem={(article) => (
                  <>
                    <p className="text-sm font-medium">
                      {article.featured ? '★ ' : ''}
                      {article.title}
                    </p>
                    <p className="text-xs text-slate-500">{article.publishedAt}</p>
                    <div className="mt-2 flex gap-3 text-xs">
                      <button
                        type="button"
                        className="text-[var(--club-blue)]"
                        onClick={() => editArticle(article)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="text-red-500"
                        onClick={() => removeArticle(article.id)}
                      >
                        删除
                      </button>
                    </div>
                  </>
                )}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
