import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { getTheme } from './theme'

const BC = "'Barlow Condensed', sans-serif"
const B  = "'Barlow', sans-serif"

const TEAM_CLR = {ATL:"#E03A3E",BOS:"#007A33",BKN:"#888",CHA:"#1D1160",CHI:"#CE1141",CLE:"#860038",DAL:"#00538C",DEN:"#0E2240",DET:"#C8102E",GSW:"#1D428A",HOU:"#CE1141",IND:"#002D62",LAC:"#C8102E",LAL:"#552583",MEM:"#5D76A9",MIA:"#98002E",MIL:"#00471B",MIN:"#0C2340",NOP:"#0C2340",NYK:"#006BB6",OKC:"#007AC1",ORL:"#0077C0",PHI:"#006BB6",PHX:"#1D1160",POR:"#E03A3E",SAC:"#5A2D81",SAS:"#666",TOR:"#CE1141",UTA:"#002B5C",WAS:"#002B5C"}

function fmtCountdown(ms) {
  if (ms == null || ms <= 0) return null
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86400)
  const hrs  = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return { days, hrs, mins, secs }
}

function fmtClock(seconds) {
  if (seconds == null || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function normalizeName(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\.?\b/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

const PROSPECTS_PER_PAGE = 25

export default function DraftPage({ theme = 'dark' }) {
  const t = getTheme(theme)
  const [picks, setPicks] = useState([])
  const [prospects, setProspects] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  const [prospectPage, setProspectPage] = useState(0)

  // tick every second so countdowns update
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [picksRes, settingsRes, prospectsRes] = await Promise.all([
        supabase.from('draft_2026').select('*').order('pick_number'),
        supabase.from('draft_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('prospects').select('*').order('rank'),
      ])
      if (cancelled) return
      setPicks(picksRes.data || [])
      setSettings(settingsRes.data || null)
      setProspects(prospectsRes.data || [])
      setLoading(false)
    }
    load()
    // light polling so the public page picks up admin changes within a few seconds
    const id = setInterval(load, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const draftAt = settings?.draft_at ? new Date(settings.draft_at).getTime() : null
  const countdown = useMemo(() => draftAt ? fmtCountdown(draftAt - now) : null, [draftAt, now])

  const onClockPick = useMemo(() => picks.find(p => !p.player_name || !p.player_name.trim()), [picks])

  const takenNames = useMemo(() => {
    const s = new Set()
    for (const p of picks) {
      if (p.player_name && p.player_name.trim()) s.add(normalizeName(p.player_name))
    }
    return s
  }, [picks])

  const availableProspects = useMemo(
    () => prospects.filter(p => !takenNames.has(p.normalized_name || normalizeName(p.name))),
    [prospects, takenNames]
  )

  const totalProspectPages = Math.max(1, Math.ceil(availableProspects.length / PROSPECTS_PER_PAGE))
  const currentProspectPage = Math.min(prospectPage, totalProspectPages - 1)
  const prospectStart = currentProspectPage * PROSPECTS_PER_PAGE
  const visibleProspects = availableProspects.slice(prospectStart, prospectStart + PROSPECTS_PER_PAGE)

  const clockRemaining = useMemo(() => {
    if (!settings?.clock_running || !settings?.clock_started_at) return null
    const elapsed = Math.floor((now - new Date(settings.clock_started_at).getTime()) / 1000)
    return Math.max(0, (settings.clock_seconds || 0) - elapsed)
  }, [settings, now])

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:t.tableTextSubtle, fontFamily:BC, letterSpacing:2, fontSize:12 }}>LOADING DRAFT…</div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Countdown to Draft */}
      <div style={{ background:t.tableBg, border:`1px solid ${t.border}`, borderRadius:12, padding:'18px 20px' }}>
        <div style={{ fontFamily:BC, fontSize:10, letterSpacing:3, color:t.tableTextSubtle, textTransform:'uppercase', marginBottom:10 }}>
          Countdown to Draft
        </div>
        {countdown ? (
          <div style={{ display:'flex', gap:18, flexWrap:'wrap' }}>
            {[['Days', countdown.days], ['Hours', countdown.hrs], ['Min', countdown.mins], ['Sec', countdown.secs]].map(([label, v]) => (
              <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:64 }}>
                <span style={{ fontFamily:BC, fontWeight:900, fontSize:34, color:t.tableText, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{String(v).padStart(2, '0')}</span>
                <span style={{ fontFamily:BC, fontSize:9, letterSpacing:2, color:t.tableTextSubtle, textTransform:'uppercase', marginTop:4 }}>{label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontFamily:BC, fontWeight:900, fontSize:24, color:'rgba(249,115,22,0.95)', letterSpacing:2 }}>DRAFT IS LIVE</div>
        )}
        {settings?.draft_at && (
          <div style={{ fontFamily:BC, fontSize:10, letterSpacing:2, color:t.tableTextSubtle, textTransform:'uppercase', marginTop:10 }}>
            {new Date(settings.draft_at).toLocaleString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short' })}
          </div>
        )}
      </div>

      {/* On The Clock */}
      <div style={{ background:t.tableBg, border:`1px solid ${t.border}`, borderRadius:12, padding:'18px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontFamily:BC, fontSize:10, letterSpacing:3, color:t.tableTextSubtle, textTransform:'uppercase', marginBottom:8 }}>On The Clock</div>
            {onClockPick ? (
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <div style={{ width:44, height:44, borderRadius:9, background:TEAM_CLR[onClockPick.owns_team] || '#475569', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:BC, fontWeight:900, fontSize:13, letterSpacing:1, flexShrink:0 }}>{onClockPick.owns_team}</div>
                <div>
                  <div style={{ fontFamily:BC, fontWeight:900, fontSize:22, color:t.tableText, letterSpacing:1, lineHeight:1 }}>PICK #{onClockPick.pick_number}</div>
                  <div style={{ fontFamily:BC, fontSize:11, letterSpacing:2, color:t.tableTextSubtle, textTransform:'uppercase', marginTop:4 }}>
                    {onClockPick.owns_team}{onClockPick.original_team && onClockPick.original_team !== onClockPick.owns_team ? ` · via ${onClockPick.original_team}` : ''}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontFamily:BC, fontWeight:800, fontSize:16, color:t.tableTextMuted, letterSpacing:1 }}>All picks submitted</div>
            )}
          </div>
          {clockRemaining != null && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:120, padding:'10px 18px', borderRadius:10, background:'rgba(249,115,22,0.12)', border:'1px solid rgba(249,115,22,0.4)' }}>
              <span style={{ fontFamily:BC, fontWeight:900, fontSize:32, color:'#f97316', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{fmtClock(clockRemaining)}</span>
              <span style={{ fontFamily:BC, fontSize:9, letterSpacing:2, color:t.tableTextSubtle, textTransform:'uppercase', marginTop:4 }}>Pick Clock</span>
            </div>
          )}
        </div>
      </div>

      {/* Best Available */}
      <div style={{ background:t.tableBg, border:`1px solid ${t.border}`, borderRadius:12, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:t.tableSectionBg, borderBottom:`1px solid ${t.tableLine}`, gap:8, flexWrap:'wrap' }}>
          <div style={{ fontFamily:BC, fontWeight:900, fontSize:11, letterSpacing:3, color:t.tableTextSubtle, textTransform:'uppercase' }}>
            Best Available · {availableProspects.length}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={()=>setProspectPage(p => Math.max(0, p-1))} disabled={currentProspectPage === 0}
              style={{ padding:'4px 12px', borderRadius:6, border:`1px solid ${t.border}`, background:'transparent', color: currentProspectPage === 0 ? t.tableTextVeryMuted : t.tableText, fontFamily:BC, fontSize:11, letterSpacing:1, cursor: currentProspectPage === 0 ? 'default' : 'pointer' }}>← Prev 25</button>
            <span style={{ fontFamily:BC, fontSize:11, color:t.tableTextSubtle, letterSpacing:1, fontVariantNumeric:'tabular-nums' }}>
              {availableProspects.length === 0 ? '0' : `${prospectStart+1}–${Math.min(prospectStart+PROSPECTS_PER_PAGE, availableProspects.length)} of ${availableProspects.length}`}
            </span>
            <button onClick={()=>setProspectPage(p => Math.min(totalProspectPages-1, p+1))} disabled={currentProspectPage >= totalProspectPages-1}
              style={{ padding:'4px 12px', borderRadius:6, border:`1px solid ${t.border}`, background:'transparent', color: currentProspectPage >= totalProspectPages-1 ? t.tableTextVeryMuted : t.tableText, fontFamily:BC, fontSize:11, letterSpacing:1, cursor: currentProspectPage >= totalProspectPages-1 ? 'default' : 'pointer' }}>Next 25 →</button>
          </div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${t.tableLine}`, background:t.tableHeaderBg }}>
                {[
                  ['Rank', 'center'],
                  ['Player', 'left'],
                  ['Pos', 'center'],
                  ['School', 'left'],
                  ['Ht', 'center'],
                  ['Wt', 'center'],
                  ['Age', 'center'],
                ].map(([h, al]) => (
                  <th key={h} style={{ textAlign:al, padding:'8px 12px', color:t.tableTextSubtle, fontFamily:BC, fontSize:10, letterSpacing:2, textTransform:'uppercase', fontWeight:700, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {availableProspects.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:'28px', textAlign:'center', color:t.tableTextSubtle, fontFamily:BC, letterSpacing:2, fontSize:11 }}>NO PROSPECTS LOADED</td></tr>
              ) : visibleProspects.map(p => (
                <tr key={p.id} style={{ borderBottom:`1px solid ${t.tableLine}` }}>
                  <td style={{ padding:'9px 12px', textAlign:'center', color:t.tableText, fontFamily:BC, fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{p.rank}</td>
                  <td style={{ padding:'9px 12px', color:t.tableText, fontWeight:600, whiteSpace:'nowrap', fontFamily:B }}>{p.name}</td>
                  <td style={{ padding:'9px 12px', textAlign:'center', color:t.tableTextMuted, fontFamily:BC, fontSize:12, letterSpacing:1 }}>{p.position || '—'}</td>
                  <td style={{ padding:'9px 12px', color:t.tableTextMuted, fontFamily:B, fontSize:12 }}>{p.school || '—'}</td>
                  <td style={{ padding:'9px 12px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{p.height || '—'}</td>
                  <td style={{ padding:'9px 12px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{p.weight || '—'}</td>
                  <td style={{ padding:'9px 12px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{p.age || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Picks Table */}
      <div style={{ background:t.tableBg, border:`1px solid ${t.border}`, borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'10px 14px', background:t.tableSectionBg, borderBottom:`1px solid ${t.tableLine}`, fontFamily:BC, fontWeight:900, fontSize:11, letterSpacing:3, color:t.tableTextSubtle, textTransform:'uppercase' }}>
          Draft Board · {picks.length} picks
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${t.tableLine}`, background:t.tableHeaderBg }}>
                {[
                  ['Pick #', 'center'],
                  ['Owns', 'center'],
                  ['Original', 'center'],
                  ['Player Name', 'left'],
                  ['School', 'left'],
                  ['Position', 'center'],
                  ['Age', 'center'],
                ].map(([h, al]) => (
                  <th key={h} style={{ textAlign:al, padding:'8px 12px', color:t.tableTextSubtle, fontFamily:BC, fontSize:10, letterSpacing:2, textTransform:'uppercase', fontWeight:700, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {picks.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:'28px', textAlign:'center', color:t.tableTextSubtle, fontFamily:BC, letterSpacing:2, fontSize:11 }}>NO PICKS ENTERED YET</td></tr>
              ) : picks.map(p => {
                const isOnClock = onClockPick && p.id === onClockPick.id
                const dim = !p.player_name
                return (
                  <tr key={p.id} style={{ borderBottom:`1px solid ${t.tableLine}`, background: isOnClock ? 'rgba(249,115,22,0.08)' : 'transparent' }}>
                    <td style={{ padding:'9px 12px', textAlign:'center', color:t.tableText, fontFamily:BC, fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{p.pick_number}</td>
                    <td style={{ padding:'9px 12px', textAlign:'center' }}>
                      <span style={{ display:'inline-block', padding:'3px 8px', borderRadius:5, background:(TEAM_CLR[p.owns_team] || '#475569') + '22', color:TEAM_CLR[p.owns_team] || t.tableText, fontFamily:BC, fontWeight:800, fontSize:11, letterSpacing:1 }}>{p.owns_team}</span>
                    </td>
                    <td style={{ padding:'9px 12px', textAlign:'center', color:t.tableTextMuted, fontFamily:BC, fontWeight:700, fontSize:12, letterSpacing:1 }}>{p.original_team || '—'}</td>
                    <td style={{ padding:'9px 12px', color: dim ? t.tableTextSubtle : t.tableText, fontWeight: dim ? 400 : 600, fontStyle: dim ? 'italic' : 'normal', whiteSpace:'nowrap', fontFamily:B }}>{p.player_name || '—'}</td>
                    <td style={{ padding:'9px 12px', color:t.tableTextMuted, fontFamily:B, fontSize:12 }}>{p.school || '—'}</td>
                    <td style={{ padding:'9px 12px', textAlign:'center', color:t.tableTextMuted, fontFamily:BC, fontSize:12, letterSpacing:1 }}>{p.position || '—'}</td>
                    <td style={{ padding:'9px 12px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{p.age || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
