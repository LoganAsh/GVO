import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import AdminLogin from './AdminLogin'
import AdminPortal from './AdminPortal'
import LeagueApp from './LeagueApp'

export default function App() {
  const [session, setSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const path = window.location.pathname

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (!authChecked) return (
    <div style={{ minHeight: '100vh', background: '#070b12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#334155', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' }}>Loading…</div>
    </div>
  )

  if (path === '/admin/login') {
    if (session) { window.location.href = '/admin'; return null }
    return <AdminLogin onLogin={setSession} />
  }

  if (path.startsWith('/admin')) {
    if (!session) { window.location.href = '/admin/login'; return null }
    return <AdminPortal session={session} onLogout={handleLogout} />
  }

  return <LeagueApp />
}
