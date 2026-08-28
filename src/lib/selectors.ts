import type { Article, Category, Season, SiteContent } from '../types'

type Ordered = { id: string; order: number }

export function sortRank(order: number): number {
  return Number.isFinite(order) && order >= 0 ? order : Number.POSITIVE_INFINITY
}

function byOrder<T extends Ordered>(a: T, b: T): number {
  return sortRank(a.order) - sortRank(b.order) || a.id.localeCompare(b.id)
}

export function sortedSeasons(content: SiteContent): Season[] {
  return [...content.seasons].sort((a, b) => a.order - b.order)
}

export function moveByOrder<T extends Ordered>(
  items: T[],
  id: string,
  direction: -1 | 1,
  inGroup: (item: T) => boolean = () => true,
): T[] {
  const group = items.filter(inGroup).sort(byOrder)
  const index = group.findIndex((item) => item.id === id)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= group.length) return items

  const reordered = [...group]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(nextIndex, 0, moved)
  const orderById = new Map(reordered.map((item, i) => [item.id, i + 1]))

  return items.map((item) => {
    const order = orderById.get(item.id)
    return order === undefined || order === item.order ? item : { ...item, order }
  })
}

export function categoriesForSeason(
  content: SiteContent,
  seasonId: string,
): Category[] {
  return content.categories
    .filter((category) => category.seasonId === seasonId)
    .sort((a, b) => a.order - b.order)
}

export function moveToIndex<T extends Ordered>(
  items: T[],
  id: string,
  toIndex: number,
  inGroup: (item: T) => boolean = () => true,
): T[] {
  const group = items.filter(inGroup).sort(byOrder)
  const fromIndex = group.findIndex((item) => item.id === id)
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    toIndex >= group.length ||
    fromIndex === toIndex
  ) {
    return items
  }

  const reordered = [...group]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  const orderById = new Map(reordered.map((item, i) => [item.id, i + 1]))

  return items.map((item) => {
    const order = orderById.get(item.id)
    return order === undefined || order === item.order ? item : { ...item, order }
  })
}

export function withArticleOrder(articles: Article[]): Article[] {
  const groups = new Map<string, Article[]>()
  for (const article of articles) {
    const list = groups.get(article.categoryId) ?? []
    list.push(article)
    groups.set(article.categoryId, list)
  }

  const orderById = new Map<string, number>()
  for (const group of groups.values()) {
    const stickyLast = group.filter(
      (article) => Number.isFinite(article.order) && article.order < 0,
    )
    const rest = group.filter(
      (article) => !(Number.isFinite(article.order) && article.order < 0),
    )
    const sorted = [...rest].sort((a, b) => {
      const aOrder = sortRank(a.order)
      const bOrder = sortRank(b.order)
      if (aOrder !== bOrder) return aOrder - bOrder
      return (
        b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)
      )
    })
    sorted.forEach((article, index) => orderById.set(article.id, index + 1))
    stickyLast.forEach((article) => orderById.set(article.id, article.order))
  }

  return articles.map((article) => {
    const order = orderById.get(article.id) ?? 1
    return article.order === order ? article : { ...article, order }
  })
}

export function articlesForCategory(
  content: SiteContent,
  categoryId: string,
): Article[] {
  return content.articles
    .filter((article) => article.categoryId === categoryId)
    .sort(
      (a, b) =>
        sortRank(a.order) - sortRank(b.order) ||
        b.publishedAt.localeCompare(a.publishedAt) ||
        a.id.localeCompare(b.id),
    )
}

export function headlineArticles(articles: Article[], count = 3): Article[] {
  const ranked = [...articles].sort(
    (a, b) =>
      sortRank(a.order) - sortRank(b.order) ||
      b.publishedAt.localeCompare(a.publishedAt) ||
      a.id.localeCompare(b.id),
  )
  const featured = ranked.filter((article) => article.featured)

  if (featured.length >= count) {
    return featured.slice(0, count)
  }

  const featuredIds = new Set(featured.map((article) => article.id))
  const fillers = ranked.filter((article) => !featuredIds.has(article.id))
  return [...featured, ...fillers].slice(0, count)
}
