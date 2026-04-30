import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const BC = "'Barlow Condensed', sans-serif"
const B  = "'Barlow', sans-serif"

const TEAMS = ["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"]
const FULL  = {ATL:"Atlanta Hawks",BOS:"Boston Celtics",BKN:"Brooklyn Nets",CHA:"Charlotte Hornets",CHI:"Chicago Bulls",CLE:"Cleveland Cavaliers",DAL:"Dallas Mavericks",DEN:"Denver Nuggets",DET:"Detroit Pistons",GSW:"Golden State Warriors",HOU:"Houston Rockets",IND:"Indiana Pacers",LAC:"LA Clippers",LAL:"LA Lakers",MEM:"Memphis Grizzlies",MIA:"Miami Heat",MIL:"Milwaukee Bucks",MIN:"Minnesota Timberwolves",NOP:"New Orleans Pelicans",NYK:"New York Knicks",OKC:"OKC Thunder",ORL:"Orlando Magic",PHI:"Philadelphia 76ers",PHX:"Phoenix Suns",POR:"Portland Trail Blazers",SAC:"Sacramento Kings",SAS:"San Antonio Spurs",TOR:"Toronto Raptors",UTA:"Utah Jazz",WAS:"Washington Wizards"}
const SYNC_URL = 'https://vdbrbtuidsfftgotmlol.supabase.co/functions/v1/sync-league-data'

const inputStyle  = { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#f1f5f9', fontFamily:B, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }
const labelStyle  = { fontFamily:BC, fontSize:10, letterSpacing:2, color:'#475569', textTransform:'uppercase', display:'block', marginBottom:5 }

function Card({ title, children }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:24, marginBottom:20 }}>
      <div style={{ fontFamily:BC, fontWeight:800, fontSize:16, letterSpacing:1, color:'#f1f5f9', marginBottom:18, borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:12 }}>{title}</div>
      {children}
    </div>
  )
}

// ── Picks Tab ─────────────────────────────────────────────────────────────────

const EMPTY_PICK = { year: new Date().getFullYear()+1, round:1, pick_type:'own', original_team:'ATL', owned_by:'ATL', swap_teams:[], swap_direction:'best', protection:'', notes:'' }

function PicksTab() {
  const [picks, setPicks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [form, setForm]           = useState(EMPTY_PICK)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [filterTeam, setFilter]   = useState('ALL')

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
  const openEdit = p  => { setForm({ year:p.year, round:p.round, pick_type:p.pick_type, original_team:p.original_team, owned_by:p.owned_by, swap_teams:p.swap_teams||[], swap_direction:p.swap_direction||'best', protection:p.protection||'', notes:p.notes||'' }); setEditId(p.id); setSaveError(null); setShowForm(true) }

  const handleSave = async () => {
    setSaving(true); setSaveError(null)
    const isSwap = form.pick_type !== 'own'
    const payload = {
      year: Number(form.year), round: Number(form.round),
      pick_type: form.pick_type,
      original_team: form.original_team,
      owned_by: form.owned_by,
      swap_teams: isSwap ? form.swap_teams : null,
      swap_direction: isSwap ? form.swap_direction : null,
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

  const visible = picks.filter(p => filterTeam === 'ALL' || p.owned_by === filterTeam || p.original_team === filterTeam || (p.swap_teams||[]).includes(filterTeam))
  const typeLabel = { own:'Owns', swap:'Swap', multi_swap:'Multi-Swap' }

  return (
    <>
      <Card title="🎯 Draft Pick Tracker">
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
          <select value={filterTeam} onChange={e=>setFilter(e.target.value)} style={{ ...inputStyle, width:'auto' }}>
            <option value="ALL">All Teams</option>
            {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
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
                    {p.pick_type==='own' ? (
                      <span style={{ fontFamily:BC, fontSize:12, color:'#94a3b8' }}>{p.original_team}{p.original_team!==p.owned_by?` → ${p.owned_by}`:' (own)'}</span>
                    ) : (
                      <span style={{ fontFamily:BC, fontSize:12, color:'#94a3b8' }}>{(p.swap_teams||[]).join(' ⇄ ')} · {p.owned_by} takes {p.swap_direction}</span>
                    )}
                    {p.protection&&<span style={{ fontFamily:BC, fontSize:10, color:'#f97316', background:'rgba(249,115,22,0.1)', borderRadius:4, padding:'1px 6px' }}>🔒 {p.protection}</span>}
                  </div>
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
                  <div style={{ display:'flex', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <label style={labelStyle}>Who Gets The Pick</label>
                      <select value={form.owned_by} onChange={e=>set('owned_by',e.target.value)} style={inputStyle}>
                        {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
                      </select>
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={labelStyle}>Takes Which Pick</label>
                      <select value={form.swap_direction} onChange={e=>set('swap_direction',e.target.value)} style={inputStyle}>
                        <option value="best">Best (highest)</option>
                        {form.pick_type==='multi_swap' && <option value="second_best">Takes 2nd Best</option>}
                        <option value="worst">Worst (lowest)</option>
                      </select>
                    </div>
                  </div>
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

// ── Main Portal ───────────────────────────────────────────────────────────────

export default function AdminPortal({ session, onLogout }) {
  const [tab, setTab]                   = useState('sync')
  const [syncStatus, setSyncStatus]     = useState(null)
  const [syncing, setSyncing]           = useState(false)
  const [syncTeam, setSyncTeam]         = useState('ALL')
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

  const TABS = [['sync','🔄 Sync'],['roster','📋 Options'],['picks','🎯 Picks'],['gms','👤 GMs']]

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#070b12 0%,#0d1525 60%,#070b12 100%)', color:'#f1f5f9', fontFamily:B }}>
      <div style={{ background:'rgba(0,0,0,0.4)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#ef4444)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>🏀</div>
          <div>
            <div style={{ fontFamily:BC, fontWeight:900, fontSize:15, letterSpacing:1 }}>ADMIN PORTAL</div>
            <div style={{ fontFamily:BC, fontSize:9, letterSpacing:3, color:'#475569', textTransform:'uppercase' }}>{session.user.email}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <a href="/" style={{ padding:'7px 14px', borderRadius:7, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#94a3b8', textDecoration:'none', fontFamily:BC, fontWeight:700, fontSize:12, letterSpacing:1 }}>← View Site</a>
          <button onClick={onLogout} style={{ padding:'7px 14px', borderRadius:7, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer', fontFamily:BC, fontWeight:700, fontSize:12, letterSpacing:1 }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px' }}>
        <div style={{ display:'flex', gap:3, background:'rgba(255,255,255,0.04)', borderRadius:9, padding:3, width:'fit-content', marginBottom:28 }}>
          {TABS.map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{ padding:'8px 18px', borderRadius:7, border:'none', cursor:'pointer', fontFamily:BC, fontWeight:700, fontSize:12, letterSpacing:1, background:tab===t?'rgba(249,115,22,0.9)':'transparent', color:tab===t?'#fff':'#64748b' }}>{l}</button>
          ))}
        </div>

        {/* Sync */}
        {tab==='sync' && (
          <Card title="🔄 Force Sync">
            <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
              <select value={syncTeam} onChange={e=>setSyncTeam(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#f1f5f9', fontFamily:B, fontSize:13, outline:'none' }}>
                <option value="ALL">All Teams</option>
                {TEAMS.map(t=><option key={t} value={t}>{t} — {FULL[t]}</option>)}
              </select>
              <button onClick={handleSync} disabled={syncing} style={{ padding:'9px 24px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#f97316,#ef4444)', color:'#fff', fontFamily:BC, fontWeight:900, fontSize:13, letterSpacing:1, cursor:syncing?'wait':'pointer', opacity:syncing?0.7:1 }}>
                {syncing?'⏳ Syncing…':'🔄 Run Sync'}
              </button>
            </div>
            <div style={{ fontSize:12, color:'#475569', fontFamily:BC, letterSpacing:1, marginBottom:16 }}>Data syncs automatically every hour. Use this to force an immediate update from the Google Sheet.</div>
            {syncStatus&&(
              <div style={{ background:syncStatus.error?'rgba(239,68,68,0.08)':'rgba(52,211,153,0.06)', border:`1px solid ${syncStatus.error?'rgba(239,68,68,0.2)':'rgba(52,211,153,0.2)'}`, borderRadius:10, padding:16 }}>
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
          </Card>
        )}

        {/* Contract Options */}
        {tab==='roster' && (
          <Card title="📋 Player Contract Options">
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

        {/* GMs */}
        {tab==='gms' && (
          <Card title="👤 GM Names">
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
