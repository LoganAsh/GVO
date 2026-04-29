import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const BC = "'Barlow Condensed', sans-serif"
const B = "'Barlow', sans-serif"

const TEAMS = ["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"]
const FULL = {ATL:"Atlanta Hawks",BOS:"Boston Celtics",BKN:"Brooklyn Nets",CHA:"Charlotte Hornets",CHI:"Chicago Bulls",CLE:"Cleveland Cavaliers",DAL:"Dallas Mavericks",DEN:"Denver Nuggets",DET:"Detroit Pistons",GSW:"Golden State Warriors",HOU:"Houston Rockets",IND:"Indiana Pacers",LAC:"LA Clippers",LAL:"LA Lakers",MEM:"Memphis Grizzlies",MIA:"Miami Heat",MIL:"Milwaukee Bucks",MIN:"Minnesota Timberwolves",NOP:"New Orleans Pelicans",NYK:"New York Knicks",OKC:"OKC Thunder",ORL:"Orlando Magic",PHI:"Philadelphia 76ers",PHX:"Phoenix Suns",POR:"Portland Trail Blazers",SAC:"Sacramento Kings",SAS:"San Antonio Spurs",TOR:"Toronto Raptors",UTA:"Utah Jazz",WAS:"Washington Wizards"}

const SYNC_URL = 'https://vdbrbtuidsfftgotmlol.supabase.co/functions/v1/sync-league-data'

function Card({ title, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <div style={{ fontFamily: BC, fontWeight: 800, fontSize: 16, letterSpacing: 1, color: '#f1f5f9', marginBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

export default function AdminPortal({ session, onLogout }) {
  const [tab, setTab] = useState('sync')
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncTeam, setSyncTeam] = useState('ALL')
  const [players, setPlayers] = useState([])
  const [selectedTeam, setSelectedTeam] = useState('WAS')
  const [saving, setSaving] = useState({})
  const [summaryData, setSummaryData] = useState([])
  const [savingGM, setSavingGM] = useState({})

  useEffect(() => { if (tab === 'roster') loadRoster(selectedTeam) }, [tab, selectedTeam])
  useEffect(() => { if (tab === 'gms') loadSummary() }, [tab])

  const loadRoster = async (team) => {
    const { data } = await supabase.from('roster').select('id,player_name,position,ovr,option_type').eq('team_abbr', team).order('id')
    setPlayers(data?.filter(p => p.player_name && !/^\d+\+?$/.test(p.player_name) && p.player_name !== 'Extension' && p.player_name !== 'Years in Service') || [])
  }

  const loadSummary = async () => {
    const { data } = await supabase.from('league_summary').select('*').order('team_abbr')
    setSummaryData(data || [])
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncStatus(null)
    const teams = syncTeam === 'ALL' ? TEAMS.join(',') : syncTeam
    try {
      const res = await fetch(`${SYNC_URL}?teams=${teams}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: '{}' })
      const json = await res.json()
      const ok = json.results?.filter(r => r.ok).length || 0
      const fail = json.results?.filter(r => !r.ok).length || 0
      setSyncStatus({ ok, fail, results: json.results })
    } catch (e) {
      setSyncStatus({ error: e.message })
    }
    setSyncing(false)
  }

  const updateOptionType = async (id, value) => {
    setSaving(s => ({ ...s, [id]: true }))
    await supabase.from('roster').update({ option_type: value || null }).eq('id', id)
    setSaving(s => ({ ...s, [id]: false }))
    loadRoster(selectedTeam)
  }

  const updateGM = async (teamAbbr, gm) => {
    setSavingGM(s => ({ ...s, [teamAbbr]: true }))
    await supabase.from('league_summary').update({ gm }).eq('team_abbr', teamAbbr)
    setSavingGM(s => ({ ...s, [teamAbbr]: false }))
    loadSummary()
  }

  const TABS = [['sync','🔄 Sync'],['roster','📋 Options'],['gms','👤 GMs']]

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#070b12 0%,#0d1525 60%,#070b12 100%)', color: '#f1f5f9', fontFamily: B }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🏀</div>
          <div>
            <div style={{ fontFamily: BC, fontWeight: 900, fontSize: 15, letterSpacing: 1 }}>ADMIN PORTAL</div>
            <div style={{ fontFamily: BC, fontSize: 9, letterSpacing: 3, color: '#475569', textTransform: 'uppercase' }}>{session.user.email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/" style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', textDecoration: 'none', fontFamily: BC, fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>← View Site</a>
          <button onClick={onLogout} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', fontFamily: BC, fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: 3, width: 'fit-content', marginBottom: 28 }}>
          {TABS.map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: BC, fontWeight: 700, fontSize: 12, letterSpacing: 1, background: tab === t ? 'rgba(249,115,22,0.9)' : 'transparent', color: tab === t ? '#fff' : '#64748b' }}>{l}</button>
          ))}
        </div>

        {/* Sync Tab */}
        {tab === 'sync' && (
          <Card title="🔄 Force Sync">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
              <select value={syncTeam} onChange={e => setSyncTeam(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontFamily: B, fontSize: 13, outline: 'none' }}>
                <option value="ALL">All Teams</option>
                {TEAMS.map(t => <option key={t} value={t}>{t} — {FULL[t]}</option>)}
              </select>
              <button onClick={handleSync} disabled={syncing} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f97316,#ef4444)', color: '#fff', fontFamily: BC, fontWeight: 900, fontSize: 13, letterSpacing: 1, cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.7 : 1 }}>
                {syncing ? '⏳ Syncing…' : '🔄 Run Sync'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#475569', fontFamily: BC, letterSpacing: 1, marginBottom: 16 }}>
              Data syncs automatically every hour. Use this to force an immediate update from the Google Sheet.
            </div>
            {syncStatus && (
              <div style={{ background: syncStatus.error ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.06)', border: `1px solid ${syncStatus.error ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}`, borderRadius: 10, padding: 16 }}>
                {syncStatus.error ? (
                  <div style={{ color: '#f87171', fontSize: 13 }}>Error: {syncStatus.error}</div>
                ) : (
                  <>
                    <div style={{ fontFamily: BC, fontSize: 14, color: '#34d399', marginBottom: 10 }}>✓ {syncStatus.ok} team{syncStatus.ok !== 1 ? 's' : ''} synced{syncStatus.fail > 0 ? `, ${syncStatus.fail} failed` : ''}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {syncStatus.results?.map(r => (
                        <div key={r.team} style={{ display: 'flex', gap: 10, fontSize: 12, fontFamily: BC }}>
                          <span style={{ color: r.ok ? '#34d399' : '#f87171', width: 40 }}>{r.ok ? '✓' : '✗'} {r.team}</span>
                          <span style={{ color: '#475569' }}>{r.ok ? `${r.players} players` : r.error}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Option Types Tab */}
        {tab === 'roster' && (
          <Card title="📋 Player Contract Options">
            <div style={{ marginBottom: 16 }}>
              <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontFamily: B, fontSize: 13, outline: 'none' }}>
                {TEAMS.map(t => <option key={t} value={t}>{t} — {FULL[t]}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 11, color: '#475569', fontFamily: BC, letterSpacing: 1, marginBottom: 16 }}>
              Set option type on the final real contract year. Leave blank for fully guaranteed.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {players.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{p.player_name}</span>
                    {p.position && <span style={{ marginLeft: 8, fontSize: 10, color: '#475569', fontFamily: BC, letterSpacing: 1 }}>{p.position}</span>}
                  </div>
                  <select
                    value={p.option_type || ''}
                    onChange={e => updateOptionType(p.id, e.target.value)}
                    disabled={saving[p.id]}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', color: p.option_type ? '#f1f5f9' : '#475569', fontFamily: B, fontSize: 12, outline: 'none', opacity: saving[p.id] ? 0.5 : 1 }}>
                    <option value="">— Guaranteed</option>
                    <option value="TO">TO — Team Option</option>
                    <option value="2TO">2TO — 2-Year Team Option</option>
                    <option value="PO">PO — Player Option</option>
                    <option value="NG">NG — Non-Guaranteed</option>
                  </select>
                  {p.option_type && (
                    <span style={{ fontSize: 10, fontFamily: BC, letterSpacing: 1, color: { TO: '#a78bfa', '2TO': '#a78bfa', PO: '#34d399', NG: '#2dd4bf' }[p.option_type] || '#f1f5f9', fontWeight: 700 }}>{p.option_type}</span>
                  )}
                </div>
              ))}
              {players.length === 0 && <div style={{ color: '#334155', padding: 24, textAlign: 'center', fontFamily: BC, letterSpacing: 2 }}>No roster data for this team</div>}
            </div>
          </Card>
        )}

        {/* GMs Tab */}
        {tab === 'gms' && (
          <Card title="👤 GM Names">
            <div style={{ fontSize: 11, color: '#475569', fontFamily: BC, letterSpacing: 1, marginBottom: 16 }}>
              Edit GM display names shown on team cards and roster pages.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {summaryData.map(row => (
                <GMRow key={row.team_abbr} row={row} saving={savingGM[row.team_abbr]} onSave={updateGM} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function GMRow({ row, saving, onSave }) {
  const [val, setVal] = useState(row.gm || '')
  const [dirty, setDirty] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 13, color: '#64748b', width: 36 }}>{row.team_abbr}</div>
      <input
        value={val}
        onChange={e => { setVal(e.target.value); setDirty(true) }}
        style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '7px 10px', color: '#f1f5f9', fontFamily: "'Barlow',sans-serif", fontSize: 13, outline: 'none' }}
      />
      {dirty && (
        <button onClick={() => { onSave(row.team_abbr, val); setDirty(false) }} disabled={saving}
          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'rgba(52,211,153,0.15)', color: '#34d399', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 1, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? '…' : 'SAVE'}
        </button>
      )}
    </div>
  )
}
