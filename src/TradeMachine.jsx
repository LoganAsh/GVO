import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { getTheme } from './theme'
import { capStatus, fmtMoney, payrollFromRoster } from './cap'

const BC = "'Barlow Condensed', sans-serif"
const B  = "'Barlow', sans-serif"

const TEAMS = ["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"]
const FULL = {ATL:"Atlanta Hawks",BOS:"Boston Celtics",BKN:"Brooklyn Nets",CHA:"Charlotte Hornets",CHI:"Chicago Bulls",CLE:"Cleveland Cavaliers",DAL:"Dallas Mavericks",DEN:"Denver Nuggets",DET:"Detroit Pistons",GSW:"Golden State Warriors",HOU:"Houston Rockets",IND:"Indiana Pacers",LAC:"LA Clippers",LAL:"LA Lakers",MEM:"Memphis Grizzlies",MIA:"Miami Heat",MIL:"Milwaukee Bucks",MIN:"Minnesota Timberwolves",NOP:"New Orleans Pelicans",NYK:"New York Knicks",OKC:"OKC Thunder",ORL:"Orlando Magic",PHI:"Philadelphia 76ers",PHX:"Phoenix Suns",POR:"Portland Trail Blazers",SAC:"Sacramento Kings",SAS:"San Antonio Spurs",TOR:"Toronto Raptors",UTA:"Utah Jazz",WAS:"Washington Wizards"}
const CLR = {ATL:"#E03A3E",BOS:"#007A33",BKN:"#888",CHA:"#1D1160",CHI:"#CE1141",CLE:"#860038",DAL:"#00538C",DEN:"#0E2240",DET:"#C8102E",GSW:"#1D428A",HOU:"#CE1141",IND:"#002D62",LAC:"#C8102E",LAL:"#552583",MEM:"#5D76A9",MIA:"#98002E",MIL:"#00471B",MIN:"#0C2340",NOP:"#0C2340",NYK:"#006BB6",OKC:"#007AC1",ORL:"#0077C0",PHI:"#006BB6",PHX:"#1D1160",POR:"#E03A3E",SAC:"#5A2D81",SAS:"#666",TOR:"#CE1141",UTA:"#002B5C",WAS:"#002B5C"}

function StatusPill({ payroll, theme }) {
  const t = getTheme(theme)
  const s = capStatus(payroll)
  return (
    <span style={{ background: s.color + '22', color: s.color, borderRadius: 6, padding: '3px 10px', fontFamily: BC, fontWeight: 700, fontSize: 11, letterSpacing: 1, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function PlayerRow({ player, side, onToggle, theme }) {
  const t = getTheme(theme)
  return (
    <button onClick={() => onToggle(player)} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7,
      background: side === 'sending' ? 'rgba(249,115,22,0.10)' : 'transparent',
      border: side === 'sending' ? '1px solid rgba(249,115,22,0.35)' : `1px solid ${t.border}`,
      cursor: 'pointer', textAlign: 'left', width: '100%',
    }}>
      <span style={{ flex: 1, minWidth: 0, color: t.tableText, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: B }}>
        {player.player_name}
        {player.position && <span style={{ marginLeft: 6, fontFamily: BC, fontSize: 10, color: t.tableTextSubtle, letterSpacing: 1 }}>{player.position}</span>}
      </span>
      <span style={{ color: t.tableTextMuted, fontFamily: BC, fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {fmtMoney(player.salary_yr1)}
      </span>
    </button>
  )
}

function TeamPanel({ team, setTeam, roster, sending, onToggle, incoming, otherTeam, theme }) {
  const t = getTheme(theme)
  const color = CLR[team] || '#475569'
  const currentPayroll = useMemo(() => payrollFromRoster(roster), [roster])
  const outgoingTotal = useMemo(() => sending.reduce((s, p) => s + (p.salary_yr1 || 0), 0), [sending])
  const incomingTotal = useMemo(() => incoming.reduce((s, p) => s + (p.salary_yr1 || 0), 0), [incoming])
  const newPayroll = currentPayroll - outgoingTotal + incomingTotal
  const delta = newPayroll - currentPayroll

  const sentIds = new Set(sending.map(p => p.id))
  const otherRosterIds = new Set(roster.map(p => p.id))

  return (
    <div style={{ background: t.tableBg, border: `1px solid ${t.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', minHeight: 420 }}>
      <div style={{ padding: '10px 14px', background: t.tableSectionBg, borderBottom: `1px solid ${t.tableLine}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 7, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: BC, fontWeight: 900, fontSize: 11, letterSpacing: 1, flexShrink: 0 }}>{team}</div>
        <select value={team} onChange={e => setTeam(e.target.value)} style={{ flex: 1, background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 7, padding: '7px 10px', color: t.text, fontFamily: B, fontSize: 13, outline: 'none' }}
          disabled={otherTeam ? false : false}>
          {TEAMS.filter(x => x !== otherTeam).map(x => <option key={x} value={x}>{x} — {FULL[x]}</option>)}
        </select>
      </div>

      {/* Cap status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px', borderBottom: `1px solid ${t.tableLine}`, background: t.tableHeaderBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: BC, fontSize: 10, letterSpacing: 2, color: t.tableTextSubtle, textTransform: 'uppercase' }}>Current Payroll</span>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: t.tableText, fontFamily: BC, fontWeight: 800, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(currentPayroll)}</span>
            <StatusPill payroll={currentPayroll} theme={theme} />
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: BC, fontSize: 10, letterSpacing: 2, color: t.tableTextSubtle, textTransform: 'uppercase' }}>After Trade</span>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: t.tableText, fontFamily: BC, fontWeight: 800, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              {fmtMoney(newPayroll)}
              {delta !== 0 && (
                <span style={{ marginLeft: 6, color: delta > 0 ? '#fb923c' : '#34d399', fontWeight: 700, fontSize: 11 }}>
                  ({delta > 0 ? '+' : ''}{fmtMoney(delta)})
                </span>
              )}
            </span>
            <StatusPill payroll={newPayroll} theme={theme} />
          </span>
        </div>
      </div>

      {/* Sending column */}
      {sending.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.tableLine}` }}>
          <div style={{ fontFamily: BC, fontSize: 10, letterSpacing: 2, color: '#f97316', textTransform: 'uppercase', marginBottom: 6, fontWeight: 800 }}>
            Sending ({fmtMoney(outgoingTotal)})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sending.map(p => <PlayerRow key={p.id} player={p} side="sending" onToggle={onToggle} theme={theme} />)}
          </div>
        </div>
      )}

      {/* Incoming column (from other team) */}
      {incoming.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.tableLine}`, background: 'rgba(52,211,153,0.05)' }}>
          <div style={{ fontFamily: BC, fontSize: 10, letterSpacing: 2, color: '#34d399', textTransform: 'uppercase', marginBottom: 6, fontWeight: 800 }}>
            Receiving ({fmtMoney(incomingTotal)})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {incoming.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.35)' }}>
                <span style={{ flex: 1, minWidth: 0, color: t.tableText, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: B }}>
                  {p.player_name}
                  {p.position && <span style={{ marginLeft: 6, fontFamily: BC, fontSize: 10, color: t.tableTextSubtle, letterSpacing: 1 }}>{p.position}</span>}
                </span>
                <span style={{ color: t.tableTextMuted, fontFamily: BC, fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {fmtMoney(p.salary_yr1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roster */}
      <div style={{ padding: '10px 14px', flex: 1, overflowY: 'auto', maxHeight: 420 }}>
        <div style={{ fontFamily: BC, fontSize: 10, letterSpacing: 2, color: t.tableTextSubtle, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>
          Roster
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {roster.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: t.tableTextSubtle, fontFamily: BC, fontSize: 12, letterSpacing: 1 }}>NO ROSTER</div>
          ) : roster.map(p => (
            <PlayerRow key={p.id} player={p} side={sentIds.has(p.id) ? 'sending' : 'idle'} onToggle={onToggle} theme={theme} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TradeMachine({ theme = 'dark' }) {
  const t = getTheme(theme)
  const [teamA, setTeamA] = useState('LAL')
  const [teamB, setTeamB] = useState('BOS')
  const [rostersByTeam, setRostersByTeam] = useState({})
  const [loading, setLoading] = useState(true)
  // sendingA = players A is trading to B; sendingB = players B is trading to A
  const [sendingA, setSendingA] = useState([])
  const [sendingB, setSendingB] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('roster')
        .select('id,team_abbr,player_name,position,ovr,salary_yr1,option_type')
        .order('id')
      if (cancelled) return
      const byTeam = {}
      for (const row of data || []) {
        if (!row.team_abbr || !row.player_name) continue
        if (!byTeam[row.team_abbr]) byTeam[row.team_abbr] = []
        byTeam[row.team_abbr].push(row)
      }
      setRostersByTeam(byTeam)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Reset sending whenever a team changes so we don't carry over stale ids.
  useEffect(() => { setSendingA([]) }, [teamA])
  useEffect(() => { setSendingB([]) }, [teamB])

  const rosterA = rostersByTeam[teamA] || []
  const rosterB = rostersByTeam[teamB] || []

  const toggleA = (player) => {
    setSendingA(arr => arr.find(x => x.id === player.id) ? arr.filter(x => x.id !== player.id) : [...arr, player])
  }
  const toggleB = (player) => {
    setSendingB(arr => arr.find(x => x.id === player.id) ? arr.filter(x => x.id !== player.id) : [...arr, player])
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: t.tableTextSubtle, fontFamily: BC, letterSpacing: 2, fontSize: 12 }}>LOADING ROSTERS…</div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
      <TeamPanel team={teamA} setTeam={setTeamA} roster={rosterA} sending={sendingA} onToggle={toggleA} incoming={sendingB} otherTeam={teamB} theme={theme} />
      <TeamPanel team={teamB} setTeam={setTeamB} roster={rosterB} sending={sendingB} onToggle={toggleB} incoming={sendingA} otherTeam={teamA} theme={theme} />
    </div>
  )
}
