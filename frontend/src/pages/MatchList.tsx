import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trophy, Calendar, Users } from 'lucide-react'
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
        const sorted = [...data].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        setSessions(sorted)
      })
      .catch(() => toast.error('Failed to load match sessions'))
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

  const formatLabel = (format: string) =>
    format.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return (
    <div>
      {/* Page header */}
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-h1 text-ink-900">My Matches</h1>
          <p className="text-caption text-ink-500 mt-1">Organize and track your match sessions</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          Create Session
        </button>
      </div>

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
        <div className="text-center py-16 text-caption text-ink-400">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="card flex flex-col items-center text-center py-16 px-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-card bg-court-50 text-court-600 ring-1 ring-court-100 mb-4">
            <Trophy className="h-7 w-7" />
          </span>
          <p className="text-h2 text-ink-900">No match sessions yet</p>
          <p className="text-caption text-ink-500 mt-1">Create your first one to start tracking scores.</p>
          <button className="btn-primary mt-6" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            Create Session
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="card-interactive p-5 cursor-pointer"
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
              <h3 className="text-h2 text-ink-900 truncate">{session.name}</h3>
              <p className="flex items-center gap-1.5 text-caption text-ink-500 mt-1">
                <Calendar className="h-3.5 w-3.5 text-ink-400" />
                {formatDate(session.date)}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="chip-brand">
                  {session.sport_type === 'tennis' ? 'Tennis' : 'Padel'}
                </span>
                <span className="chip">{formatLabel(session.format)}</span>
                <span className="chip">
                  <Users className="h-3.5 w-3.5 text-ink-400" />
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
