'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'

const LockIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/students')
  }

  return (
    <div className="min-h-screen w-full flex bg-white p-3">
      <div className="flex w-full rounded-2xl overflow-hidden">

        {/* Left — photo */}
        <div className="hidden lg:block lg:w-1/2 relative">
          <Image
            src="/hero1.png"
            alt="Rising Dragon Taekwondo"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />

          {/* Top-left badge */}
          <div className="absolute top-6 left-6 flex items-center gap-2 bg-white/95 rounded-full pl-1.5 pr-4 py-1.5">
            <div className="relative w-7 h-7 rounded-full overflow-hidden bg-white shrink-0">
              <Image src="/logo.png" alt="" fill className="object-contain" />
            </div>
            <span className="text-[13px] font-semibold text-black">Rising Dragon</span>
          </div>

          {/* Bottom-left headline */}
          <div className="absolute bottom-8 left-8 right-8 text-white">
            <h2 className="text-[26px] font-bold leading-snug mb-1.5">
              Every branch, one system.
            </h2>
            <p className="text-[14px] text-gray-200">
              Scheduling, attendance, and payments in one place.
            </p>
          </div>
        </div>

        {/* Right — form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-8 sm:px-16">
          <div className="w-full max-w-[360px]">

            <h1 className="text-[26px] font-bold text-black tracking-tight mb-1.5">
              Welcome back
            </h1>
            <p className="text-[14px] text-gray-500 mb-9">
              Sign in to manage your branch.
            </p>

            <form onSubmit={handleLogin} className="flex flex-col gap-5">

              <div>
                <label className="text-[13px] font-medium text-gray-600 mb-1.5 block">
                  Your Email
                </label>
                <input
                  type="email"
                  placeholder="you@risingdragon.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg text-[14px] text-black placeholder:text-gray-400 outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-medium text-gray-600">
                    Password
                  </label>
                  <button
                    type="button"
                    title="Coming soon"
                    className="text-[12px] font-medium text-gray-400 cursor-not-allowed"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full h-11 pl-4 pr-11 border border-gray-200 rounded-lg text-[14px] text-black placeholder:text-gray-400 outline-none focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                  >
                    <LockIcon />
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-[13px] text-red-600 flex items-center gap-1.5 -mt-1">
                  <span className="w-1 h-1 rounded-full bg-red-600 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full bg-black hover:bg-red-600 disabled:opacity-60 text-white text-[14px] font-semibold rounded-lg transition-colors duration-150 cursor-pointer"
              >
                {loading ? 'Signing in…' : 'Log In'}
              </button>
            </form>

            <p className="text-center text-[12px] text-gray-400 mt-10">
              © {new Date().getFullYear()} Rising Dragon Taekwondo
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}