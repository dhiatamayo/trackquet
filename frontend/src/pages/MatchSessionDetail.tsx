import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getMatchSession,
  getLeaderboard,
  deleteMatchSession,
  addPlayerToSession,
} from '../api/matches'
import type { MatchSession, Matchup, LeaderboardEntry } from '../types'
import DrawSchedule from '../components/DrawSchedule'
import Leaderboard from '../components/Leaderboard'
import MatchupDetailModal from '../components/MatchupDetailModal'

export default function MatchSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<MatchSession | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [selectedMatchup, setSelectedMatchup] = useState<Matchup | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)

  const sessionId = Number(id)

  const loadSession = useCallback(() => {
    if (!id) return
    getMatchSession(sessionId)
      .then(setSession)
      .catch(() => toast.error('Failed to load match session'))
      .finally(() => setLoading(false))
  }, [id, sessionId])

  const loadLeaderboard = useCallback(() => {
    if (!id) return
    setLeaderboardLoading(true)
    getLeaderboard(sessionId)
      .then(setLeaderboard)
      .catch(() => toast.error('Failed to load leaderboard'))
      .finally(() => setLeaderboardLoading(false))
  }, [id, sessionId])

  useEffect(() => {
    loadSession()
    loadLeaderboard()
  }, [loadSession, loadLeaderboard])

  const handleMatchupClick = (matchup: Matchup) => {
    setSelectedMatchup(matchup)
  }

  const handleModalClose = () => {
    setSelectedMatchup(null)
    loadSession()
    loadLeaderboard()
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteMatchSession(sessionId)
      toast.success('Match session deleted')
      navigate('/matches')
    } catch {
      toast.error('Failed to delete session')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleAddPlayer = async () => {
    const name = newPlayerName.trim()
    if (!name) return
    setAddingPlayer(true)
    try {
      const updated = await addPlayerToSession(sessionId, { name })
      setSession(updated)
      setNewPlayerName('')
      loadLeaderboard()
      toast.success(`${name} added to the session`)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } }
        toast.error(axiosErr.response?.data?.error || 'Failed to add player')
      } else {
        toast.error('Failed to add player')
      }
    } finally {
      setAddingPlayer(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatLabel = (format: string) =>
    format
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Loading…</div>
  }

  if (!session) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">Match session not found.</p>
        <button className="btn-primary mt-4" onClick={() => navigate('/matches')}>
          Back to Matches
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate('/matches')}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1"
        >
          ← Back to Matches
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{session.name}</h1>
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
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            🗑 Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Draw Schedule</h2>
            <DrawSchedule
              matchups={session.matchups ?? []}
              players={session.players ?? []}
              onMatchupClick={handleMatchupClick}
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Add Player */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Add Player</h2>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Player name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPlayer()
                }}
                maxLength={50}
              />
              <button
                onClick={handleAddPlayer}
                disabled={addingPlayer || !newPlayerName.trim()}
                className="btn-primary text-sm shrink-0"
              >
                {addingPlayer ? '…' : '+ Add'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              New matchups will be generated and shuffled with unplayed ones.
            </p>
          </div>

          {/* Leaderboard */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Leaderboard</h2>
            <Leaderboard entries={leaderboard} loading={leaderboardLoading} sessionName={session.name} />
          </div>
        </div>
      </div>

      <MatchupDetailModal
        isOpen={selectedMatchup != null}
        onClose={handleModalClose}
        matchup={selectedMatchup}
        players={session.players ?? []}
        winConditionType={session.win_condition_type}
        winConditionValue={session.win_condition_value}
        matchType={session.match_type}
        sessionId={sessionId}
        numCourts={session.num_courts || 1}
        onUpdated={(updated) => {
          setSession((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              matchups: (prev.matchups ?? []).map((m) =>
                m.id === updated.id ? updated : m
              ),
            }
          })
          loadLeaderboard()
        }}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Match Session?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete "{session.name}" and all its matchups. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
