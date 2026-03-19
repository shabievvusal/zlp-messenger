import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import toast from 'react-hot-toast'

export function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm: '',
  })

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const { data } = await authApi.register({
        username: form.username,
        first_name: form.first_name,
        last_name: form.last_name || undefined,
        email: form.email || undefined,
        password: form.password,
      })
      setAuth(data.user, data.access_token)
      navigate('/')
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Registration failed'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-auto
      bg-gradient-to-br from-primary-50 via-white to-primary-100/50
      dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">

      {/* Background blobs */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px]
        rounded-full bg-primary-400/20 dark:bg-primary-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px]
        rounded-full bg-primary-300/20 dark:bg-primary-600/10 blur-3xl pointer-events-none" />

      {/* Card */}
      <div className="relative w-full max-w-sm mx-4 my-8 animate-scaleIn py-8">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl
          rounded-3xl shadow-2xl shadow-black/10
          border border-white dark:border-white/10
          p-8">

          {/* Logo */}
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-primary-500
              flex items-center justify-center
              shadow-lg shadow-primary-500/30">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863
                    9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3
                    12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100
            tracking-tight">
            Create Account
          </h1>
          <p className="text-center text-gray-500 dark:text-gray-400 mt-1 mb-6 text-sm">
            Join ZLP Messenger
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {[
              { label: 'Username', key: 'username', type: 'text', placeholder: 'john_doe', required: true, auto: 'username' },
              { label: 'First Name', key: 'first_name', type: 'text', placeholder: 'John', required: true, auto: 'given-name' },
              { label: 'Last Name', key: 'last_name', type: 'text', placeholder: 'Doe', required: false, auto: 'family-name' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'john@example.com', required: false, auto: 'email' },
              { label: 'Password', key: 'password', type: 'password', placeholder: '••••••••', required: true, auto: 'new-password' },
              { label: 'Confirm Password', key: 'confirm', type: 'password', placeholder: '••••••••', required: true, auto: 'new-password' },
            ].map(({ label, key, type, placeholder, required, auto }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {label} {required && <span className="text-red-400 text-xs">*</span>}
                </label>
                <input
                  type={type}
                  required={required}
                  autoComplete={auto}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={placeholder}
                  className="input-base"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 mt-1
                bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                text-white font-semibold rounded-xl
                transition-all duration-150 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-md shadow-primary-500/25"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner" /> Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
            Already have an account?{' '}
            <Link to="/login"
              className="text-primary-500 hover:text-primary-600 font-semibold
                transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
