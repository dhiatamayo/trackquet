import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleDot } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { registerUser } from '../api/client'
import toast from 'react-hot-toast'

export default function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { token, user } = await registerUser(form)
      login(token, user)
      toast.success(`Welcome, ${user.name}!`)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      console.error('[Register] error:', err)
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string }
      const msg =
        axiosErr?.response?.data?.error ??
        (axiosErr?.message?.includes('Network') ? 'Cannot reach server — check your connection' : axiosErr?.message) ??
        'Registration failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-card bg-court-600 text-white shadow-lift">
            <CircleDot className="h-7 w-7" strokeWidth={2.5} />
          </span>
          <h1 className="text-h1 text-ink-900 mt-4">Trackquet</h1>
          <p className="text-caption text-ink-500 mt-1">Racquet Usage Tracker</p>
        </div>

        <div className="card p-8">
          <h2 className="text-h2 text-ink-900 mb-6">Create account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Display name</label>
              <input type="text" value={form.name} onChange={set('name')} className="input" placeholder="Your Name" required autoFocus />
            </div>
            <div>
              <label className="label">Username</label>
              <input type="text" value={form.username} onChange={set('username')} className="input" placeholder="your_username" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={set('email')} className="input" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label">
                Password <span className="text-ink-400 font-normal">(min 6 chars)</span>
              </label>
              <input type="password" value={form.password} onChange={set('password')} className="input" placeholder="••••••" minLength={6} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-caption text-ink-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-court-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
