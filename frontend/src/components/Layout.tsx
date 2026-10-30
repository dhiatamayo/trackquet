import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { CircleDot, LogOut, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface Props {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isHome = location.pathname === '/'

  const getBreadcrumbLabel = (path: string): string => {
    if (path === '/dashboard') return 'My Racquets'
    if (path === '/matches') return 'My Matches'
    if (path.startsWith('/matches/')) return 'Match Session'
    if (path.startsWith('/racquets/')) return 'Racquet Detail'
    return 'Page'
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-ink-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-control bg-court-600 text-white shadow-sm">
              <CircleDot className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-h2 font-extrabold tracking-tight text-ink-900">
                Trackquet
              </span>
              <span className="text-[0.7rem] text-ink-400 hidden sm:block mt-0.5">
                Racquet Usage Tracker
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="text-caption text-ink-500 hidden sm:inline">
                Hi, <span className="text-ink-900 font-semibold">{user.name}</span>
              </span>
            )}
            <button onClick={handleLogout} className="btn-ghost">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Breadcrumb (only on sub-pages) */}
      {!isHome && (
        <div className="bg-white border-b border-ink-200">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-1.5 text-caption text-ink-500">
            <Link to="/" className="hover:text-court-600 transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-ink-300" />
            <span className="text-ink-900 font-medium">
              {getBreadcrumbLabel(location.pathname)}
            </span>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">{children}</main>

      <footer className="text-center text-caption text-ink-400 py-6 border-t border-ink-200">
        Trackquet © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
