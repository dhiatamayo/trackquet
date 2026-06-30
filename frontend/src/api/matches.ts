import axios from 'axios'
import type {
  MatchSession,
  Matchup,
  LeaderboardEntry,
  SportType,
  MatchmakingFormat,
  MatchType,
  WinConditionType,
  Gender,
} from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// --- Payload Types ---

export interface CreateMatchSessionPayload {
  name: string
  date: string
  sport_type: SportType
  match_type: MatchType
  format: MatchmakingFormat
  win_condition_type: WinConditionType
  win_condition_value: number
  num_courts: number
  fixed_partners: boolean
  players: { name: string; gender?: Gender; pair_index?: number }[]
}

export interface UpdateMatchSessionPayload {
  name?: string
  date?: string
  sport_type?: SportType
  match_type?: MatchType
  format?: MatchmakingFormat
  win_condition_type?: WinConditionType
  win_condition_value?: number
  fixed_partners?: boolean
}

export interface UpdateMatchupPayload {
  score_side_a?: number | null
  score_side_b?: number | null
  court_number?: number | null
  notes?: string
}

// --- Match Sessions ---

export const listMatchSessions = (): Promise<MatchSession[]> =>
  api.get<MatchSession[]>('/matches').then((r) => r.data)

export const createMatchSession = (payload: CreateMatchSessionPayload): Promise<MatchSession> =>
  api.post<MatchSession>('/matches', payload).then((r) => r.data)

export const getMatchSession = (id: number): Promise<MatchSession> =>
  api.get<MatchSession>(`/matches/${id}`).then((r) => r.data)

export const updateMatchSession = (
  id: number,
  payload: UpdateMatchSessionPayload
): Promise<MatchSession> =>
  api.put<MatchSession>(`/matches/${id}`, payload).then((r) => r.data)

export const deleteMatchSession = (id: number): Promise<void> =>
  api.delete(`/matches/${id}`).then(() => undefined)

// --- Add Player ---

export const addPlayerToSession = (
  sessionId: number,
  payload: { name: string; gender?: string }
): Promise<MatchSession> =>
  api.post<MatchSession>(`/matches/${sessionId}/players`, payload).then((r) => r.data)

// --- Session Timing ---

export const startMatch = (id: number): Promise<MatchSession> =>
  api.post<MatchSession>(`/matches/${id}/start`).then((r) => r.data)

export const finishMatch = (id: number): Promise<MatchSession> =>
  api.post<MatchSession>(`/matches/${id}/finish`).then((r) => r.data)

// --- Matchups ---

export const listMatchups = (sessionId: number): Promise<Matchup[]> =>
  api.get<Matchup[]>(`/matches/${sessionId}/matchups`).then((r) => r.data)

export const getMatchup = (sessionId: number, matchupId: number): Promise<Matchup> =>
  api.get<Matchup>(`/matches/${sessionId}/matchups/${matchupId}`).then((r) => r.data)

export const updateMatchup = (
  sessionId: number,
  matchupId: number,
  payload: UpdateMatchupPayload
): Promise<Matchup> =>
  api.put<Matchup>(`/matches/${sessionId}/matchups/${matchupId}`, payload).then((r) => r.data)

// --- Matchup Timing ---

export const startMatchup = (sessionId: number, matchupId: number): Promise<Matchup> =>
  api.post<Matchup>(`/matches/${sessionId}/matchups/${matchupId}/start`).then((r) => r.data)

export const finishMatchup = (sessionId: number, matchupId: number): Promise<Matchup> =>
  api.post<Matchup>(`/matches/${sessionId}/matchups/${matchupId}/finish`).then((r) => r.data)

// --- Leaderboard ---

export const getLeaderboard = (sessionId: number): Promise<LeaderboardEntry[]> =>
  api.get<LeaderboardEntry[]>(`/matches/${sessionId}/leaderboard`).then((r) => r.data)
