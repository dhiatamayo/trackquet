import axios from 'axios'
import type {
  Racquet,
  Session,
  StringPreset,
  StringRecord,
  CreateRacquetPayload,
  CreateSessionPayload,
  RestringPayload,
} from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
})

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

// --- String Records ---
export const fetchStringRecords = (racquetId: number): Promise<StringRecord[]> =>
  api.get<StringRecord[]>(`/racquets/${racquetId}/string-records`).then((r) => r.data)

// --- String Presets ---
export const fetchStringPresets = (): Promise<StringPreset[]> =>
  api.get<StringPreset[]>('/string-presets').then((r) => r.data)
