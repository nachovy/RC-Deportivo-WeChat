export type Season = {
  id: string
  name: string
  order: number
}

export type Category = {
  id: string
  seasonId: string
  name: string
  order: number
}

export type Article = {
  id: string
  categoryId: string
  title: string
  cover: string
  url: string
  featured: boolean
  featuredOrder: number
  order: number
  publishedAt: string
}

export type SiteContent = {
  title: string
  subtitle: string
  seasons: Season[]
  categories: Category[]
  articles: Article[]
}
