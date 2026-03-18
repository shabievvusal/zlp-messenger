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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-2 text-primary-600">ZLP Messenger</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8 text-sm">Create your account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Username *', key: 'username', type: 'text', placeholder: 'john_doe', required: true },
            { label: 'First Name *', key: 'first_name', type: 'text', placeholder: 'John', required: true },
            { label: 'Last Name', key: 'last_name', type: 'text', placeholder: 'Doe', required: false },
            { label: 'Email', key: 'email', type: 'email', placeholder: 'john@example.com', required: false },
            { label: 'Password *', key: 'password', type: 'password', placeholder: '••••••••', required: true },
            { label: 'Confirm Password *', key: 'confirm', type: 'password', placeholder: '••••••••', required: true },
          ].map(({ label, key, type, placeholder, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label}
              </label>
              <input
                type={type}
                required={required}
                value={form[key as keyof typeof form]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700
              text-white font-semibold rounded-lg transition
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:underline font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
