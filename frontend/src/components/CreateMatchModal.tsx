import { useState } from 'react'
import toast from 'react-hot-toast'
import PlayerInput, { type PlayerEntry } from './PlayerInput'
import { createMatchSession } from '../api/matches'
import type {
  MatchSession,
  SportType,
  MatchType,
  MatchmakingFormat,
  WinConditionType,
} from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: (session: MatchSession) => void
}

interface FormErrors {
  name?: string
  date?: string
  sport_type?: string
  match_type?: string
  format?: string
  win_condition?: string
  players?: string
}

const FORMAT_OPTIONS: { value: MatchmakingFormat; label: string }[] = [
  { value: 'americano', label: 'Americano' },
  { value: 'mexicano', label: 'Mexicano' },
  { value: 'team_americano', label: 'Team Americano' },
  { value: 'mixed_americano', label: 'Mixed Americano' },
  { value: 'team_mexicano', label: 'Team Mexicano' },
  { value: 'super_mexicano', label: 'Super Mexicano' },
]

const SETS_OPTIONS = [
  { value: 2, label: 'Race to 2 (Best of 3)' },
  { value: 3, label: 'Race to 3 (Best of 5)' },
  { value: 4, label: 'Race to 4 (Best of 7)' },
  { value: 5, label: 'Race to 5 (Best of 9)' },
]

const POINTS_OPTIONS = [
  { value: 16, label: 'Play to 16 points' },
  { value: 21, label: 'Play to 21 points' },
  { value: 32, label: 'Play to 32 points' },
]

export default function CreateMatchModal({ isOpen, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [sportType, setSportType] = useState<SportType | ''>('')
  const [matchType, setMatchType] = useState<MatchType | ''>('')
  const [fixedPartners, setFixedPartners] = useState(false)
  const [format, setFormat] = useState<MatchmakingFormat | ''>('')
  const [numCourts, setNumCourts] = useState(1)
  const [winConditionType, setWinConditionType] = useState<WinConditionType | ''>('')
  const [winConditionValue, setWinConditionValue] = useState<number | ''>('')
  const [players, setPlayers] = useState<PlayerEntry[]>([
    { name: '' },
    { name: '' },
  ])
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const showFixedPartners = matchType === 'doubles'
  const showGender = format === 'mixed_americano'
  const showPairIndex = fixedPartners && matchType === 'doubles'

  // Reset win condition when sport type changes
  const handleSportTypeChange = (value: SportType) => {
    setSportType(value)
    // If switching to tennis and currently on points, clear win condition
    if (value === 'tennis' && winConditionType === 'points') {
      setWinConditionType('')
      setWinConditionValue('')
    }
  }

  // Reset fixed partners when match type changes
  const handleMatchTypeChange = (value: MatchType) => {
    setMatchType(value)
    if (value === 'singles') {
      setFixedPartners(false)
    }
  }

  const validate = (): FormErrors => {
    const errs: FormErrors = {}

    if (!name.trim()) {
      errs.name = 'Session name is required'
    } else if (name.trim().length > 100) {
      errs.name = 'Name must be 100 characters or less'
    }

    if (!date) {
      errs.date = 'Date is required'
    }

    if (!sportType) {
      errs.sport_type = 'Sport type is required'
    }

    if (!matchType) {
      errs.match_type = 'Match type is required'
    }

    if (!format) {
      errs.format = 'Format is required'
    }

    if (!winConditionType || !winConditionValue) {
      errs.win_condition = 'Win condition is required'
    }

    // Player validation
    const validPlayers = players.filter((p) => p.name.trim().length > 0)
    const minPlayers = matchType === 'doubles' ? 4 : 2
    if (validPlayers.length < minPlayers) {
      errs.players = `At least ${minPlayers} players are required for ${matchType || 'this'} match type`
    } else if (validPlayers.length > 32) {
      errs.players = 'Maximum 32 players allowed'
    } else if (
      matchType === 'doubles' &&
      validPlayers.length % 2 !== 0 &&
      (fixedPartners || format === 'team_americano' || format === 'team_mexicano')
    ) {
      errs.players = 'An even number of players is required for team/fixed-partner formats'
    }

    // Check for duplicate names
    const names = validPlayers.map((p) => p.name.trim().toLowerCase())
    const hasDuplicates = names.some((n, i) => names.indexOf(n) !== i)
    if (!errs.players && hasDuplicates) {
      errs.players = 'Player names must be unique'
    }

    // Check player name lengths
    const tooLong = validPlayers.find((p) => p.name.trim().length > 50)
    if (!errs.players && tooLong) {
      errs.players = 'Player names must be 50 characters or less'
    }

    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    try {
      const validPlayers = players
        .filter((p) => p.name.trim().length > 0)
        .map((p) => ({
          name: p.name.trim(),
          gender: showGender ? p.gender : undefined,
          pair_index: showPairIndex && p.pair_index ? p.pair_index : undefined,
        }))

      const session = await createMatchSession({
        name: name.trim(),
        date: date.includes('T') ? date : `${date}T00:00:00Z`,
        sport_type: sportType as SportType,
        match_type: matchType as MatchType,
        format: format as MatchmakingFormat,
        win_condition_type: winConditionType as WinConditionType,
        win_condition_value: winConditionValue as number,
        num_courts: numCourts,
        fixed_partners: fixedPartners,
        players: validPlayers,
      })

      onCreated(session)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } }
        toast.error(axiosErr.response?.data?.error || 'Failed to create match session')
      } else {
        toast.error('Connection error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="card w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold">Create Match Session</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="label">Session Name *</label>
              <input
                className={`input ${errors.name ? 'border-red-400 focus:ring-red-300' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Friday Night Padel"
                maxLength={100}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Date */}
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                className={`input ${errors.date ? 'border-red-400 focus:ring-red-300' : ''}`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>

            {/* Sport Type */}
            <div>
              <label className="label">Sport Type *</label>
              <select
                className={`input ${errors.sport_type ? 'border-red-400 focus:ring-red-300' : ''}`}
                value={sportType}
                onChange={(e) => handleSportTypeChange(e.target.value as SportType)}
              >
                <option value="">Select sport type</option>
                <option value="tennis">Tennis</option>
                <option value="padel">Padel</option>
              </select>
              {errors.sport_type && (
                <p className="text-xs text-red-500 mt-1">{errors.sport_type}</p>
              )}
            </div>

            {/* Match Type */}
            <div>
              <label className="label">Match Type *</label>
              <select
                className={`input ${errors.match_type ? 'border-red-400 focus:ring-red-300' : ''}`}
                value={matchType}
                onChange={(e) => handleMatchTypeChange(e.target.value as MatchType)}
              >
                <option value="">Select match type</option>
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
              {errors.match_type && (
                <p className="text-xs text-red-500 mt-1">{errors.match_type}</p>
              )}
            </div>

            {/* Fixed Partners toggle - only for doubles */}
            {showFixedPartners && (
              <div className="flex items-center gap-3 py-1">
                <button
                  type="button"
                  onClick={() => setFixedPartners(!fixedPartners)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    fixedPartners ? 'bg-court-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      fixedPartners ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">Fixed Partners</span>
              </div>
            )}

            {/* Format */}
            <div>
              <label className="label">Format *</label>
              <select
                className={`input ${errors.format ? 'border-red-400 focus:ring-red-300' : ''}`}
                value={format}
                onChange={(e) => setFormat(e.target.value as MatchmakingFormat)}
              >
                <option value="">Select format</option>
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.format && <p className="text-xs text-red-500 mt-1">{errors.format}</p>}
            </div>

            {/* Number of Courts */}
            <div>
              <label className="label">Number of Courts</label>
              <input
                type="number"
                min="1"
                max="20"
                className="input w-24"
                value={numCourts}
                onChange={(e) => setNumCourts(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <p className="text-xs text-gray-500 mt-1">Courts are auto-assigned to matchups</p>
            </div>

            {/* Win Condition */}
            <div>
              <label className="label">Win Condition *</label>
              <div className="space-y-2">
                {/* Sets options - always available */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Sets</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SETS_OPTIONS.map((opt) => (
                      <button
                        key={`sets-${opt.value}`}
                        type="button"
                        onClick={() => {
                          setWinConditionType('sets')
                          setWinConditionValue(opt.value)
                        }}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          winConditionType === 'sets' && winConditionValue === opt.value
                            ? 'bg-court-600 text-white border-court-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Points options - only for Padel */}
                {sportType === 'padel' && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Points</p>
                    <div className="grid grid-cols-3 gap-2">
                      {POINTS_OPTIONS.map((opt) => (
                        <button
                          key={`points-${opt.value}`}
                          type="button"
                          onClick={() => {
                            setWinConditionType('points')
                            setWinConditionValue(opt.value)
                          }}
                          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            winConditionType === 'points' && winConditionValue === opt.value
                              ? 'bg-court-600 text-white border-court-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {errors.win_condition && (
                <p className="text-xs text-red-500 mt-1">{errors.win_condition}</p>
              )}
            </div>

            {/* Players */}
            <div>
              <PlayerInput
                players={players}
                onPlayersChange={setPlayers}
                showGender={showGender}
                showPairIndex={showPairIndex}
              />
              {errors.players && (
                <p className="text-xs text-red-500 mt-1">{errors.players}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Match Session'}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
