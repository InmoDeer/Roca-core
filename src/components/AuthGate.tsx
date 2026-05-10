'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function AuthGate({ children }: { children: (user: User) => React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async () => {
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 32, width: 320 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600 }}>ROCA CRM</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
          type="email"
        />
        <input
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={inputStyle}
          type="password"
        />
        {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
        <button onClick={handleLogin} style={btnStyle}>Ingresar</button>
      </div>
    </div>
  )

  return <>{children(user)}</>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 14,
  border: '1px solid #e2e8f0', borderRadius: 6,
  marginBottom: 10, boxSizing: 'border-box',
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: '10px 0', background: '#0f172a',
  color: '#fff', border: 'none', borderRadius: 6,
  fontSize: 14, cursor: 'pointer', fontWeight: 500,
}