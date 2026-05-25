import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

interface Props {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isHome = location.pathname === '/'

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="bg-court-700 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🎾</span>
          <Link to="/" className="text-xl font-bold tracking-tight hover:opacity-90">
            Trackquet
          </Link>
          <span className="ml-2 text-court-200 text-sm hidden sm:inline">
            Tennis Racquet Usage Tracker
          </span>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="text-sm text-court-200 hidden sm:inline">
                Hi, <span className="text-white font-medium">{user.name}</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-xs bg-court-600 hover:bg-court-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Breadcrumb (only on sub-pages) */}
      {!isHome && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-2 text-sm text-gray-500">
            <Link to="/" className="hover:text-court-600">
              Home
            </Link>{' '}
            / <span className="text-gray-900">Racquet Detail</span>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">{children}</main>

      <footer className="text-center text-xs text-gray-400 py-4 border-t">
        Trackquet © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
