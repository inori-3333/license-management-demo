import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Upload,
  BookOpenCheck,
  BellRing,
  ChartNoAxesCombined,
  UserRoundSearch,
  Settings,
  CalendarDays,
  CircleHelp,
  Menu,
  Rows3,
  Play,
} from 'lucide-react'
import { useStore } from './store'
import { Modal } from './ui'
import BrandMark from './components/BrandMark'
import AutoDemo from './demo/AutoDemo'
import Dashboard from './pages/Dashboard'
import People from './pages/People'
import Data from './pages/Data'
import Rules from './pages/Rules'
import Issues from './pages/Issues'
import Reports from './pages/Reports'
import Talent from './pages/Talent'
import SettingsPage from './pages/Settings'
const navigation = [
  { path: '/', label: '管理总览', icon: LayoutDashboard },
  { path: '/people', label: '人岗证台账', icon: Users },
  { path: '/data', label: '数据导入与归并', icon: Upload },
  { path: '/rules', label: '证书与规则', icon: BookOpenCheck },
  { path: '/issues', label: '预警与整改', icon: BellRing },
  { path: '/reports', label: '统计报表', icon: ChartNoAxesCombined },
  { path: '/talent', label: '人才画像', icon: UserRoundSearch },
]
export default function App() {
  const { db, result, update, demoActive, beginDemo, endDemo } = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  useLayoutEffect(() => {
    // 人员页单独管理详情返回的位置；其他一级页面从页首进入。
    if (!location.pathname.startsWith('/people')) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])
  const [demoRun, setDemoRun] = useState(0)
  const [demoFinished, setDemoFinished] = useState(false)
  const returnTo = useRef({
    path: '/',
    top: 0,
    density: 'comfortable' as 'comfortable' | 'compact',
  })
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    try {
      return localStorage.getItem('license-management.ui-density') === 'compact'
        ? 'compact'
        : 'comfortable'
    } catch {
      return 'comfortable'
    }
  })
  useEffect(() => {
    try {
      if (!demoActive) localStorage.setItem('license-management.ui-density', density)
    } catch {
      /* 当前会话仍保留显示偏好。 */
    }
  }, [density, demoActive])
  const currentPage = demoFinished
    ? '全流程回顾'
    : navigation.find((n) =>
        n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path),
      )?.label || '演示设置'
  const warnings = result.findings.filter((i) => i.severity === 'danger').length
  return (
    <div className="app" data-density={density}>
      <div className="mobile-appbar">
        <Link to="/" className="mobile-brand">
          <BrandMark />
          持证上岗
        </Link>
        <button
          className="button secondary"
          aria-label="打开导航菜单"
          aria-haspopup="dialog"
          aria-expanded={navigationOpen}
          onClick={() => setNavigationOpen(true)}
        >
          <Menu size={18} />
          导航
        </button>
      </div>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        跳转到主要内容
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="持证上岗首页">
          <BrandMark />
          <span>
            <strong>持证上岗</strong>
            <small>统计分析系统</small>
          </span>
        </Link>
        <div className="nav-caption">工作空间</div>
        <nav aria-label="主导航">
          {navigation.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              aria-label={n.label}
              title={n.label}
              end={n.path === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.path === '/issues' && warnings > 0 && (
                <small className="nav-count">{warnings}</small>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/settings" aria-label="演示设置">
            <Settings size={18} />
            <span>演示设置</span>
          </NavLink>
          <div className="local-note">
            <span className="live-dot" />
            <div>启航华电 15 组</div>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="workspace-name">
            员工持证管理 <span>/</span> {currentPage}
          </div>
          <button
            className="button secondary collapsed-nav-trigger"
            aria-label="打开导航菜单"
            aria-haspopup="dialog"
            aria-expanded={navigationOpen}
            onClick={() => setNavigationOpen(true)}
          >
            <Menu size={17} />
            导航
          </button>
          <div className="topbar-actions">
            <button
              className="button primary auto-demo-trigger"
              disabled={demoActive}
              onClick={() => {
                returnTo.current = {
                  path: location.pathname + location.search,
                  top: window.scrollY,
                  density,
                }
                setDemoFinished(false)
                setDensity('comfortable')
                beginDemo()
                setDemoRun((n) => n + 1)
              }}
            >
              <Play size={16} />{' '}
              {demoFinished ? '全流程回顾' : demoActive ? '演示进行中' : '自动演示'}
            </button>
            <button
              className="button secondary density-toggle"
              aria-pressed={density === 'compact'}
              onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
            >
              <Rows3 size={16} />
              紧凑表格
            </button>
            <label className="asof">
              <CalendarDays size={16} />
              <span>统计日期</span>
              <input
                aria-label="统计日期"
                type="date"
                value={db.asOf}
                onChange={(e) => {
                  if (e.target.value)
                    update(
                      (d) => ({ ...d, asOf: e.target.value }),
                      '统计日期已更新，使用当前数据推演',
                    )
                }}
              />
            </label>
            <Link to="/settings" className="icon-button" aria-label="使用说明">
              <CircleHelp size={19} />
            </Link>
            <div className="user-avatar" title="单管理员演示">
              管
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {!demoFinished && (
            <Routes key={demoActive ? 'demo-' + demoRun : 'work'}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/people" element={<People />} />
              <Route path="/people/:id" element={<People />} />
              <Route path="/data" element={<Data />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/issues" element={<Issues />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/talent" element={<Talent />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="*"
                element={
                  <div className="panel">
                    <h1>页面不存在</h1>
                    <Link to="/">返回管理总览</Link>
                  </div>
                }
              />
            </Routes>
          )}
          {demoActive && (
            <AutoDemo
              key={demoRun}
              onComplete={() => setDemoFinished(true)}
              onClose={() => {
                setDemoFinished(false)
                endDemo()
                setDensity(returnTo.current.density)
                setNavigationOpen(false)
                navigate(returnTo.current.path, { replace: true })
                requestAnimationFrame(() => {
                  window.scrollTo({ top: returnTo.current.top, behavior: 'instant' })
                  document
                    .querySelector<HTMLButtonElement>('.auto-demo-trigger')
                    ?.focus({ preventScroll: true })
                })
              }}
              onRestart={() => {
                setDemoFinished(false)
                beginDemo()
                setNavigationOpen(false)
                setDemoRun((n) => n + 1)
              }}
            />
          )}

          <footer className="footer">
            <span>持证上岗统计分析系统</span>
          </footer>
        </main>
      </div>
      {navigationOpen && (
        <Modal title="工作空间导航" onClose={() => setNavigationOpen(false)}>
          <nav className="expanded-navigation" aria-label="完整导航">
            {[...navigation, { path: '/settings', label: '演示设置', icon: Settings }].map((n) => (
              <NavLink
                key={n.path}
                to={n.path}
                end={n.path === '/'}
                onClick={() => setNavigationOpen(false)}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <n.icon size={21} />
                <span>{n.label}</span>
                {n.path === '/issues' && warnings > 0 && (
                  <span className="nav-count">{warnings}</span>
                )}
              </NavLink>
            ))}
          </nav>
        </Modal>
      )}
    </div>
  )
}
