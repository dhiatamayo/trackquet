import { Link } from 'react-router-dom'
import { Target, Trophy, ArrowRight } from 'lucide-react'

export default function Home() {
  const tiles = [
    {
      to: '/dashboard',
      icon: Target,
      title: 'My Racquets',
      desc: 'Track string usage, log sessions, and manage your racquet collection.',
      cta: 'Go to Racquets',
    },
    {
      to: '/matches',
      icon: Trophy,
      title: 'My Matches',
      desc: 'Create match sessions, manage players, and track scores and standings.',
      cta: 'Go to Matches',
    },
  ]

  return (
    <div>
      <div className="mb-10 max-w-2xl mx-auto text-center">
        <h1 className="text-display text-ink-900">Your game, tracked.</h1>
        <p className="text-body text-ink-500 mt-3">
          Keep tabs on every racquet and match in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
        {tiles.map(({ to, icon: Icon, title, desc, cta }) => (
          <Link key={to} to={to} className="card-interactive group p-6 flex flex-col">
            <span className="flex h-12 w-12 items-center justify-center rounded-control bg-court-50 text-court-600 ring-1 ring-court-100 mb-5">
              <Icon className="h-6 w-6" strokeWidth={2} />
            </span>
            <h2 className="text-h2 text-ink-900 group-hover:text-court-700 transition-colors">
              {title}
            </h2>
            <p className="text-caption text-ink-500 mt-2 flex-1">{desc}</p>
            <div className="mt-5 inline-flex items-center gap-1.5 text-caption font-semibold text-court-600">
              {cta}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
