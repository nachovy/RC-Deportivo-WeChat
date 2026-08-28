import { defaultContent } from '../data/defaultContent'
import {
  filterPublishArticles,
  findSeasonCategory,
  mergePublishArticles,
  parseWeChatPublishList,
} from './wechatPublish'

const sample = JSON.stringify({
  base_resp: { ret: 0 },
  publish_page: JSON.stringify({
    publish_list: [
      {
        publish_info: JSON.stringify({
          appmsgex: [
            {
              title: '西乙第42轮：拉科鲁尼亚主场收官',
              link: 'https://mp.weixin.qq.com/s/end-of-season',
              cover: 'https://mmbiz.qpic.cn/cover-end.jpg',
              create_time: 1748793600,
            },
            {
              title: '俱乐部季票续订通知',
              link: 'https://mp.weixin.qq.com/s/club-news',
              cover: 'https://mmbiz.qpic.cn/cover-club.jpg',
              create_time: 1746201600,
            },
          ],
        }),
      },
      {
        publish_info: JSON.stringify({
          appmsgex: [
            {
              title: '西乙第1轮：拉科鲁尼亚客场开战',
              link: 'https://mp.weixin.qq.com/s?__biz=MzA&amp;mid=1&amp;idx=1&amp;sn=abc',
              cover: 'https://mmbiz.qpic.cn/cover-start.jpg',
              create_time: 1722816000,
            },
            {
              title: '西乙前瞻：新赛季尚未开打',
              link: 'https://mp.weixin.qq.com/s/too-early',
              cover: 'https://mmbiz.qpic.cn/cover-early.jpg',
              create_time: 1719792000,
            },
          ],
        }),
      },
    ],
  }),
})

const parsed = parseWeChatPublishList(sample)
if (parsed.length !== 4) {
  throw new Error(`expected 4 publish articles, got ${parsed.length}`)
}
if (!parsed[2]?.url.includes('__biz=MzA')) {
  throw new Error(`admin url should be cleaned: ${parsed[2]?.url}`)
}

const filtered = filterPublishArticles(parsed, {
  keyword: '西乙',
  from: '2024-08-01',
  to: '2025-06-30',
})
if (filterPublishArticles(parsed, { from: '2024-08-01', to: '2025-06-30' }).length !== 3) {
  throw new Error('empty keyword should keep all in-range articles')
}
if (filtered.map((item) => item.title).join('|') !== '西乙第42轮：拉科鲁尼亚主场收官|西乙第1轮：拉科鲁尼亚客场开战') {
  throw new Error(`unexpected filtered titles: ${filtered.map((item) => item.title).join('|')}`)
}

let nextId = 0
const merged = mergePublishArticles(
  defaultContent,
  'cat-2425-league',
  filtered,
  () => `imported-${++nextId}`,
)
if (merged.added !== 2) {
  throw new Error(`expected 2 added articles, got ${merged.added}`)
}
const league = merged.content.articles.filter(
  (article) => article.categoryId === 'cat-2425-league',
)
if (league[0]?.id !== 'imported-1' || league[0]?.title.includes('第42轮') === false) {
  throw new Error('newest 西乙 article should be first')
}
if (!league[0]?.featured || !league[1]?.featured) {
  throw new Error('imported 西乙 articles should be featured when few exist')
}

const again = mergePublishArticles(merged.content, 'cat-2425-league', filtered)
if (again.added !== 0 || again.skipped !== 2) {
  throw new Error('duplicate publish urls should be skipped')
}

const leagueCategory = findSeasonCategory(defaultContent, '2024/25', '西乙')
if (leagueCategory?.id !== 'cat-2425-league') {
  throw new Error(`expected cat-2425-league, got ${leagueCategory?.id}`)
}

const liveLike = {
  ...defaultContent,
  seasons: [{ id: 'season-live', name: '2024/25', order: 1 }],
  categories: [{ id: 'cat-7d316817', seasonId: 'season-live', name: '西乙', order: 1 }],
}
if (findSeasonCategory(liveLike, '2024/25', '西乙')?.id !== 'cat-7d316817') {
  throw new Error('live 24/25 西乙 category should match')
}

console.log('wechat publish checks passed')
