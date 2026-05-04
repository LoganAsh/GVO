import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { BasketballIcon, ClipboardIcon, TargetIcon, BarChartIcon, SyncIcon, PersonIcon, LockIcon, CameraIcon, HourglassIcon } from './Icons'

const BC = "'Barlow Condensed', sans-serif"
const B  = "'Barlow', sans-serif"

const TEAMS = ["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"]
const FULL  = {ATL:"Atlanta Hawks",BOS:"Boston Celtics",BKN:"Brooklyn Nets",CHA:"Charlotte Hornets",CHI:"Chicago Bulls",CLE:"Cleveland Cavaliers",DAL:"Dallas Mavericks",DEN:"Denver Nuggets",DET:"Detroit Pistons",GSW:"Golden State Warriors",HOU:"Houston Rockets",IND:"Indiana Pacers",LAC:"LA Clippers",LAL:"LA Lakers",MEM:"Memphis Grizzlies",MIA:"Miami Heat",MIL:"Milwaukee Bucks",MIN:"Minnesota Timberwolves",NOP:"New Orleans Pelicans",NYK:"New York Knicks",OKC:"OKC Thunder",ORL:"Orlando Magic",PHI:"Philadelphia 76ers",PHX:"Phoenix Suns",POR:"Portland Trail Blazers",SAC:"Sacramento Kings",SAS:"San Antonio Spurs",TOR:"Toronto Raptors",UTA:"Utah Jazz",WAS:"Washington Wizards"}
const SYNC_URL = 'https://vdbrbtuidsfftgotmlol.supabase.co/functions/v1/sync-league-data'
const PARSE_BOX_SCORE_URL = 'https://vdbrbtuidsfftgotmlol.supabase.co/functions/v1/parse-box-score'
const DISCORD_SYNC_URL = 'https://vdbrbtuidsfftgotmlol.supabase.co/functions/v1/discord-sync'
const SYNC_PROSPECTS_URL = 'https://vdbrbtuidsfftgotmlol.supabase.co/functions/v1/sync-prospects'
const SYNC_2K_URL = 'https://vdbrbtuidsfftgotmlol.supabase.co/functions/v1/sync-2k-ratings'

const inputStyle  = { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#f1f5f9', fontFamily:B, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }
const labelStyle  = { fontFamily:BC, fontSize:10, letterSpacing:2, color:'#475569', textTransform:'uppercase', display:'block', marginBottom:5 }

function Card({ title, children }) {
  return (
    <div className="admin-card" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:24, marginBottom:20 }}>
      <div style={{ fontFamily:BC, fontWeight:800, fontSize:16, letterSpacing:1, color:'#f1f5f9', marginBottom:18, borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:12 }}>{title}</div>
      {children}
    </div>
  )
}

// ── Picks Tab ─────────────────────────────────────────────────────────────────

const EMPTY_PICK = { year: new Date().getFullYear()+1, round:1, pick_type:'own', original_team:'ATL', owned_by:'ATL', worst_team:'', receiving_team:'', swap_teams:[], swap_direction:'best', protection:'', notes:'' }

function PicksTab() {
  const [picks, setPicks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [form, setForm]           = useState(EMPTY_PICK)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [filterTeam, setFilter]   = useState('ALL')
  const [filterYear, setYearFilter] = useState('ALL')
  const [filterRound, setRoundFilter] = useState('ALL')

  useEffect(() => { loadPicks() }, [])

  const loadPicks = async () => {
    setLoading(true)
    const { data } = await supabase.from('draft_picks').select('*').order('year').order('round')
    setPicks(data || [])
    setLoading(false)
  }

  const openNew  = () => {
    const team = filterTeam !== 'ALL' ? filterTeam : EMPTY_PICK.original_team
    setForm({ ...EMPTY_PICK, original_team: team, owned_by: team })
    setEditId(null); setSaveError(null); setShowForm(true)
  }
  const openEdit = p  => { setForm({ year:p.year, round:p.round, pick_type:p.pick_type, original_team:p.original_team, owned_by:p.owned_by, worst_team:p.worst_team||'', receiving_team:p.receiving_team||'', swap_teams:p.swap_teams||[], swap_direction:p.swap_direction||'best', protection:p.protection||'', notes:p.notes||'' }); setEditId(p.id); setSaveError(null); setShowForm(true) }

  const handleSave = async () => {
    setSaving(true); setSaveError(null)
    const isSwap = form.pick_type !== 'own'
    // Both swap types use a role-based recipient model: owned_by gets best,
    // worst_team gets worst, and (for multi_swap) any remaining swap_teams take 2nd best.
    const payload = {
      year: Number(form.year), round: Number(form.round),
      pick_type: form.pick_type,
      original_team: form.original_team,
      owned_by: form.owned_by,
      worst_team: isSwap ? (form.worst_team || null) : null,
      receiving_team: isSwap ? (form.receiving_team || null) : null,
      swap_teams: isSwap ? form.swap_teams : null,
      swap_direction: isSwap ? 'best' : null,
      protection: form.protection || null,
      notes: form.notes || null,
    }
    const { error } = editId
      ? await supabase.from('draft_picks').update(payload).eq('id', editId)
      : await supabase.from('draft_picks').insert(payload)
    setSaving(false)
    if (error) { setSaveError(error.message || String(error)); return }
    setShowForm(false); loadPicks()
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this pick?')) return
    await supabase.from('draft_picks').delete().eq('id', id)
    loadPicks()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const changePickType = (v) => setForm(f => {
    const next = { ...f, pick_type: v }
    if ((v === 'swap' || v === 'multi_swap') && (!f.swap_teams || f.swap_teams.length === 0) && f.original_team) {
      next.swap_teams = [f.original_team]
    }
    return next
  })
  const addSwapTeam    = t => { if (!form.swap_teams.includes(t)) set('swap_teams', [...form.swap_teams, t]) }
  const removeSwapTeam = t => set('swap_teams', form.swap_teams.filter(x => x !== t))

  const yearOptions = Array.from(new Set(picks.map(p => p.year).filter(y => y != null))).sort((a, b) => a - b)
  const roundOptions = Array.from(new Set(picks.map(p => p.round).filter(r => r != null))).sort((a, b) => a - b)
  const visible = picks.filter(p =>
    (filterTeam === 'ALL' || p.owned_by === filterTeam || p.original_team === filterTeam || (p.swap_teams||[]).includes(filterTeam)) &&
    (filterYear === 'ALL' || p.year === Number(filterYear)) &&
    (filterRound === 'ALL' || p.round === Number(filterRound))
  )
  const typeLabel = { own:'Owns', swap:'Swap', multi_swap:'Multi-Swap' }

  return (
    <>
      <Card title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><TargetIcon size={16}/> Draft Pick Tracker</span>}>
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
          <select value={filterTeam} onChange={e=>setFilter(e.target.value)} style={{ ...inputStyle, width:'auto' }}>
            <option value="ALL">All Teams</option>
            {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
          </select>
          <select value={filterYear} onChange={e=>setYearFilter(e.target.value)} style={{ ...inputStyle, width:'auto' }}>
            <option value="ALL">All Years</option>
            {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterRound} onChange={e=>setRoundFilter(e.target.value)} style={{ ...inputStyle, width:'auto' }}>
            <option value="ALL">All Rounds</option>
            {roundOptions.map(r=><option key={r} value={r}>Round {r}</option>)}
          </select>
          <button onClick={openNew} style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#f97316,#ef4444)', color:'#fff', fontFamily:BC, fontWeight:900, fontSize:13, letterSpacing:1, cursor:'pointer', marginLeft:'auto' }}>
            + Add Pick
          </button>
        </div>

        {loading ? (
          <div style={{ color:'#334155', fontFamily:BC, letterSpacing:2, fontSize:11, padding:24, textAlign:'center' }}>LOADING…</div>
        ) : visible.length === 0 ? (
          <div style={{ color:'#334155', fontFamily:BC, letterSpacing:2, fontSize:11, padding:24, textAlign:'center' }}>NO PICKS — click "+ Add Pick" to get started</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {visible.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ flexShrink:0, textAlign:'center', minWidth:44 }}>
                  <div style={{ fontFamily:BC, fontWeight:900, fontSize:15, color:'#f1f5f9' }}>{p.year}</div>
                  <div style={{ fontFamily:BC, fontSize:9, letterSpacing:1, color:'#475569' }}>RD {p.round}</div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:3 }}>
                    <span style={{ fontFamily:BC, fontWeight:700, fontSize:11, color:'#60a5fa', background:'rgba(96,165,250,0.1)', borderRadius:4, padding:'1px 7px' }}>{typeLabel[p.pick_type]||p.pick_type}</span>
                    {!(p.pick_type!=='own' && (p.swap_teams||[]).includes(p.original_team)) && (() => {
                      const holder = p.pick_type!=='own' ? (p.receiving_team || p.owned_by) : p.owned_by
                      return (
                        <span style={{ fontFamily:BC, fontSize:12, color:'#94a3b8' }}>{p.original_team}{p.original_team!==holder?` → ${holder}`:' (own)'}</span>
                      )
                    })()}
                    {p.protection&&<span style={{ fontFamily:BC, fontSize:10, color:'#f97316', background:'rgba(249,115,22,0.1)', borderRadius:4, padding:'1px 6px', display:'inline-flex', alignItems:'center', gap:4 }}><LockIcon size={10}/> {p.protection}</span>}
                  </div>
                  {p.pick_type!=='own' && (
                    <div style={{ fontFamily:BC, fontSize:12, color:'#64748b', marginBottom:p.notes?3:0 }}>
                      {(p.swap_teams||[]).join(' ⇄ ')} · {
                        p.worst_team
                          ? (p.pick_type==='multi_swap'
                              ? `${p.owned_by} best · ${(p.swap_teams||[]).filter(t=>t!==p.owned_by && t!==p.worst_team).join(', ')||'—'} 2nd · ${p.worst_team} worst`
                              : `${p.owned_by} best · ${p.worst_team} worst`)
                          : `${p.owned_by} takes ${p.swap_direction}`
                      }
                    </div>
                  )}
                  {p.notes&&<div style={{ fontSize:12, color:'#475569', fontFamily:B }}>{p.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={()=>openEdit(p)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#64748b', fontFamily:BC, fontSize:11, cursor:'pointer' }}>Edit</button>
                  <button onClick={()=>handleDelete(p.id)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)', background:'transparent', color:'#f87171', fontFamily:BC, fontSize:11, cursor:'pointer' }}>Del</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {showForm && (
        <div onClick={()=>setShowForm(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#0d1525', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:28, width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ fontFamily:BC, fontWeight:900, fontSize:18, marginBottom:20 }}>{editId ? 'Edit Pick' : 'Add Pick'}</div>
            {saveError && (
              <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 12px', marginBottom:16, color:'#fca5a5', fontFamily:B, fontSize:12 }}>
                <div style={{ fontFamily:BC, fontWeight:700, fontSize:11, letterSpacing:1, textTransform:'uppercase', color:'#f87171', marginBottom:2 }}>Save failed</div>
                {saveError}
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Year + Round */}
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1 }}>
                  <label style={labelStyle}>Year</label>
                  <input type="number" value={form.year} onChange={e=>set('year',e.target.value)} style={inputStyle} min="2025" max="2035" />
                </div>
                <div style={{ flex:1 }}>
                  <label style={labelStyle}>Round</label>
                  <select value={form.round} onChange={e=>set('round',Number(e.target.value))} style={inputStyle}>
                    <option value={1}>1st Round</option>
                    <option value={2}>2nd Round</option>
                  </select>
                </div>
              </div>

              {/* Pick Type */}
              <div>
                <label style={labelStyle}>Pick Type</label>
                <div style={{ display:'flex', gap:6 }}>
                  {[['own','Outright'],['swap','2-Team Swap'],['multi_swap','Multi-Team Swap']].map(([v,l])=>(
                    <button key={v} onClick={()=>changePickType(v)} style={{ flex:1, padding:'9px 6px', borderRadius:8, border:`1px solid ${form.pick_type===v?'#f97316':'rgba(255,255,255,0.1)'}`, background:form.pick_type===v?'rgba(249,115,22,0.15)':'transparent', color:form.pick_type===v?'#f97316':'#64748b', fontFamily:BC, fontWeight:700, fontSize:11, letterSpacing:1, cursor:'pointer' }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Outright */}
              {form.pick_type==='own' && (
                <div style={{ display:'flex', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Original Team</label>
                    <select value={form.original_team} onChange={e=>set('original_team',e.target.value)} style={inputStyle}>
                      {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Owned By</label>
                    <select value={form.owned_by} onChange={e=>set('owned_by',e.target.value)} style={inputStyle}>
                      {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Swap */}
              {(form.pick_type==='swap'||form.pick_type==='multi_swap') && (
                <>
                  <div style={{ display:'flex', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <label style={labelStyle}>Original Team</label>
                      <select value={form.original_team} onChange={e=>set('original_team',e.target.value)} style={inputStyle}>
                        {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
                      </select>
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={labelStyle}>Receiving Team</label>
                      <select value={form.receiving_team} onChange={e=>set('receiving_team',e.target.value)} style={inputStyle}>
                        <option value="">— Same as original —</option>
                        {TEAMS.filter(t=>t!==form.original_team).map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Teams in Swap</label>
                    <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
                      {form.swap_teams.map(t=>(
                        <div key={t} style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.06)', borderRadius:6, padding:'4px 10px' }}>
                          <span style={{ fontFamily:BC, fontWeight:700, fontSize:12, color:'#f1f5f9' }}>{t}</span>
                          <button onClick={()=>removeSwapTeam(t)} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px' }}>×</button>
                        </div>
                      ))}
                    </div>
                    <select onChange={e=>{addSwapTeam(e.target.value);e.target.value=''}} defaultValue="" style={inputStyle}>
                      <option value="" disabled>+ Add team…</option>
                      {TEAMS.filter(t=>!form.swap_teams.includes(t)).map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
                    </select>
                  </div>
                  <>
                    {(() => {
                      const recipientPool = Array.from(new Set([
                        ...(form.original_team ? [form.original_team] : []),
                        ...form.swap_teams,
                      ]))
                      return (
                    <div style={{ display:'flex', gap:12 }}>
                      <div style={{ flex:1 }}>
                        <label style={labelStyle}>Gets Best</label>
                        <select value={form.owned_by} onChange={e=>set('owned_by',e.target.value)} style={inputStyle}>
                          {(recipientPool.length ? recipientPool : TEAMS).map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
                        </select>
                      </div>
                      <div style={{ flex:1 }}>
                        <label style={labelStyle}>Gets Worst</label>
                        <select value={form.worst_team} onChange={e=>set('worst_team',e.target.value)} style={inputStyle}>
                          <option value="">— None / unspecified</option>
                          {recipientPool.filter(t=>t!==form.owned_by).map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
                        </select>
                      </div>
                    </div>
                      )
                    })()}
                    {form.pick_type==='multi_swap' && form.worst_team && (
                      <div style={{ fontFamily:BC, fontSize:11, letterSpacing:1, color:'#475569', textTransform:'uppercase', paddingLeft:2 }}>
                        Gets 2nd Best:&nbsp;
                        <span style={{ color:'#94a3b8' }}>
                          {form.swap_teams.filter(t=>t!==form.owned_by && t!==form.worst_team).join(', ') || '— add more teams —'}
                        </span>
                      </div>
                      )}
                    </>
                </>
              )}

              {/* Protection */}
              <div>
                <label style={labelStyle}>Protection (optional)</label>
                <input value={form.protection} onChange={e=>set('protection',e.target.value)} placeholder="e.g. Top-4 protected, Lottery protected" style={inputStyle} />
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any additional context…" rows={2} style={{ ...inputStyle, resize:'vertical', lineHeight:1.5 }} />
              </div>

              {/* Buttons */}
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button onClick={()=>setShowForm(false)} style={{ flex:1, padding:'11px', borderRadius:9, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#64748b', fontFamily:BC, fontWeight:700, fontSize:13, letterSpacing:1, cursor:'pointer' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:'11px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#f97316,#ef4444)', color:'#fff', fontFamily:BC, fontWeight:900, fontSize:13, letterSpacing:1, cursor:saving?'wait':'pointer', opacity:saving?0.7:1 }}>
                  {saving?'Saving…':editId?'Save Changes':'Add Pick'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────

const STAT_COLS = [
  { key:'min',      label:'MIN' },
  { key:'pts',      label:'PTS' },
  { key:'reb',      label:'REB' },
  { key:'ast',      label:'AST' },
  { key:'stl',      label:'STL' },
  { key:'blk',      label:'BLK' },
  { key:'tov',      label:'TO'  },
  { key:'fgm',      label:'FGM' },
  { key:'fga',      label:'FGA' },
  { key:'three_pm', label:'3PM' },
  { key:'three_pa', label:'3PA' },
  { key:'ftm',      label:'FTM' },
  { key:'fta',      label:'FTA' },
  { key:'oreb',     label:'OR'  },
  { key:'fls',      label:'FLS' },
]

// NBA team identifiers we'll look for in a Discord recap message.
const TEAM_NICKNAMES = {
  ATL: ['Hawks', 'Atlanta'],
  BOS: ['Celtics', 'Boston'],
  BKN: ['Nets', 'Brooklyn'],
  CHA: ['Hornets', 'Charlotte'],
  CHI: ['Bulls', 'Chicago'],
  CLE: ['Cavaliers', 'Cavs', 'Cleveland'],
  DAL: ['Mavericks', 'Mavs', 'Dallas'],
  DEN: ['Nuggets', 'Denver'],
  DET: ['Pistons', 'Detroit'],
  GSW: ['Warriors', 'Golden State', 'GSW'],
  HOU: ['Rockets', 'Houston'],
  IND: ['Pacers', 'Indiana'],
  LAC: ['Clippers', 'LA Clippers'],
  LAL: ['Lakers', 'LA Lakers'],
  MEM: ['Grizzlies', 'Memphis'],
  MIA: ['Heat', 'Miami'],
  MIL: ['Bucks', 'Milwaukee'],
  MIN: ['Timberwolves', 'Wolves', 'Minnesota'],
  NOP: ['Pelicans', 'New Orleans'],
  NYK: ['Knicks', 'New York'],
  OKC: ['Thunder', 'OKC', 'Oklahoma City', 'Oklahoma'],
  ORL: ['Magic', 'Orlando'],
  PHI: ['76ers', 'Sixers', 'Philadelphia'],
  PHX: ['Suns', 'Phoenix'],
  POR: ['Trail Blazers', 'Blazers', 'Portland'],
  SAC: ['Kings', 'Sacramento'],
  SAS: ['Spurs', 'San Antonio'],
  TOR: ['Raptors', 'Toronto'],
  UTA: ['Jazz', 'Utah'],
  WAS: ['Wizards', 'Washington'],
}

// Parse a recap line like:
//   "Wolves (4-2) trounce the Kings (2-4) and move on ... 140-111"
// Returns the first-mentioned team as winner, the next distinct team as loser,
// and the LAST hyphenated game-style score (rejects 1-digit-1-digit records).
function parseGameInfo(text) {
  if (!text || typeof text !== 'string') return null
  const occurrences = []
  for (const [abbr, names] of Object.entries(TEAM_NICKNAMES)) {
    let bestIdx = -1
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`\\b${escaped}\\b`, 'i')
      const m = text.match(re)
      if (m && m.index != null && (bestIdx === -1 || m.index < bestIdx)) bestIdx = m.index
    }
    if (bestIdx >= 0) occurrences.push({ abbr, idx: bestIdx })
  }
  occurrences.sort((a, b) => a.idx - b.idx)
  const winner = occurrences[0]?.abbr || null
  const loser = occurrences.find(o => o.abbr !== winner)?.abbr || null
  // Final game score: at least two digits per side avoids matching W/L records like (4-2).
  const scoreMatches = [...text.matchAll(/\b(\d{2,3})\s*-\s*(\d{2,3})\b/g)]
  const last = scoreMatches[scoreMatches.length - 1]
  const winnerScore = last ? Number(last[1]) : null
  const loserScore  = last ? Number(last[2]) : null
  return { winner, loser, winnerScore, loserScore }
}

const blankStatRow = () => Object.fromEntries(STAT_COLS.map(c => [c.key, 0]))
const isAllZero = r => STAT_COLS.every(c => !Number(r[c.key]))

// Normalize a name to a comparable token, then split into initial + last.
// Handles formats like "A. Edwards", "A Edwards", "Anthony Edwards", "Edwards, Anthony".
function normalizeName(raw) {
  if (!raw) return null
  const s = raw.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!s) return null
  const parts = s.split(' ')
  if (parts.length === 1) return { first: '', last: parts[0] }
  return { first: parts[0], last: parts[parts.length - 1] }
}

// Static aliases applied BEFORE the regular matcher. Keyed by the normalized
// form ("a hukoporti" / "hukoporti"); value is the canonical roster name.
// Useful for misspellings in box-score screenshots.
const NAME_ALIASES_RAW = {
  // Ariel Hukporti — common typo "Hukoporti" with extra 'o'.
  'A. Hukoporti': 'Ariel Hukporti',
  'A Hukoporti':  'Ariel Hukporti',
  'Hukoporti':    'Ariel Hukporti',
}
const NAME_ALIASES = (() => {
  const out = {}
  for (const [k, v] of Object.entries(NAME_ALIASES_RAW)) {
    const n = normalizeName(k)
    if (!n) continue
    const key = n.first ? `${n.first} ${n.last}` : n.last
    out[key] = v
  }
  return out
})()

function applyNameAlias(raw) {
  const n = normalizeName(raw)
  if (!n) return raw
  const key = n.first ? `${n.first} ${n.last}` : n.last
  return NAME_ALIASES[key] || raw
}

// Stat-based disambiguation. When a team's roster has multiple players whose
// name normalizes the same way (e.g. Pacers' Amen + Ausar Thompson both =>
// "a thompson"), the basic matcher can't choose one. These rules sort the
// matching parsed rows and assign them to the listed candidates in order.
const DISAMBIG_RULES = [
  // Indiana Pacers: A. Thompson — more minutes => Amen, fewer => Ausar.
  {
    team: 'IND',
    typed: 'A. Thompson',
    candidates: ['Amen Thompson', 'Ausar Thompson'],
    sortBy: (a, b) => (Number(b.min) || 0) - (Number(a.min) || 0),
  },
]

// Match a free-typed name against a list of roster {id, name} entries.
// Returns the matched id when there is exactly one unambiguous match, else null.
function matchRosterId(typed, roster) {
  // Resolve known aliases first so a misspelled image cell still finds its row.
  const aliased = applyNameAlias(typed)
  const t = normalizeName(aliased)
  if (!t) return null
  const candidates = (roster || []).map(p => ({ id: p.id, name: p.name, n: normalizeName(p.name) })).filter(p => p.n)
  // 1) exact full-name match
  const exact = candidates.filter(p => p.n.first === t.first && p.n.last === t.last)
  if (exact.length === 1) return exact[0].id
  // 2) last name match + first initial (typed could be just an initial)
  const initial = (t.first || '')[0] || ''
  const byLastInit = candidates.filter(p => p.n.last === t.last && (!initial || (p.n.first || '')[0] === initial))
  if (byLastInit.length === 1) return byLastInit[0].id
  // 3) last name unique on its own
  const byLast = candidates.filter(p => p.n.last === t.last)
  if (byLast.length === 1) return byLast[0].id
  return null
}

// ── Draft Tab ─────────────────────────────────────────────────────────────────

const POSITIONS = ['PG','SG','SF','PF','C','G','F','G/F','F/C']
const EMPTY_DRAFT_PICK = { pick_number: '', owns_team: 'ATL', original_team: 'ATL', player_name: '', school: '', position: '', height: '' }

function DraftTab() {
  const [picks, setPicks]                 = useState([])
  const [settings, setSettings]           = useState(null)
  const [prospects, setProspects]         = useState([])
  const [prospectCount, setProspectCount] = useState(0)
  const [prospectUpdated, setProspectUpdated] = useState(null)
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)
  const [editId, setEditId]               = useState(null)
  const [form, setForm]                   = useState(EMPTY_DRAFT_PICK)
  const [saving, setSaving]               = useState(false)
  const [saveError, setSaveError]         = useState(null)
  const [clockMinutes, setClockMinutes]   = useState('10')
  const [draftAtLocal, setDraftAtLocal]   = useState('')
  const [savingClock, setSavingClock]     = useState(false)
  const [savingDate, setSavingDate]       = useState(false)
  const [syncingProspects, setSyncingProspects] = useState(false)
  const [prospectError, setProspectError] = useState(null)
  const [prospectStatus, setProspectStatus] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [picksRes, settingsRes, prospectsRes] = await Promise.all([
      supabase.from('draft_2026').select('*').order('pick_number'),
      supabase.from('draft_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('prospects').select('*').order('rank'),
    ])
    setPicks(picksRes.data || [])
    setSettings(settingsRes.data || null)
    setProspects(prospectsRes.data || [])
    setProspectCount((prospectsRes.data || []).length)
    setProspectUpdated((prospectsRes.data || [])[0]?.updated_at || null)
    if (settingsRes.data) {
      setClockMinutes(String(Math.round((settingsRes.data.clock_seconds || 600) / 60)))
      // Convert UTC ISO to a value the datetime-local input accepts (local TZ)
      const d = new Date(settingsRes.data.draft_at)
      const pad = n => String(n).padStart(2, '0')
      setDraftAtLocal(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
    }
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openNew = () => {
    const next = picks.length ? Math.max(...picks.map(p => p.pick_number)) + 1 : 1
    setForm({ ...EMPTY_DRAFT_PICK, pick_number: String(next) })
    setEditId(null); setSaveError(null); setShowForm(true)
  }
  const openEdit = p => {
    setForm({
      pick_number: String(p.pick_number),
      owns_team: p.owns_team || 'ATL',
      original_team: p.original_team || 'ATL',
      player_name: p.player_name || '',
      school: p.school || '',
      position: p.position || '',
      height: p.height || '',
    })
    setEditId(p.id); setSaveError(null); setShowForm(true)
  }

  const selectProspect = (prospectId) => {
    if (!prospectId) {
      setForm(f => ({ ...f, player_name: '', position: '', school: '', height: '' }))
      return
    }
    const p = prospects.find(x => String(x.id) === String(prospectId))
    if (!p) return
    setForm(f => ({
      ...f,
      player_name: p.name || '',
      position: p.position || '',
      school: p.school || '',
      height: p.height || '',
    }))
  }

  const handleSave = async () => {
    setSaving(true); setSaveError(null)
    const payload = {
      pick_number: Number(form.pick_number),
      owns_team: form.owns_team,
      original_team: form.original_team,
      player_name: form.player_name.trim() || null,
      school: form.school.trim() || null,
      position: form.position || null,
      height: form.height.trim() || null,
    }
    if (!payload.pick_number || isNaN(payload.pick_number)) {
      setSaving(false); setSaveError('Pick # is required'); return
    }
    const { error } = editId
      ? await supabase.from('draft_2026').update(payload).eq('id', editId)
      : await supabase.from('draft_2026').insert(payload)
    setSaving(false)
    if (error) { setSaveError(error.message || String(error)); return }
    setShowForm(false); load()
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this pick?')) return
    await supabase.from('draft_2026').delete().eq('id', id)
    load()
  }

  const startClock = async () => {
    setSavingClock(true)
    const seconds = Math.max(1, Number(clockMinutes) || 0) * 60
    await supabase.from('draft_settings').update({
      clock_seconds: seconds,
      clock_running: true,
      clock_started_at: new Date().toISOString(),
    }).eq('id', 1)
    setSavingClock(false); load()
  }
  const stopClock = async () => {
    setSavingClock(true)
    await supabase.from('draft_settings').update({ clock_running: false }).eq('id', 1)
    setSavingClock(false); load()
  }
  const saveClockLength = async () => {
    setSavingClock(true)
    const seconds = Math.max(1, Number(clockMinutes) || 0) * 60
    await supabase.from('draft_settings').update({ clock_seconds: seconds }).eq('id', 1)
    setSavingClock(false); load()
  }
  const saveDraftDate = async () => {
    if (!draftAtLocal) return
    setSavingDate(true)
    // Treat input as local time → convert to ISO
    const iso = new Date(draftAtLocal).toISOString()
    await supabase.from('draft_settings').update({ draft_at: iso }).eq('id', 1)
    setSavingDate(false); load()
  }

  const syncProspects = async () => {
    setSyncingProspects(true); setProspectError(null); setProspectStatus(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('No active admin session.')
      const res = await fetch(SYNC_PROSPECTS_URL, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: '{}',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail = json?.snippet ? `\n\n${String(json.snippet).slice(0, 1500)}` : ''
        throw new Error(`${json?.error || `HTTP ${res.status}`}${detail}`)
      }
      setProspectStatus(`Synced ${json.count} prospects (${json.via})`)
      load()
    } catch (e) {
      setProspectError(e.message || String(e))
    }
    setSyncingProspects(false)
  }

  if (loading) return (
    <Card title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><TargetIcon size={16}/> 2026 Draft</span>}>
      <div style={{ color:'#475569', fontFamily:BC, letterSpacing:2, fontSize:12, padding:24, textAlign:'center' }}>LOADING…</div>
    </Card>
  )

  return (
    <>
      <Card title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><BarChartIcon size={16}/> Best Available Prospects</span>}>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
          <button onClick={syncProspects} disabled={syncingProspects}
            style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#f97316,#ef4444)', color:'#fff', fontFamily:BC, fontWeight:900, fontSize:13, letterSpacing:1, cursor:syncingProspects?'wait':'pointer', opacity:syncingProspects?0.7:1, display:'inline-flex', alignItems:'center', gap:8 }}>
            {syncingProspects ? <><HourglassIcon size={14}/> <span>Syncing…</span></> : <><SyncIcon size={14}/> <span>Sync from Tankathon</span></>}
          </button>
          <span style={{ fontFamily:BC, fontSize:11, letterSpacing:1, color:'#94a3b8' }}>
            {prospectCount} prospects · {prospectUpdated ? `updated ${new Date(prospectUpdated).toLocaleString()}` : 'never synced'}
          </span>
        </div>
        <div style={{ fontSize:11, color:'#475569', fontFamily:BC, letterSpacing:1 }}>
          Pulls the latest big board from tankathon.com. Replaces all rows.
        </div>
        {prospectStatus && (
          <div style={{ marginTop:12, background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:8, padding:'9px 12px', color:'#34d399', fontFamily:BC, fontSize:12, letterSpacing:1 }}>
            {prospectStatus}
          </div>
        )}
        {prospectError && (
          <pre style={{ marginTop:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 12px', color:'#fca5a5', fontFamily:'monospace', fontSize:11, lineHeight:1.45, whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:320, overflow:'auto' }}>
            {prospectError}
          </pre>
        )}
      </Card>
      <Card title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><HourglassIcon size={16}/> Draft Settings</span>}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:18 }}>
          <div>
            <label style={labelStyle}>Draft Date / Time (local)</label>
            <div style={{ display:'flex', gap:8 }}>
              <input type="datetime-local" value={draftAtLocal} onChange={e=>setDraftAtLocal(e.target.value)} style={{ ...inputStyle, flex:1 }}/>
              <button onClick={saveDraftDate} disabled={savingDate} style={{ padding:'8px 14px', borderRadius:7, border:'none', background:'rgba(52,211,153,0.15)', color:'#34d399', fontFamily:BC, fontWeight:700, fontSize:11, letterSpacing:1, cursor:savingDate?'wait':'pointer' }}>
                {savingDate?'…':'SAVE'}
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Pick Clock Length (minutes)</label>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="number" min="1" value={clockMinutes} onChange={e=>setClockMinutes(e.target.value)} style={{ ...inputStyle, flex:1 }}/>
              <button onClick={saveClockLength} disabled={savingClock} style={{ padding:'8px 14px', borderRadius:7, border:'none', background:'rgba(255,255,255,0.06)', color:'#94a3b8', fontFamily:BC, fontWeight:700, fontSize:11, letterSpacing:1, cursor:savingClock?'wait':'pointer' }}>
                SAVE
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Pick Clock</label>
            <div style={{ display:'flex', gap:8 }}>
              {settings?.clock_running ? (
                <button onClick={stopClock} disabled={savingClock} style={{ flex:1, padding:'9px 14px', borderRadius:7, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.12)', color:'#f87171', fontFamily:BC, fontWeight:800, fontSize:12, letterSpacing:2, textTransform:'uppercase', cursor:savingClock?'wait':'pointer' }}>
                  ■ Stop Clock
                </button>
              ) : (
                <button onClick={startClock} disabled={savingClock} style={{ flex:1, padding:'9px 14px', borderRadius:7, border:'none', background:'linear-gradient(135deg,#f97316,#ef4444)', color:'#fff', fontFamily:BC, fontWeight:900, fontSize:12, letterSpacing:2, textTransform:'uppercase', cursor:savingClock?'wait':'pointer' }}>
                  ▶ Start Clock
                </button>
              )}
            </div>
            <div style={{ fontFamily:BC, fontSize:10, letterSpacing:1, color:'#475569', marginTop:6 }}>
              {settings?.clock_running ? `Running since ${new Date(settings.clock_started_at).toLocaleTimeString()}` : 'Off (hidden on public Draft page)'}
            </div>
          </div>
        </div>
      </Card>

      <Card title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><TargetIcon size={16}/> Draft Picks · {picks.length}</span>}>
        <div style={{ marginBottom:16 }}>
          <button onClick={openNew} style={{ padding:'8px 18px', borderRadius:7, border:'none', background:'linear-gradient(135deg,#f97316,#ef4444)', color:'#fff', fontFamily:BC, fontWeight:900, fontSize:12, letterSpacing:1, cursor:'pointer' }}>+ Add Pick</button>
        </div>

        {showForm && (() => {
          // Names already used by other picks (lowercased) — hide them from
          // the prospect dropdown so we don't list someone twice. Keep the
          // currently-edited pick's name visible.
          const taken = new Set(
            picks.filter(p => p.id !== editId && p.player_name)
              .map(p => p.player_name.trim().toLowerCase())
          )
          const availableProspects = prospects.filter(p => !taken.has((p.name || '').trim().toLowerCase()))
          // Selected prospect id: match by name against the form
          const matchByName = prospects.find(p => (p.name || '').trim().toLowerCase() === (form.player_name || '').trim().toLowerCase())
          const selectedProspectId = matchByName ? String(matchByName.id) : ''
          return (
          <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:18, marginBottom:18 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:14 }}>
              <div>
                <label style={labelStyle}>Pick #</label>
                <input type="number" min="1" value={form.pick_number} onChange={e=>set('pick_number', e.target.value)} style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Owns</label>
                <select value={form.owns_team} onChange={e=>set('owns_team', e.target.value)} style={inputStyle}>
                  {TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Original</label>
                <select value={form.original_team} onChange={e=>set('original_team', e.target.value)} style={inputStyle}>
                  {TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1 / -1' }}>
                <label style={labelStyle}>Player {prospects.length === 0 && <span style={{ color:'#fbbf24' }}>(no prospects synced yet)</span>}</label>
                <select value={selectedProspectId} onChange={e=>selectProspect(e.target.value)} style={inputStyle}>
                  <option value="">— Select from Best Available —</option>
                  {availableProspects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.rank}. {p.name}{p.position ? ` · ${p.position}` : ''}{p.school ? ` · ${p.school}` : ''}
                    </option>
                  ))}
                </select>
                {form.player_name && !matchByName && (
                  <div style={{ marginTop:6, fontFamily:BC, fontSize:11, letterSpacing:1, color:'#fbbf24' }}>
                    Custom: {form.player_name}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Position</label>
                <select value={form.position} onChange={e=>set('position', e.target.value)} style={inputStyle}>
                  <option value="">—</option>
                  {POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>School</label>
                <input value={form.school} onChange={e=>set('school', e.target.value)} style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Height</label>
                <input value={form.height} onChange={e=>set('height', e.target.value)} placeholder='e.g. 6-9' style={inputStyle}/>
              </div>
            </div>
            {saveError && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:7, padding:'9px 12px', color:'#f87171', fontSize:12, fontFamily:B, marginBottom:12 }}>{saveError}</div>}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleSave} disabled={saving} style={{ padding:'8px 18px', borderRadius:7, border:'none', background:'rgba(52,211,153,0.15)', color:'#34d399', fontFamily:BC, fontWeight:800, fontSize:12, letterSpacing:1, cursor:saving?'wait':'pointer' }}>{saving?'SAVING…':editId?'UPDATE':'CREATE'}</button>
              <button onClick={()=>setShowForm(false)} style={{ padding:'8px 18px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#94a3b8', fontFamily:BC, fontWeight:700, fontSize:12, letterSpacing:1, cursor:'pointer' }}>CANCEL</button>
            </div>
          </div>
          )
        })()}

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                {['#','Owns','Original','Player','Position','School','Height',''].map((h,i)=>(
                  <th key={i} style={{ textAlign:i===3||i===5?'left':'center', padding:'8px 10px', color:'#475569', fontFamily:BC, fontSize:10, letterSpacing:2, textTransform:'uppercase', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {picks.length === 0 ? (
                <tr><td colSpan={8} style={{ padding:24, textAlign:'center', color:'#334155', fontFamily:BC, letterSpacing:2, fontSize:11 }}>NO PICKS — CLICK + ADD PICK</td></tr>
              ) : picks.map(p => (
                <tr key={p.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding:'7px 10px', textAlign:'center', color:'#f1f5f9', fontFamily:BC, fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{p.pick_number}</td>
                  <td style={{ padding:'7px 10px', textAlign:'center', color:'#f1f5f9', fontFamily:BC, fontWeight:700 }}>{p.owns_team}</td>
                  <td style={{ padding:'7px 10px', textAlign:'center', color:'#94a3b8', fontFamily:BC }}>{p.original_team}</td>
                  <td style={{ padding:'7px 10px', color: p.player_name ? '#f1f5f9' : '#475569', fontStyle: p.player_name ? 'normal' : 'italic' }}>{p.player_name || '—'}</td>
                  <td style={{ padding:'7px 10px', textAlign:'center', color:'#94a3b8', fontFamily:BC }}>{p.position || '—'}</td>
                  <td style={{ padding:'7px 10px', color:'#94a3b8' }}>{p.school || '—'}</td>
                  <td style={{ padding:'7px 10px', textAlign:'center', color:'#94a3b8', fontVariantNumeric:'tabular-nums' }}>{p.height || '—'}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', whiteSpace:'nowrap' }}>
                    <button onClick={()=>openEdit(p)} style={{ marginRight:6, padding:'5px 10px', borderRadius:5, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#94a3b8', fontFamily:BC, fontWeight:700, fontSize:10, letterSpacing:1, cursor:'pointer' }}>EDIT</button>
                    <button onClick={()=>handleDelete(p.id)} style={{ padding:'5px 10px', borderRadius:5, border:'1px solid rgba(239,68,68,0.3)', background:'transparent', color:'#f87171', fontFamily:BC, fontWeight:700, fontSize:10, letterSpacing:1, cursor:'pointer' }}>DEL</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function StatsTab() {
  const today = new Date().toISOString().slice(0, 10)
  const [gameDate, setGameDate]   = useState(today)
  const [winnerTeam, setWinnerTeam]   = useState('ATL')
  const [loserTeam, setLoserTeam]   = useState('BOS')
  const [winnerScore, setWinnerScore] = useState('')
  const [loserScore, setLoserScore] = useState('')
  const [notes, setNotes]         = useState('')
  const [editId, setEditId]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Roster lookup keyed by team abbr
  const [rosterByTeam, setRosterByTeam] = useState({})
  // Per-game stats keyed by team abbr → array of { player_id, player_name, ...stat keys }
  const [statsByTeam, setStatsByTeam]   = useState({})
  const [recentGames, setRecentGames]   = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => { loadAll() }, [])
  // Re-seed stat rows from roster when teams change (only for new entry, not edits in progress)
  useEffect(() => {
    if (editId) return
    seedRowsForTeam(winnerTeam)
    seedRowsForTeam(loserTeam)
  }, [winnerTeam, loserTeam, rosterByTeam, editId])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: rosterRows }, { data: gameRows }, { data: pendingRows }] = await Promise.all([
      supabase.from('roster').select('id,team_abbr,player_name').order('id'),
      supabase.from('games').select('*').order('game_date', { ascending: false }).order('id', { ascending: false }).limit(40),
      supabase.from('pending_box_scores').select('*').eq('status','pending').order('posted_at', { ascending: false }).limit(40),
    ])
    const byTeam = {}
    for (const r of rosterRows || []) {
      if (!byTeam[r.team_abbr]) byTeam[r.team_abbr] = []
      byTeam[r.team_abbr].push({ id: r.id, name: r.player_name })
    }
    setRosterByTeam(byTeam)
    setRecentGames(gameRows || [])
    setPending(pendingRows || [])
    setLoading(false)
  }

  const pullDiscord = async () => {
    setDiscordError(null); setDiscordSummary(null)
    setPullingDiscord(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('No active admin session.')
      const callDiscord = async (body) => {
        const res = await fetch(DISCORD_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
          body: JSON.stringify(body || {}),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          const detail = typeof json?.detail === 'string' ? json.detail : ''
          throw new Error(`${json?.error || `HTTP ${res.status}`}${detail ? ` — ${detail.slice(0,300)}` : ''}`)
        }
        return json
      }
      // 1) Poll Discord for new image messages.
      const pollJson = await callDiscord({})
      // 2) Re-parse any pending rows that had a parse error.
      const retryJson = await callDiscord({ retry_failed: true })
      setDiscordSummary({
        fetched: pollJson.fetched ?? 0,
        created: pollJson.created_count ?? 0,
        errors: pollJson.error_count ?? 0,
        retried: retryJson.retried ?? 0,
        recovered: retryJson.recovered ?? 0,
      })
      const { data: pendingRows } = await supabase.from('pending_box_scores').select('*').eq('status','pending').order('posted_at', { ascending: false }).limit(40)
      setPending(pendingRows || [])
    } catch (e) {
      setDiscordError(e.message || String(e))
    } finally {
      setPullingDiscord(false)
    }
  }

  // Drop a pending row's parsed players into the chosen team's grid.
  // Reuses the same merge-by-name logic as direct image upload.
  // slot is 'winner' or 'loser'. We try to read the recap text on the pending
  // row to identify the two teams + final score, pre-fill those into the form,
  // and import the parsed players into the resulting team's grid. If the same
  // Discord message produced exactly one other pending image, we treat it as
  // the opposite team and import its players too in one click.
  const importPendingTo = (slot, pendingRow) => {
    const rows = Array.isArray(pendingRow.parsed_rows) ? pendingRow.parsed_rows : []
    if (!rows.length) {
      setParseError('That pending row has no parsed players to import.')
      return
    }

    const info = parseGameInfo(pendingRow.message_text || '')
    const targetTeam = slot === 'winner'
      ? (info?.winner || winnerTeam)
      : (info?.loser  || loserTeam)

    if (info?.winner && info.winner !== winnerTeam) setWinnerTeam(info.winner)
    if (info?.loser  && info.loser  !== loserTeam ) setLoserTeam(info.loser)
    if (info?.winnerScore != null) setWinnerScore(String(info.winnerScore))
    if (info?.loserScore  != null) setLoserScore(String(info.loserScore))
    if (pendingRow.posted_at && gameDate === today) {
      setGameDate(new Date(pendingRow.posted_at).toISOString().slice(0, 10))
    }
    if (pendingRow.message_text && !notes) {
      setNotes(pendingRow.message_text.slice(0, 250))
    }

    mergeParsedRows(targetTeam, rows)

    // Auto-pair: if the same Discord message produced exactly one other pending
    // image, treat it as the other team and import it into the opposite slot.
    let pairedId = null
    if (pendingRow.discord_message_id) {
      const siblings = pending.filter(p =>
        p.id !== pendingRow.id &&
        p.discord_message_id &&
        p.discord_message_id === pendingRow.discord_message_id &&
        Array.isArray(p.parsed_rows) && p.parsed_rows.length
      )
      if (siblings.length === 1) {
        const paired = siblings[0]
        const otherTeam = slot === 'winner'
          ? (info?.loser  || loserTeam)
          : (info?.winner || winnerTeam)
        mergeParsedRows(otherTeam, paired.parsed_rows)
        pairedId = paired.id
      }
    }

    const idsToApprove = pairedId ? [pendingRow.id, pairedId] : [pendingRow.id]
    supabase.from('pending_box_scores').update({ status: 'approved' }).in('id', idsToApprove).then(() => {
      setPending(prev => prev.filter(p => !idsToApprove.includes(p.id)))
    })
  }

  const rejectPending = async (pendingRow) => {
    if (!window.confirm('Discard this pending box score?')) return
    await supabase.from('pending_box_scores').update({ status: 'rejected' }).eq('id', pendingRow.id)
    setPending(prev => prev.filter(p => p.id !== pendingRow.id))
  }

  const seedRowsForTeam = (team) => {
    setStatsByTeam(prev => {
      if (prev[team]) return prev
      const players = rosterByTeam[team] || []
      return { ...prev, [team]: players.map(p => ({ player_id: p.id, player_name: p.name, dnp: false, ...blankStatRow() })) }
    })
  }

  const setRowDnp = (team, idx, dnp) => {
    setStatsByTeam(prev => {
      const rows = (prev[team] || []).slice()
      rows[idx] = { ...rows[idx], dnp }
      return { ...prev, [team]: rows }
    })
  }

  const setRowField = (team, idx, key, value) => {
    setStatsByTeam(prev => {
      const rows = (prev[team] || []).slice()
      rows[idx] = { ...rows[idx], [key]: value }
      return { ...prev, [team]: rows }
    })
  }

  const setRowName = (team, idx, name) => {
    setStatsByTeam(prev => {
      const rows = (prev[team] || []).slice()
      rows[idx] = { ...rows[idx], player_name: name }
      return { ...prev, [team]: rows }
    })
  }

  const addRow = (team) => {
    setStatsByTeam(prev => ({ ...prev, [team]: [...(prev[team]||[]), { player_id: null, player_name: '', dnp: false, ...blankStatRow() }] }))
  }

  const [parsing, setParsing] = useState({})  // { [team]: boolean }
  const [parseError, setParseError] = useState(null)
  const [pending, setPending]               = useState([])
  const [pullingDiscord, setPullingDiscord] = useState(false)
  const [discordError, setDiscordError]     = useState(null)
  const [discordSummary, setDiscordSummary] = useState(null)

  // Apply parsed rows from the vision call into the team's grid.
  // For each parsed row: if a row with the same normalized name exists, overwrite stats;
  // otherwise append as a new row. Existing player_id is preserved on a name match.
  const mergeParsedRows = (team, parsedRows) => {
    setStatsByTeam(prev => {
      const existing = (prev[team] || []).slice()
      const teamRoster = rosterByTeam[team] || []
      for (const p of parsedRows) {
        // Resolve known aliases (e.g. "A. Hukoporti" -> "Ariel Hukporti") so
        // typo names from screenshots merge into the right roster row.
        const canonicalName = applyNameAlias(p.player_name)
        const pn = normalizeName(canonicalName)
        let idx = -1
        if (pn) idx = existing.findIndex(r => {
          const rn = normalizeName(r.player_name)
          if (!rn) return false
          if (rn.last !== pn.last) return false
          // accept if either side has no first initial, or initials match
          const a = (rn.first || '')[0] || ''
          const b = (pn.first || '')[0] || ''
          return !a || !b || a === b
        })
        const cells = {}
        for (const c of STAT_COLS) cells[c.key] = Number(p[c.key]) || 0
        if (idx >= 0) {
          existing[idx] = { ...existing[idx], ...cells, player_name: existing[idx].player_name || canonicalName, dnp: false }
        } else {
          const matchedId = matchRosterId(canonicalName, teamRoster)
          existing.push({ player_id: matchedId, player_name: canonicalName, dnp: false, ...cells })
        }
      }

      // Stat-based disambiguation pass. When the parsed rows contain N copies
      // of an ambiguous name (e.g. two "A. Thompson" lines on Indiana) and the
      // team roster has matching candidates, sort and assign per the rule.
      for (const rule of DISAMBIG_RULES) {
        if (rule.team !== team) continue
        const rn = normalizeName(rule.typed)
        if (!rn) continue
        const matchIdxs = []
        for (let i = 0; i < existing.length; i++) {
          const en = normalizeName(existing[i].player_name)
          if (!en) continue
          const a = (en.first || '')[0] || ''
          const b = (rn.first || '')[0] || ''
          if (en.last === rn.last && (!a || !b || a === b)) matchIdxs.push(i)
        }
        if (matchIdxs.length < 2) continue
        const sorted = [...matchIdxs].sort((ai, bi) => rule.sortBy(existing[ai], existing[bi]))
        const candidates = rule.candidates
          .map(name => teamRoster.find(p => p.name === name))
          .filter(Boolean)
        for (let i = 0; i < Math.min(sorted.length, candidates.length); i++) {
          const idx = sorted[i]
          existing[idx] = { ...existing[idx], player_id: candidates[i].id, player_name: candidates[i].name }
        }
      }

      return { ...prev, [team]: existing }
    })
  }

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const handleParseImage = async (team, file) => {
    if (!file) return
    setParseError(null)
    setParsing(p => ({ ...p, [team]: true }))
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('No active admin session — sign in again.')
      const base64 = await fileToBase64(file)
      const res = await fetch(PARSE_BOX_SCORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: base64, mediaType: file.type || 'image/png' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail = typeof json?.detail === 'string' ? json.detail : (json?.detail ? JSON.stringify(json.detail).slice(0, 500) : '')
        throw new Error(`${json?.error || `HTTP ${res.status}`}${detail ? ` — ${detail}` : ''}`)
      }
      const rows = Array.isArray(json.rows) ? json.rows : []
      if (!rows.length) throw new Error('No rows parsed from image — check the screenshot quality.')
      mergeParsedRows(team, rows)
    } catch (e) {
      setParseError(`Image parse failed for ${team}: ${e.message || e}`)
    } finally {
      setParsing(p => ({ ...p, [team]: false }))
    }
  }

  const resetForm = () => {
    setEditId(null); setSaveError(null)
    setGameDate(today); setWinnerTeam('ATL'); setLoserTeam('BOS')
    setWinnerScore(''); setLoserScore(''); setNotes('')
    setStatsByTeam({})
  }

  const startEdit = async (g) => {
    setEditId(g.id); setSaveError(null)
    setGameDate(g.game_date || today)
    setWinnerTeam(g.winner_team || 'ATL'); setLoserTeam(g.loser_team || 'BOS')
    setWinnerScore(g.winner_score == null ? '' : String(g.winner_score))
    setLoserScore(g.loser_score == null ? '' : String(g.loser_score))
    setNotes(g.notes || '')
    const { data: rows } = await supabase.from('player_stats').select('*').eq('game_id', g.id).order('id')
    const byTeam = {}
    for (const r of rows || []) {
      if (!byTeam[r.team_abbr]) byTeam[r.team_abbr] = []
      const next = { player_id: r.player_id, player_name: r.player_name, dnp: !!r.dnp }
      for (const c of STAT_COLS) next[c.key] = r[c.key] || 0
      byTeam[r.team_abbr].push(next)
    }
    // Add any roster players that weren't in the saved game so the admin can mark
    // them DNP if they meant to. New rows go below the saved ones.
    for (const team of [g.winner_team, g.loser_team]) {
      const present = new Set((byTeam[team]||[]).map(r => r.player_id).filter(Boolean))
      const extras = (rosterByTeam[team]||[]).filter(p => !present.has(p.id)).map(p => ({ player_id: p.id, player_name: p.name, dnp: false, ...blankStatRow() }))
      byTeam[team] = [...(byTeam[team]||[]), ...extras]
    }
    setStatsByTeam(byTeam)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    setSaving(true); setSaveError(null)
    const gamePayload = {
      game_date: gameDate || null,
      winner_team: winnerTeam, loser_team: loserTeam,
      winner_score: winnerScore === '' ? null : Number(winnerScore),
      loser_score: loserScore === '' ? null : Number(loserScore),
      notes: notes || null,
    }
    let gameId = editId
    if (editId) {
      const { error } = await supabase.from('games').update(gamePayload).eq('id', editId)
      if (error) { setSaving(false); setSaveError(error.message); return }
      // Wipe existing stat rows for this game so we can re-insert clean
      await supabase.from('player_stats').delete().eq('game_id', editId)
    } else {
      const { data, error } = await supabase.from('games').insert(gamePayload).select('id').single()
      if (error || !data) { setSaving(false); setSaveError(error?.message || 'Insert failed'); return }
      gameId = data.id
    }
    // The roster table is delete-then-insert on every sync, so player_ids cached
    // in state can go stale. Re-fetch the current roster for both teams now and
    // null-out any player_id that no longer exists; then re-run name matching.
    const { data: freshRoster } = await supabase
      .from('roster')
      .select('id,team_abbr,player_name')
      .in('team_abbr', [winnerTeam, loserTeam])
    const freshByTeam = {}
    const validIds = new Set()
    for (const r of freshRoster || []) {
      if (!freshByTeam[r.team_abbr]) freshByTeam[r.team_abbr] = []
      freshByTeam[r.team_abbr].push({ id: r.id, name: r.player_name })
      validIds.add(r.id)
    }

    const insertRows = []
    for (const team of [winnerTeam, loserTeam]) {
      const teamRoster = freshByTeam[team] || rosterByTeam[team] || []
      for (const r of (statsByTeam[team] || [])) {
        const name = r.player_name?.trim() || ''
        if (!name && !r.player_id) continue
        // Drop rows that are neither DNP nor have any stats — those are unfilled roster entries.
        if (!r.dnp && isAllZero(r)) continue
        // Validate player_id against the freshly fetched roster, fall back to
        // name-based matching, and finally null out if nothing matches.
        let pid = r.player_id || null
        if (pid && !validIds.has(pid)) pid = null
        if (!pid || !teamRoster.some(p => p.id === pid)) pid = matchRosterId(name, teamRoster)
        if (pid && !validIds.has(pid)) pid = null
        const row = {
          game_id: gameId,
          player_id: pid,
          team_abbr: team,
          player_name: name,
          dnp: !!r.dnp,
        }
        for (const c of STAT_COLS) row[c.key] = r.dnp ? 0 : (Number(r[c.key]) || 0)
        insertRows.push(row)
      }
    }
    if (insertRows.length) {
      const { error } = await supabase.from('player_stats').insert(insertRows)
      if (error) { setSaving(false); setSaveError(error.message); return }
    }
    setSaving(false)
    await loadAll()
    resetForm()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this game and all its stat rows?')) return
    await supabase.from('games').delete().eq('id', id)
    if (editId === id) resetForm()
    loadAll()
  }

  const TeamGrid = ({ team }) => {
    const rows = statsByTeam[team] || []
    const isParsing = !!parsing[team]
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8, gap:8, flexWrap:'wrap' }}>
          <div style={{ fontFamily:BC, fontWeight:900, fontSize:13, letterSpacing:2, color:'#f1f5f9' }}>{team} {FULL[team]?`— ${FULL[team]}`:''}</div>
          <div style={{ display:'flex', gap:6 }}>
            <label style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(167,139,250,0.3)', background:isParsing?'rgba(167,139,250,0.08)':'transparent', color: isParsing ? '#475569' : '#a78bfa', fontFamily:BC, fontSize:11, cursor: isParsing ? 'wait' : 'pointer', display:'inline-flex', alignItems:'center', gap:4 }}>
              {isParsing ? 'Parsing…' : <span style={{display:'inline-flex',alignItems:'center',gap:6}}><CameraIcon size={12}/> Parse Image</span>}
              <input type="file" accept="image/*" disabled={isParsing} onChange={e=>{ const f=e.target.files?.[0]; e.target.value=''; handleParseImage(team, f) }} style={{ display:'none' }}/>
            </label>
            <button type="button" onClick={()=>addRow(team)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#94a3b8', fontFamily:BC, fontSize:11, cursor:'pointer' }}>+ Add Player</button>
          </div>
        </div>
        <div style={{ overflowX:'auto', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:B, fontSize:12 }}>
            <thead>
              <tr style={{ background:'rgba(255,255,255,0.04)' }}>
                <th style={{ textAlign:'left', padding:'7px 10px', color:'#475569', fontFamily:BC, fontSize:10, letterSpacing:1.5, textTransform:'uppercase', fontWeight:700, position:'sticky', left:0, background:'rgba(13,21,37,0.95)', minWidth:160 }}>Player</th>
                <th style={{ textAlign:'center', padding:'7px 6px', color:'#475569', fontFamily:BC, fontSize:10, letterSpacing:1, textTransform:'uppercase', fontWeight:700, minWidth:36 }}>DNP</th>
                {STAT_COLS.map(c => <th key={c.key} style={{ textAlign:'center', padding:'7px 6px', color:'#475569', fontFamily:BC, fontSize:10, letterSpacing:1, textTransform:'uppercase', fontWeight:700, minWidth:48 }}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={STAT_COLS.length+1} style={{ padding:14, textAlign:'center', color:'#475569', fontFamily:BC, letterSpacing:2, fontSize:11 }}>NO PLAYERS — pick a team or add one</td></tr>
              ) : rows.map((r, i) => {
                const matched = !!r.player_id || !r.player_name?.trim() || !!matchRosterId(r.player_name, rosterByTeam[team]||[])
                return (
                <tr key={i} style={{ borderTop:'1px solid rgba(255,255,255,0.04)', opacity: r.dnp ? 0.55 : 1 }}>
                  <td style={{ padding:'5px 8px', position:'sticky', left:0, background:'#0d1525' }}>
                    <input
                      value={r.player_name||''}
                      onChange={e=>setRowName(team, i, e.target.value)}
                      title={matched ? '' : 'No roster match — will save as a free-text name'}
                      style={{ width:'100%', background:'transparent', border:'none', color: matched ? '#f1f5f9' : '#fbbf24', fontFamily:B, fontSize:12, outline:'none' }}/>
                  </td>
                  <td style={{ padding:'5px 6px', textAlign:'center' }}>
                    <input type="checkbox" checked={!!r.dnp} onChange={e=>setRowDnp(team, i, e.target.checked)} style={{ cursor:'pointer' }}/>
                  </td>
                  {STAT_COLS.map(c => (
                    <td key={c.key} style={{ padding:'2px 4px', textAlign:'center' }}>
                      <input
                        type="number"
                        disabled={r.dnp}
                        value={r.dnp ? '' : (r[c.key] === 0 ? 0 : (r[c.key] ?? ''))}
                        onChange={e=>setRowField(team, i, c.key, e.target.value === '' ? 0 : Number(e.target.value))}
                        onFocus={e=>e.target.select()}
                        style={{ width:48, padding:'5px 4px', textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4, color:'#f1f5f9', fontFamily:B, fontSize:12, outline:'none', fontVariantNumeric:'tabular-nums' }}/>
                    </td>
                  ))}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <Card title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><BarChartIcon size={16}/> Game Stats</span>}>
      {loading ? (
        <div style={{ color:'#334155', fontFamily:BC, letterSpacing:2, fontSize:11, padding:24, textAlign:'center' }}>LOADING…</div>
      ) : (
        <>
          {saveError && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 12px', marginBottom:16, color:'#fca5a5', fontFamily:B, fontSize:12 }}>
              <div style={{ fontFamily:BC, fontWeight:700, fontSize:11, letterSpacing:1, textTransform:'uppercase', color:'#f87171', marginBottom:2 }}>Save failed</div>
              {saveError}
            </div>
          )}
          {parseError && (
            <div style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.3)', borderRadius:8, padding:'10px 12px', marginBottom:16, color:'#fde68a', fontFamily:B, fontSize:12 }}>
              <div style={{ fontFamily:BC, fontWeight:700, fontSize:11, letterSpacing:1, textTransform:'uppercase', color:'#fbbf24', marginBottom:2 }}>Image parse failed</div>
              {parseError}
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:16 }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={gameDate} onChange={e=>setGameDate(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Winning Team</label>
              <select value={winnerTeam} onChange={e=>setWinnerTeam(e.target.value)} style={inputStyle}>
                {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Losing Team</label>
              <select value={loserTeam} onChange={e=>setLoserTeam(e.target.value)} style={inputStyle}>
                {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Winning Score</label>
              <input type="number" value={winnerScore} onChange={e=>setWinnerScore(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Losing Score</label>
              <input type="number" value={loserScore} onChange={e=>setLoserScore(e.target.value)} style={inputStyle}/>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>Notes (optional)</label>
            <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Wolves trounce Kings, conf semifinals" style={inputStyle}/>
          </div>
          <TeamGrid team={winnerTeam}/>
          <TeamGrid team={loserTeam}/>
          <div style={{ display:'flex', gap:10, marginTop:12 }}>
            <button onClick={handleSave} disabled={saving} style={{ padding:'10px 22px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#f97316,#ef4444)', color:'#fff', fontFamily:BC, fontWeight:900, fontSize:13, letterSpacing:1, cursor:saving?'wait':'pointer', opacity:saving?0.6:1 }}>
              {saving ? 'Saving…' : (editId ? 'Save Changes' : 'Save Game')}
            </button>
            {editId && (
              <button onClick={resetForm} type="button" style={{ padding:'10px 18px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#94a3b8', fontFamily:BC, fontWeight:700, fontSize:12, letterSpacing:1, cursor:'pointer' }}>Cancel Edit</button>
            )}
          </div>

          <div style={{ marginTop:32 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:12, flexWrap:'wrap' }}>
              <div style={{ fontFamily:BC, fontWeight:900, fontSize:12, letterSpacing:2, color:'#475569', textTransform:'uppercase' }}>Discord Pending {pending.length>0 && <span style={{ color:'#a78bfa', marginLeft:6 }}>· {pending.length}</span>}</div>
              <button onClick={pullDiscord} disabled={pullingDiscord} style={{ padding:'6px 14px', borderRadius:7, border:'1px solid rgba(167,139,250,0.3)', background: pullingDiscord ? 'rgba(167,139,250,0.08)' : 'transparent', color:'#a78bfa', fontFamily:BC, fontSize:11, letterSpacing:1, cursor: pullingDiscord ? 'wait' : 'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
                <SyncIcon size={12} spinning={pullingDiscord}/>
                <span>{pullingDiscord ? 'Pulling…' : 'Pull Discord'}</span>
              </button>
            </div>
            {discordError && (
              <div style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.3)', borderRadius:8, padding:'10px 12px', marginBottom:12, color:'#fde68a', fontFamily:B, fontSize:12 }}>
                <div style={{ fontFamily:BC, fontWeight:700, fontSize:11, letterSpacing:1, textTransform:'uppercase', color:'#fbbf24', marginBottom:2 }}>Discord pull failed</div>
                {discordError}
              </div>
            )}
            {discordSummary && (
              <div style={{ fontFamily:BC, fontSize:11, letterSpacing:1, color:'#475569', textTransform:'uppercase', marginBottom:10 }}>
                Fetched {discordSummary.fetched} · Added {discordSummary.created} · Errors {discordSummary.errors}
                {discordSummary.retried ? <span> · Retried {discordSummary.retried}, recovered {discordSummary.recovered}</span> : null}
              </div>
            )}
            {pending.length === 0 ? (
              <div style={{ color:'#334155', fontFamily:BC, letterSpacing:2, fontSize:11, padding:14 }}>NO PENDING DISCORD POSTS</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:24 }}>
                {pending.map(p => (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    {p.image_url && (
                      <a href={p.image_url} target="_blank" rel="noopener noreferrer" style={{ display:'block', width:64, height:64, flexShrink:0, borderRadius:6, overflow:'hidden', background:'rgba(0,0,0,0.3)' }}>
                        <img src={p.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      </a>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:BC, fontSize:11, letterSpacing:1, color:'#94a3b8' }}>
                        {p.posted_at ? new Date(p.posted_at).toLocaleString() : 'unknown time'}
                        {p.team_hint && <span style={{ marginLeft:8, color:'#a78bfa' }}>· hint: {p.team_hint}</span>}
                        <span style={{ marginLeft:8, color:'#475569' }}>· {Array.isArray(p.parsed_rows)?p.parsed_rows.length:0} players</span>
                      </div>
                      {p.message_text && <div style={{ fontFamily:B, fontSize:12, color:'#475569', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:2 }}>{p.message_text}</div>}
                      {p.parse_error && <div style={{ fontFamily:B, fontSize:11, color:'#fbbf24', marginTop:2 }}>parse error: {p.parse_error.slice(0,200)}</div>}
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button onClick={()=>importPendingTo('winner', p)} disabled={!Array.isArray(p.parsed_rows) || !p.parsed_rows.length} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(96,165,250,0.3)', background:'transparent', color:'#60a5fa', fontFamily:BC, fontSize:11, cursor:'pointer' }}>Use as Winner</button>
                      <button onClick={()=>importPendingTo('loser', p)} disabled={!Array.isArray(p.parsed_rows) || !p.parsed_rows.length} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(96,165,250,0.3)', background:'transparent', color:'#60a5fa', fontFamily:BC, fontSize:11, cursor:'pointer' }}>Use as Loser</button>
                      <button onClick={()=>rejectPending(p)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)', background:'transparent', color:'#f87171', fontFamily:BC, fontSize:11, cursor:'pointer' }}>Discard</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontFamily:BC, fontWeight:900, fontSize:12, letterSpacing:2, color:'#475569', textTransform:'uppercase', marginBottom:10 }}>Recent Games</div>
            {recentGames.length === 0 ? (
              <div style={{ color:'#334155', fontFamily:BC, letterSpacing:2, fontSize:11, padding:14 }}>NO GAMES YET</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {recentGames.map(g => (
                  <div key={g.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontFamily:BC, fontWeight:700, fontSize:11, color:'#475569', minWidth:88 }}>{g.game_date || '—'}</div>
                    <div style={{ fontFamily:BC, fontWeight:800, fontSize:13, color:'#f1f5f9', flex:1, minWidth:0 }}>
                      {g.winner_team || '—'} {g.winner_score != null ? g.winner_score : '—'} – {g.loser_score != null ? g.loser_score : '—'} {g.loser_team || '—'}
                      {g.notes && <span style={{ marginLeft:10, fontFamily:B, fontSize:12, color:'#475569', fontWeight:400 }}>· {g.notes}</span>}
                    </div>
                    <button onClick={()=>startEdit(g)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#64748b', fontFamily:BC, fontSize:11, cursor:'pointer' }}>Edit</button>
                    <button onClick={()=>handleDelete(g.id)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)', background:'transparent', color:'#f87171', fontFamily:BC, fontSize:11, cursor:'pointer' }}>Del</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

// ── Main Portal ───────────────────────────────────────────────────────────────

export default function AdminPortal({ session, onLogout }) {
  const [tab, setTab]                   = useState('sync')
  const [syncStatus, setSyncStatus]     = useState(null)
  const [syncing, setSyncing]           = useState(false)
  const [syncTeam, setSyncTeam]         = useState('ALL')
  const [sync2kStatus, setSync2kStatus] = useState(null)
  const [syncing2k, setSyncing2k]       = useState(false)
  const [players, setPlayers]           = useState([])
  const [selectedTeam, setSelectedTeam] = useState('WAS')
  const [saving, setSaving]             = useState({})
  const [summaryData, setSummaryData]   = useState([])
  const [savingGM, setSavingGM]         = useState({})

  useEffect(() => { if (tab==='roster') loadRoster(selectedTeam) }, [tab, selectedTeam])
  useEffect(() => { if (tab==='gms')    loadSummary()            }, [tab])

  const loadRoster = async team => {
    const { data } = await supabase.from('roster').select('id,player_name,position,ovr,option_type').eq('team_abbr',team).order('id')
    setPlayers(data?.filter(p=>p.player_name&&!/^\d+\+?$/.test(p.player_name)&&p.player_name!=='Extension'&&p.player_name!=='Years in Service')||[])
  }
  const loadSummary = async () => {
    const { data } = await supabase.from('league_summary').select('*').order('team_abbr')
    setSummaryData(data||[])
  }
  const handleSync = async () => {
    setSyncing(true); setSyncStatus(null)
    const teams = syncTeam==='ALL'?TEAMS.join(','):syncTeam
    try {
      const res  = await fetch(`${SYNC_URL}?teams=${teams}`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:'{}'})
      const json = await res.json()
      setSyncStatus({ ok:json.results?.filter(r=>r.ok).length||0, fail:json.results?.filter(r=>!r.ok).length||0, results:json.results })
    } catch(e) { setSyncStatus({error:e.message}) }
    setSyncing(false)
  }
  const handleSync2k = async () => {
    setSyncing2k(true); setSync2kStatus(null)
    try {
      const qs = syncTeam === 'ALL' ? '' : `?team=${syncTeam}`
      const res = await fetch(`${SYNC_2K_URL}${qs}`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` }, body:'{}' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setSync2kStatus(json)
    } catch(e) { setSync2kStatus({ error: e.message }) }
    setSyncing2k(false)
  }
  const updateOptionType = async (id, value) => {
    setSaving(s=>({...s,[id]:true}))
    await supabase.from('roster').update({option_type:value||null}).eq('id',id)
    setSaving(s=>({...s,[id]:false}))
    loadRoster(selectedTeam)
  }
  const updateGM = async (teamAbbr, gm) => {
    setSavingGM(s=>({...s,[teamAbbr]:true}))
    await supabase.from('league_summary').update({gm}).eq('team_abbr',teamAbbr)
    setSavingGM(s=>({...s,[teamAbbr]:false}))
    loadSummary()
  }

  const TABS = [
    ['sync',   SyncIcon,      'Sync'],
    ['roster', ClipboardIcon, 'Options'],
    ['picks',  TargetIcon,    'Picks'],
    ['draft',  HourglassIcon, 'Draft'],
    ['stats',  BarChartIcon,  'Stats'],
    ['gms',    PersonIcon,    'GMs'],
  ]

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#070b12 0%,#0d1525 60%,#070b12 100%)', color:'#f1f5f9', fontFamily:B }}>
      <style>{`
        @media (max-width: 640px) {
          .admin-header { padding: 10px 14px !important; gap: 10px; flex-wrap: wrap; }
          .admin-header-brand-text { display: none; }
          .admin-header-actions a, .admin-header-actions button { padding: 6px 10px !important; font-size: 11px !important; }
          .admin-main { padding: 16px 12px !important; }
          .admin-tabs { flex-wrap: nowrap !important; overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; width: 100% !important; scrollbar-width: none; }
          .admin-tabs::-webkit-scrollbar { display: none; }
          .admin-tabs button { padding: 7px 12px !important; font-size: 11px !important; flex-shrink: 0; }
          .admin-card { padding: 16px !important; }
          .admin-card > div:first-child { font-size: 14px !important; margin-bottom: 12px !important; padding-bottom: 10px !important; }
        }
      `}</style>
      <div className="admin-header" style={{ background:'rgba(0,0,0,0.4)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#ef4444)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', flexShrink:0 }}><BasketballIcon size={18}/></div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontFamily:BC, fontWeight:900, fontSize:15, letterSpacing:1 }}>ADMIN PORTAL</div>
            <div className="admin-header-brand-text" style={{ fontFamily:BC, fontSize:9, letterSpacing:3, color:'#475569', textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session.user.email}</div>
          </div>
        </div>
        <div className="admin-header-actions" style={{ display:'flex', gap:8, flexShrink:0 }}>
          <a href="/" style={{ padding:'7px 14px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#94a3b8', textDecoration:'none', fontFamily:BC, fontWeight:700, fontSize:12, letterSpacing:1 }}>← View Site</a>
          <button onClick={onLogout} style={{ padding:'7px 14px', borderRadius:7, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer', fontFamily:BC, fontWeight:700, fontSize:12, letterSpacing:1 }}>Sign Out</button>
        </div>
      </div>

      <div className="admin-main" style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px' }}>
        <div className="admin-tabs" style={{ display:'flex', gap:3, background:'rgba(255,255,255,0.04)', borderRadius:9, padding:3, width:'fit-content', marginBottom:28 }}>
          {TABS.map(([key, Icon, label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{ padding:'8px 18px', borderRadius:7, border:'none', cursor:'pointer', fontFamily:BC, fontWeight:700, fontSize:12, letterSpacing:1, background:tab===key?'rgba(249,115,22,0.9)':'transparent', color:tab===key?'#fff':'#64748b', display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}><Icon size={13}/><span>{label}</span></button>
          ))}
        </div>

        {/* Sync */}
        {tab==='sync' && (
          <Card title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><SyncIcon size={16}/> Force Sync</span>}>
            <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
              <select value={syncTeam} onChange={e=>setSyncTeam(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#f1f5f9', fontFamily:B, fontSize:13, outline:'none' }}>
                <option value="ALL">All Teams</option>
                {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
              </select>
              <button onClick={handleSync} disabled={syncing} style={{ padding:'9px 24px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#f97316,#ef4444)', color:'#fff', fontFamily:BC, fontWeight:900, fontSize:13, letterSpacing:1, cursor:syncing?'wait':'pointer', opacity:syncing?0.7:1, display:'inline-flex', alignItems:'center', gap:8 }}>
                {syncing ? <><HourglassIcon size={14}/> <span>Syncing…</span></> : <><SyncIcon size={14}/> <span>Run Sync</span></>}
              </button>
            </div>
            <div style={{ fontSize:12, color:'#475569', fontFamily:BC, letterSpacing:1, marginBottom:16 }}>Data syncs automatically every hour. Use this to force an immediate update from the Google Sheet.</div>
            {syncStatus&&(
              <div style={{ background:syncStatus.error?'rgba(239,68,68,0.08)':'rgba(52,211,153,0.06)', border:`1px solid ${syncStatus.error?'rgba(239,68,68,0.2)':'rgba(52,211,153,0.2)'}`, borderRadius:10, padding:16, marginBottom:16 }}>
                {syncStatus.error?<div style={{ color:'#f87171', fontSize:13 }}>Error: {syncStatus.error}</div>:(
                  <>
                    <div style={{ fontFamily:BC, fontSize:14, color:'#34d399', marginBottom:10 }}>✓ {syncStatus.ok} team{syncStatus.ok!==1?'s':''} synced{syncStatus.fail>0?`, ${syncStatus.fail} failed`:''}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {syncStatus.results?.map(r=>(
                        <div key={r.team} style={{ display:'flex', gap:10, fontSize:12, fontFamily:BC }}>
                          <span style={{ color:r.ok?'#34d399':'#f87171', width:40 }}>{r.ok?'✓':'✗'} {r.team}</span>
                          <span style={{ color:'#475569' }}>{r.ok?`${r.players} players`:r.error}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:18, marginTop:6 }}>
              <div style={{ fontFamily:BC, fontWeight:800, fontSize:13, letterSpacing:1, color:'#f1f5f9', marginBottom:10 }}>2K Ratings (OVR)</div>
              <div style={{ fontSize:12, color:'#475569', fontFamily:BC, letterSpacing:1, marginBottom:14 }}>Scrapes overall ratings from 2kratings.com for the selected team(s) above and writes them to the public roster (overrides the sheet OVR).</div>
              <button onClick={handleSync2k} disabled={syncing2k}
                style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'#fff', fontFamily:BC, fontWeight:900, fontSize:13, letterSpacing:1, cursor:syncing2k?'wait':'pointer', opacity:syncing2k?0.7:1, display:'inline-flex', alignItems:'center', gap:8 }}>
                {syncing2k ? <><HourglassIcon size={14}/> <span>Syncing…</span></> : <><SyncIcon size={14}/> <span>Sync 2K Ratings</span></>}
              </button>
              {sync2kStatus && (
                <div style={{ marginTop:12, background: sync2kStatus.error?'rgba(239,68,68,0.08)':'rgba(59,130,246,0.06)', border:`1px solid ${sync2kStatus.error?'rgba(239,68,68,0.2)':'rgba(59,130,246,0.2)'}`, borderRadius:10, padding:14 }}>
                  {sync2kStatus.error ? (
                    <div style={{ color:'#f87171', fontSize:13 }}>Error: {sync2kStatus.error}</div>
                  ) : (
                    <>
                      <div style={{ fontFamily:BC, fontSize:13, color:'#93c5fd', marginBottom:8 }}>
                        Synced {sync2kStatus.synced}/{sync2kStatus.total} players{sync2kStatus.failed>0 ? ` · ${sync2kStatus.failed} failed` : ''}
                      </div>
                      {sync2kStatus.failedSample?.length > 0 && (
                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          {sync2kStatus.failedSample.map((r,i)=>(
                            <div key={i} style={{ fontSize:11, fontFamily:BC, color:'#f87171', letterSpacing:0.5 }}>
                              ✗ {r.team} · {r.name} · {r.reason || `HTTP ${r.status}`}
                            </div>
                          ))}
                          {sync2kStatus.failed > sync2kStatus.failedSample.length && (
                            <div style={{ fontSize:11, fontFamily:BC, color:'#475569' }}>… and {sync2kStatus.failed - sync2kStatus.failedSample.length} more</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Contract Options */}
        {tab==='roster' && (
          <Card title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><ClipboardIcon size={16}/> Player Contract Options</span>}>
            <div style={{ marginBottom:16 }}>
              <select value={selectedTeam} onChange={e=>setSelectedTeam(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#f1f5f9', fontFamily:B, fontSize:13, outline:'none' }}>
                {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
              </select>
            </div>
            <div style={{ fontSize:11, color:'#475569', fontFamily:BC, letterSpacing:1, marginBottom:16 }}>Set option type on the final real contract year. Leave blank for fully guaranteed.</div>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {players.map(p=>(
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 12px', borderRadius:8, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ fontWeight:600, fontSize:13, color:'#f1f5f9' }}>{p.player_name}</span>
                    {p.position&&<span style={{ marginLeft:8, fontSize:10, color:'#475569', fontFamily:BC, letterSpacing:1 }}>{p.position}</span>}
                  </div>
                  <select value={p.option_type||''} onChange={e=>updateOptionType(p.id,e.target.value)} disabled={saving[p.id]}
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'5px 10px', color:p.option_type?'#f1f5f9':'#475569', fontFamily:B, fontSize:12, outline:'none', opacity:saving[p.id]?0.5:1 }}>
                    <option value="">— Guaranteed</option>
                    <option value="TO">TO — Team Option</option>
                    <option value="2TO">2TO — 2-Year Team Option</option>
                    <option value="PO">PO — Player Option</option>
                    <option value="NG">NG — Non-Guaranteed</option>
                  </select>
                  {p.option_type&&<span style={{ fontSize:10, fontFamily:BC, letterSpacing:1, color:{TO:'#a78bfa','2TO':'#a78bfa',PO:'#34d399',NG:'#2dd4bf'}[p.option_type]||'#f1f5f9', fontWeight:700 }}>{p.option_type}</span>}
                </div>
              ))}
              {players.length===0&&<div style={{ color:'#334155', padding:24, textAlign:'center', fontFamily:BC, letterSpacing:2 }}>No roster data for this team</div>}
            </div>
          </Card>
        )}

        {/* Picks */}
        {tab==='picks' && <PicksTab />}

        {/* Draft */}
        {tab==='draft' && <DraftTab />}

        {/* Stats */}
        {tab==='stats' && <StatsTab />}

        {/* GMs */}
        {tab==='gms' && (
          <Card title={<span style={{display:'inline-flex',alignItems:'center',gap:8}}><PersonIcon size={16}/> GM Names</span>}>
            <div style={{ fontSize:11, color:'#475569', fontFamily:BC, letterSpacing:1, marginBottom:16 }}>Edit GM display names shown on team cards and roster pages.</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {summaryData.map(row=><GMRow key={row.team_abbr} row={row} saving={savingGM[row.team_abbr]} onSave={updateGM}/>)}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function GMRow({ row, saving, onSave }) {
  const [val, setVal]     = useState(row.gm||'')
  const [dirty, setDirty] = useState(false)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', borderRadius:8, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontFamily:BC, fontWeight:800, fontSize:13, color:'#64748b', width:36 }}>{row.team_abbr}</div>
      <input value={val} onChange={e=>{setVal(e.target.value);setDirty(true)}}
        style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'7px 10px', color:'#f1f5f9', fontFamily:B, fontSize:13, outline:'none' }}/>
      {dirty&&<button onClick={()=>{onSave(row.team_abbr,val);setDirty(false)}} disabled={saving}
        style={{ padding:'6px 14px', borderRadius:6, border:'none', background:'rgba(52,211,153,0.15)', color:'#34d399', fontFamily:BC, fontWeight:700, fontSize:11, letterSpacing:1, cursor:saving?'wait':'pointer', opacity:saving?0.6:1 }}>
        {saving?'…':'SAVE'}
      </button>}
    </div>
  )
}
