import axios from 'axios'
import type {
  Racquet,
  Session,
  StringPreset,
  StringRecord,
  User,
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  CreateRacquetPayload,
  CreateSessionPayload,
  UpdateSessionPayload,
  RestringPayload,
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

// --- Auth ---
export const loginUser = (payload: LoginPayload): Promise<AuthResponse> =>
  api.post<AuthResponse>('/auth/login', payload).then((r) => r.data)

export const registerUser = (payload: RegisterPayload): Promise<AuthResponse> =>
  api.post<AuthResponse>('/auth/register', payload).then((r) => r.data)

export const fetchMe = (): Promise<User> =>
  api.get<User>('/auth/me').then((r) => r.data)

// --- Racquets ---
export const fetchRacquets = (): Promise<Racquet[]> =>
  api.get<Racquet[]>('/racquets').then((r) => r.data)

export const fetchRacquet = (id: number): Promise<Racquet> =>
  api.get<Racquet>(`/racquets/${id}`).then((r) => r.data)

export const createRacquet = (payload: CreateRacquetPayload): Promise<Racquet> =>
  api.post<Racquet>('/racquets', payload).then((r) => r.data)

export const updateRacquet = (
  id: number,
  payload: Partial<CreateRacquetPayload>
): Promise<Racquet> =>
  api.put<Racquet>(`/racquets/${id}`, payload).then((r) => r.data)

export const deleteRacquet = (id: number): Promise<void> =>
  api.delete(`/racquets/${id}`).then(() => undefined)

export const restringRacquet = (id: number, payload?: RestringPayload): Promise<Racquet> =>
  api.post<Racquet>(`/racquets/${id}/restring`, payload ?? {}).then((r) => r.data)

// --- Sessions ---
export const fetchSessions = (racquetId: number): Promise<Session[]> =>
  api.get<Session[]>(`/racquets/${racquetId}/sessions`).then((r) => r.data)

export const createSession = (
  racquetId: number,
  payload: CreateSessionPayload
): Promise<Session> =>
  api.post<Session>(`/racquets/${racquetId}/sessions`, payload).then((r) => r.data)

export const deleteSession = (racquetId: number, sessionId: number): Promise<void> =>
  api.delete(`/racquets/${racquetId}/sessions/${sessionId}`).then(() => undefined)

export const getSession = (racquetId: number, sessionId: number): Promise<Session> =>
  api.get<Session>(`/racquets/${racquetId}/sessions/${sessionId}`).then((r) => r.data)

export const updateSession = (
  racquetId: number,
  sessionId: number,
  payload: UpdateSessionPayload
): Promise<Session> =>
  api.put<Session>(`/racquets/${racquetId}/sessions/${sessionId}`, payload).then((r) => r.data)

// --- String Records ---
export const fetchStringRecords = (racquetId: number): Promise<StringRecord[]> =>
  api.get<StringRecord[]>(`/racquets/${racquetId}/string-records`).then((r) => r.data)

// --- String Presets ---
export const fetchStringPresets = (): Promise<StringPreset[]> =>
  api.get<StringPreset[]>('/string-presets').then((r) => r.data)
