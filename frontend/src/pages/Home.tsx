import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Trackquet</h1>
        <p className="text-gray-500 mt-2">What would you like to do?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* My Racquets Card */}
        <Link
          to="/dashboard"
          className="card p-6 hover:shadow-md hover:border-court-200 transition-all group"
        >
          <div className="text-4xl mb-4">🎾</div>
          <h2 className="text-xl font-bold text-gray-900 group-hover:text-court-600 transition-colors">
            My Racquets
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Track string usage, log sessions, and manage your racquet collection.
          </p>
          <div className="mt-4 text-sm font-medium text-court-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
            Go to Racquets <span aria-hidden="true">→</span>
          </div>
        </Link>

        {/* My Matches Card */}
        <Link
          to="/matches"
          className="card p-6 hover:shadow-md hover:border-court-200 transition-all group"
        >
          <div className="text-4xl mb-4">🏆</div>
          <h2 className="text-xl font-bold text-gray-900 group-hover:text-court-600 transition-colors">
            My Matches
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Create match sessions, manage players, and track scores and standings.
          </p>
          <div className="mt-4 text-sm font-medium text-court-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
            Go to Matches <span aria-hidden="true">→</span>
          </div>
        </Link>
      </div>
    </div>
  )
}
