import { useState } from 'react'
import { supabase } from './supabase'
import { BasketballIcon } from './Icons'

const BC = "'Barlow Condensed', sans-serif"
const B = "'Barlow', sans-serif"

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      onLogin(data.session)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg,#070b12 0%,#0d1525 60%,#070b12 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 380
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: 'linear-gradient(135deg,#f97316,#ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', margin: '0 auto 16px'
          }}><BasketballIcon size={28}/></div>
          <div style={{ fontFamily: BC, fontWeight: 900, fontSize: 22, letterSpacing: 2, color: '#f1f5f9' }}>ADMIN PORTAL</div>
          <div style={{ fontFamily: BC, fontSize: 10, letterSpacing: 3, color: '#475569', marginTop: 4, textTransform: 'uppercase' }}>GVO Sim League · Front Office</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontFamily: BC, fontSize: 10, letterSpacing: 2, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: 14,
                fontFamily: B, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ fontFamily: BC, fontSize: 10, letterSpacing: 2, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: 14,
                fontFamily: B, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, fontFamily: B }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            background: 'linear-gradient(135deg,#f97316,#ef4444)', border: 'none',
            borderRadius: 9, padding: '12px', color: '#fff',
            fontFamily: BC, fontWeight: 900, fontSize: 14, letterSpacing: 2,
            textTransform: 'uppercase', cursor: loading ? 'wait' : 'pointer', marginTop: 4,
            opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => window.history.back()}
          style={{
            width: '100%', marginTop: 16, background: 'none', border: 'none',
            color: '#334155', fontFamily: BC, fontSize: 11, letterSpacing: 2,
            textTransform: 'uppercase', cursor: 'pointer', padding: '8px'
          }}>
          ← Back to League
        </button>
      </div>
    </div>
  )
}
