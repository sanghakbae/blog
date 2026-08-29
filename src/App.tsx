import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import PostView from './pages/PostView'
import TagView from './pages/TagView'

// 글을 읽기만 하는 방문자에게는 에디터·처리방침 코드를 내려보내지 않는다.
const Privacy = lazy(() => import('./pages/Privacy'))
const Admin = lazy(() => import('./pages/Admin'))
const Editor = lazy(() => import('./pages/Editor'))
const RequireAdmin = lazy(() => import('./components/RequireAdmin'))

const Loading = <p className="text-sm text-[var(--color-muted)]">불러오는 중…</p>

const guarded = (el: React.ReactNode) => (
  <Suspense fallback={Loading}>
    <RequireAdmin>{el}</RequireAdmin>
  </Suspense>
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="posts/:id" element={<PostView />} />
          <Route path="tags/:tag" element={<TagView />} />
          <Route path="privacy" element={<Suspense fallback={Loading}><Privacy /></Suspense>} />
          <Route path="admin" element={guarded(<Admin />)} />
          <Route path="admin/new" element={guarded(<Editor />)} />
          <Route path="admin/edit/:id" element={guarded(<Editor />)} />
          <Route
            path="*"
            element={<p className="text-sm text-[var(--color-muted)]">페이지를 찾을 수 없습니다.</p>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
