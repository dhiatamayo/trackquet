import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { listMatchSessions } from '../api/matches'
import CreateMatchModal from '../components/CreateMatchModal'
import type { MatchSession } from '../types'

export default function MatchList() {
  const [sessions, setSessions] = useState<MatchSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    listMatchSessions()
      .then((data) => {
        // Sort by date descending
        const sorted = [...data].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setSessions(sorted)
      })
      .catch(() => toast.error('Failed to load match sessions'))
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatLabel = (format: string) =>
    format
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Matches</h1>
          <p className="text-sm text-gray-500 mt-1">Organize and track your match sessions</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Match Session
        </button>
      </div>

      {/* Create Match Modal */}
      <CreateMatchModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(session) => {
          setShowCreateModal(false)
          navigate(`/matches/${session.id}`)
        }}
      />

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🏸</p>
          <p className="text-gray-500 text-lg">No match sessions yet.</p>
          <p className="text-gray-400 text-sm mt-1">Create your first one!</p>
          <button className="btn-primary mt-6" onClick={() => setShowCreateModal(true)}>
            + Create Match Session
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/matches/${session.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/matches/${session.id}`)
                }
              }}
            >
              <h3 className="text-lg font-semibold text-gray-900 truncate">{session.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{formatDate(session.date)}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {session.sport_type === 'tennis' ? '🎾 Tennis' : '🏸 Padel'}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {formatLabel(session.format)}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {session.match_type === 'singles' ? 'Singles' : 'Doubles'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
