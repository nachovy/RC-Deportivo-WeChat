import { defaultContent } from '../data/defaultContent'
import {
  articlesForCategory,
  categoriesForSeason,
  headlineArticles,
  moveByOrder,
  moveToIndex,
  sortedSeasons,
  withArticleOrder,
} from './selectors'

const leagueArticles = articlesForCategory(defaultContent, 'cat-2526-league')
const headlines = headlineArticles(leagueArticles, 3)
if (leagueArticles.map((article) => article.id).join() !== 'a1,a2,a3,a4') {
  throw new Error('articles should follow saved order, not only publish date')
}

if (categoriesForSeason(defaultContent, 'season-2526').length !== 4) {
  throw new Error('expected 4 categories in 2025/26')
}
if (headlines.length !== 3) {
  throw new Error('expected 3 headline articles')
}
if (headlines.map((article) => article.id).join() !== 'a1,a2,a3') {
  throw new Error('headlines should follow the article list order')
}
if (headlines.some((article) => !article.featured)) {
  throw new Error('headlines should prefer featured articles')
}
if (
  headlines.some(
    (headline) => !leagueArticles.some((article) => article.id === headline.id),
  )
) {
  throw new Error('category list should still include headline articles')
}

const fillerHeadlines = headlineArticles(
  articlesForCategory(defaultContent, 'cat-2526-league').filter(
    (article) => article.id === 'a4',
  ),
  3,
)

const movedArticles = moveToIndex(
  defaultContent.articles,
  'a4',
  0,
  (article) => article.categoryId === 'cat-2526-league',
)
if (
  articlesForCategory(
    { ...defaultContent, articles: movedArticles },
    'cat-2526-league',
  )
    .map((article) => article.id)
    .join() !== 'a4,a1,a2,a3'
) {
  throw new Error('article should move to the top of its category')
}
if (
  articlesForCategory(
    { ...defaultContent, articles: movedArticles },
    'cat-2526-cup',
  )
    .map((article) => article.id)
    .join() !== 'a5,a6'
) {
  throw new Error('other categories should keep their article order')
}
if (
  headlineArticles(
    articlesForCategory(
      { ...defaultContent, articles: movedArticles },
      'cat-2526-league',
    ),
    3,
  )
    .map((article) => article.id)
    .join() !== 'a1,a2,a3'
) {
  throw new Error('non-headline articles should not jump the banner')
}

const movedFeatured = moveToIndex(
  defaultContent.articles,
  'a3',
  0,
  (article) => article.categoryId === 'cat-2526-league',
)
const movedFeaturedList = articlesForCategory(
  { ...defaultContent, articles: movedFeatured },
  'cat-2526-league',
)
if (movedFeaturedList.map((article) => article.id).join() !== 'a3,a1,a2,a4') {
  throw new Error('featured article should move to the top of its category')
}
if (
  headlineArticles(movedFeaturedList, 3)
    .map((article) => article.id)
    .join() !== 'a3,a1,a2'
) {
  throw new Error('headline banner should follow the article list order')
}

const backfilled = withArticleOrder(
  defaultContent.articles.map((article) =>
    article.categoryId === 'cat-2526-league'
      ? { ...article, order: Number.NaN }
      : article,
  ),
)
if (
  articlesForCategory(
    { ...defaultContent, articles: backfilled },
    'cat-2526-league',
  )
    .map((article) => article.id)
    .join() !== 'a1,a2,a3,a4'
) {
  throw new Error('missing article order should fall back to publish date')
}
if (fillerHeadlines[0]?.id !== 'a4' || fillerHeadlines[0]?.featured) {
  throw new Error('banner may fill with a non-headline article')
}

const lastByOrder = articlesForCategory(
  {
    ...defaultContent,
    articles: defaultContent.articles.map((article) =>
      article.id === 'a1' ? { ...article, order: -1 } : article,
    ),
  },
  'cat-2526-league',
)
if (lastByOrder.map((article) => article.id).join() !== 'a2,a3,a4,a1') {
  throw new Error('article order -1 should appear last in the category list')
}

const lastHeadline = headlineArticles(lastByOrder, 3)
if (lastHeadline.map((article) => article.id).join() !== 'a2,a3,a1') {
  throw new Error('headlines should follow the article list order')
}

const mixedHeadlines = headlineArticles(
  leagueArticles.map((article) => {
    if (article.id === 'a3') return { ...article, featured: false }
    if (article.id === 'a4') return { ...article, featured: true }
    return article
  }),
  3,
)
if (mixedHeadlines.map((article) => article.id).join() !== 'a1,a2,a4') {
  throw new Error('headlines should keep list order among featured articles')
}

const seasonsMoved = sortedSeasons({
  ...defaultContent,
  seasons: moveByOrder(defaultContent.seasons, 'season-2425', -1),
})
if (seasonsMoved.map((season) => season.id).join() !== 'season-2425,season-2526') {
  throw new Error('season should move up within the season list')
}

const movedCategories = moveByOrder(
  defaultContent.categories,
  'cat-2526-cup',
  -1,
  (category) => category.seasonId === 'season-2526',
)
const categoriesMoved = categoriesForSeason(
  { ...defaultContent, categories: movedCategories },
  'season-2526',
)
if (categoriesMoved[0]?.id !== 'cat-2526-cup') {
  throw new Error('category should move only within the same season')
}
if (
  categoriesForSeason(
    { ...defaultContent, categories: movedCategories },
    'season-2425',
  )
    .map((category) => category.id)
    .join() !==
  categoriesForSeason(defaultContent, 'season-2425')
    .map((category) => category.id)
    .join()
) {
  throw new Error('other seasons should keep their category order')
}

console.log('selector checks passed')
