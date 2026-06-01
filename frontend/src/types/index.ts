export type SessionType = 'match' | 'training'

export interface User {
  id: number
  name: string
  username: string
  email: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterPayload {
  name: string
  username: string
  email: string
  password: string
}

export interface StringPreset {
  id: number
  name: string
  brand: string
  threshold_hours: number
}

export interface StringRecord {
  id: number
  created_at: string
  racquet_id: number
  string_name: string
  gauge: string
  cross_string_name?: string
  cross_gauge?: string
  main_tension: number
  cross_tension: number
  threshold_hours: number
  started_at: string
  ended_at: string | null  // null = currently active
  total_minutes: number
  sessions?: Session[]
}

export interface Racquet {
  id: number
  created_at: string
  updated_at: string
  name: string
  brand: string
  year: number
  head_size: number
  weight: number
  string_name: string
  gauge: string
  cross_string_name?: string
  cross_gauge?: string
  main_tension: number
  cross_tension: number
  threshold_hours: number
  total_minutes: number
  // computed from backend
  total_hours: number
  lifetime_hours: number
  needs_restring: boolean
  restring_suggestion: string
  usage_percent: number
  win_ratio: number
  total_matches: number
  win_matches: number
  sessions?: Session[]
}

export interface Session {
  id: number
  created_at: string
  racquet_id: number
  string_record_id: number
  date: string
  duration_min: number
  type: SessionType
  name: string
  notes: string
  // Match-specific
  match_result?: 'win' | 'loss' | ''
  match_score?: string
  opponent_racquet?: string
}

export interface CreateRacquetPayload {
  name: string
  brand?: string
  year?: number
  head_size?: number
  weight?: number
  string_name?: string
  gauge?: string
  cross_string_name?: string
  cross_gauge?: string
  main_tension?: number
  cross_tension?: number
  threshold_hours?: number
}

export interface CreateSessionPayload {
  date: string
  duration_min: number
  type: SessionType
  name?: string
  notes?: string
  string_record_id?: number
  match_result?: 'win' | 'loss' | ''
  match_score?: string
  opponent_racquet?: string
}

export interface UpdateSessionPayload {
  notes?: string
  match_result?: 'win' | 'loss' | ''
  match_score?: string
  opponent_racquet?: string
}

export interface RestringPayload {
  string_name?: string
  gauge?: string
  cross_string_name?: string
  cross_gauge?: string
  main_tension?: number
  cross_tension?: number
  threshold_hours?: number
}

// --- Monthly Report ---

export interface RacquetUsageStat {
  racquet_id: number
  racquet_name: string
  sessions: number
  total_min: number
  wins: number
  losses: number
}

export interface NotableSession {
  session_id: number
  racquet_name: string
  date: string
  name: string
  duration_min: number
  type: string
  match_result: string
  match_score: string
  opponent_racquet: string
  notable_tag: string
}

export interface MonthlyReport {
  month: string
  year: number
  month_num: number
  total_sessions: number
  total_minutes: number
  avg_min_per_session: number
  win_rate: number
  total_wins: number
  total_matches: number
  racquet_usage: RacquetUsageStat[]
  notable_results: NotableSession[]
}
