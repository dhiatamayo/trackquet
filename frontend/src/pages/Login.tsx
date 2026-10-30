import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleDot } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { loginUser } from '../api/client'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { token, user } = await loginUser({ username, password })
      login(token, user)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      console.error('[Login] error:', err)
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string }
      const msg =
        axiosErr?.response?.data?.error ??
        (axiosErr?.message?.includes('Network') ? 'Cannot reach server — check your connection' : axiosErr?.message) ??
        'Login failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-card bg-court-600 text-white shadow-lift">
            <CircleDot className="h-7 w-7" strokeWidth={2.5} />
          </span>
          <h1 className="text-h1 text-ink-900 mt-4">Trackquet</h1>
          <p className="text-caption text-ink-500 mt-1">Racquet Usage Tracker</p>
        </div>

        <div className="card p-8">
          <h2 className="text-h2 text-ink-900 mb-6">Sign in</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="your_username"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-caption text-ink-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-court-600 font-semibold hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
