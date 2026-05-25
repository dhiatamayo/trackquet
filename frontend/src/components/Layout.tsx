import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  const location = useLocation()
  const isHome = location.pathname === '/'

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
