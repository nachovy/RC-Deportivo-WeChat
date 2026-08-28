import { useEffect, useMemo, useState } from 'react'
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { categoriesForSeason, sortedSeasons } from './lib/selectors'
import { loadContent, resetContent, saveContent } from './lib/storage'
import { AdminPage } from './pages/AdminPage'
import { PortalPage } from './pages/PortalPage'
import type { SiteContent } from './types'

function PortalRoute({ content }: { content: SiteContent }) {
  const { seasonId, categoryId } = useParams()
  const navigate = useNavigate()
  const seasons = sortedSeasons(content)
  const activeSeason =
    seasons.find((season) => season.id === seasonId) ?? seasons[0]
  const categories = activeSeason
    ? categoriesForSeason(content, activeSeason.id)
    : []
  const activeCategory =
    categories.find((category) => category.id === categoryId) ?? categories[0]

  useEffect(() => {
    if (!activeSeason) return
    if (seasonId !== activeSeason.id || categoryId !== activeCategory?.id) {
      const nextCategory = activeCategory?.id ?? 'none'
      navigate(`/s/${activeSeason.id}/c/${nextCategory}`, { replace: true })
    }
  }, [activeCategory, activeSeason, categoryId, navigate, seasonId])

  if (!activeSeason || !activeCategory) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        还没有赛季或分类。
      </div>
    )
  }

  return (
    <PortalPage
      content={content}
      seasonId={activeSeason.id}
      categoryId={activeCategory.id}
      onSelectSeason={(nextSeasonId) => {
        const nextCategory = categoriesForSeason(content, nextSeasonId)[0]
        navigate(`/s/${nextSeasonId}/c/${nextCategory?.id ?? 'none'}`)
      }}
      onSelectCategory={(nextCategoryId) => {
        navigate(`/s/${activeSeason.id}/c/${nextCategoryId}`)
      }}
    />
  )
}

function HomeRedirect({ content }: { content: SiteContent }) {
  const season = sortedSeasons(content)[0]
  const category = season
    ? categoriesForSeason(content, season.id)[0]
    : undefined
  if (!season || !category) return <Navigate to="/admin" replace />
  return <Navigate to={`/s/${season.id}/c/${category.id}`} replace />
}

function App() {
  const [content, setContent] = useState<SiteContent>(() => loadContent())
  const persist = useMemo(
    () => (next: SiteContent) => {
      saveContent(next)
      setContent(next)
    },
    [],
  )

  return (
    <HashRouter>
      <div className="phone-shell h-full">
        <Routes>
          <Route path="/" element={<HomeRedirect content={content} />} />
          <Route
            path="/s/:seasonId/c/:categoryId"
            element={<PortalRoute content={content} />}
          />
          <Route
            path="/admin"
            element={
              <AdminPage
                content={content}
                onChange={persist}
                onReset={() => persist(resetContent())}
              />
            }
          />
        </Routes>
      </div>
    </HashRouter>
  )
}

export default App
