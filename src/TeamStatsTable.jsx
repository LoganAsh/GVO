import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { getTheme } from './theme'

const BC = "'Barlow Condensed', sans-serif"
const B  = "'Barlow', sans-serif"

const STAT_COLS = [
  { key:'min',      label:'MIN' },
  { key:'pts',      label:'PTS' },
  { key:'reb',      label:'REB' },
  { key:'ast',      label:'AST' },
  { key:'stl',      label:'STL' },
  { key:'blk',      label:'BLK' },
  { key:'tov',      label:'TO'  },
]
const PCT_COLS = [
  { num:'fgm',      den:'fga',      label:'FG%' },
  { num:'three_pm', den:'three_pa', label:'3P%' },
  { num:'ftm',      den:'fta',      label:'FT%' },
]
const fmtPct = (n, d) => (!d ? '—' : `${((n/d)*100).toFixed(1)}%`)
const fmtAvg = v => (v == null ? '—' : (Math.round(v*10)/10).toFixed(1))

export default function TeamStatsTable({ teamAbbr, theme = "dark" }) {
  const t = getTheme(theme)
  const [rows, setRows]     = useState([])
  const [games, setGames]   = useState({})
  const [loading, setLoading] = useState(true)
  const [openGames, setOpenGames] = useState(() => new Set())

  // Reset which games are expanded whenever we switch teams.
  useEffect(() => { setOpenGames(new Set()) }, [teamAbbr])
  const toggleGame = (id) => setOpenGames(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  useEffect(() => { load() }, [teamAbbr])

  const load = async () => {
    setLoading(true)
    const { data: stats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('team_abbr', teamAbbr)
      .order('id', { ascending: false })
    const gameIds = Array.from(new Set((stats || []).map(s => s.game_id).filter(Boolean)))
    let gameMap = {}
    if (gameIds.length) {
      const { data: gs } = await supabase.from('games').select('*').in('id', gameIds)
      for (const g of gs || []) gameMap[g.id] = g
    }
    setRows(stats || [])
    setGames(gameMap)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:t.tableTextVeryMuted, fontFamily:BC, letterSpacing:2, fontSize:12, background:t.tableBg }}>LOADING STATS…</div>
  )
  if (!rows.length) return (
    <div style={{ padding:48, textAlign:'center', color:t.tableTextSubtle, background:t.tableBg }}>
      <div style={{ fontSize:28, marginBottom:8 }}>📊</div>
      <div style={{ fontFamily:BC, letterSpacing:2, fontSize:13 }}>NO GAMES LOGGED</div>
      <div style={{ fontSize:12, marginTop:6, color:t.tableTextVeryMuted }}>Add games via the Admin Portal Stats tab</div>
    </div>
  )

  // Group rows by player to compute season averages. DNP rows don't count as a played game.
  const byPlayer = {}
  for (const r of rows) {
    if (r.dnp) continue
    const key = r.player_id ?? `name:${r.player_name}`
    if (!byPlayer[key]) byPlayer[key] = { player_name: r.player_name, player_id: r.player_id, games: 0 }
    const p = byPlayer[key]
    p.games += 1
    for (const c of STAT_COLS) p[c.key] = (p[c.key]||0) + (r[c.key]||0)
    for (const c of PCT_COLS) {
      p[c.num] = (p[c.num]||0) + (r[c.num]||0)
      p[c.den] = (p[c.den]||0) + (r[c.den]||0)
    }
  }
  const playerAvgs = Object.values(byPlayer).sort((a,b) => (b.pts/b.games) - (a.pts/a.games))

  // Game log: most recent game first; rows are already ordered by id desc per game
  const gameOrder = Array.from(new Set(rows.map(r => r.game_id).filter(Boolean)))
  const gameRows = gameOrder.map(gid => ({
    game: games[gid],
    rows: rows.filter(r => r.game_id === gid),
  }))

  return (
    <div style={{ overflowX:'auto', background:t.tableBg }}>
      {/* Season averages */}
      <div style={{ padding:'10px 14px', background:t.tableSectionBg, borderBottom:`1px solid ${t.tableLine}`, fontFamily:BC, fontWeight:900, fontSize:11, letterSpacing:3, color:t.tableTextSubtle, textTransform:'uppercase' }}>Season Averages</div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${t.tableLine}` }}>
            <th style={{ textAlign:'left', padding:'8px 12px', color:t.tableTextSubtle, fontFamily:BC, fontSize:10, letterSpacing:2, textTransform:'uppercase', fontWeight:700 }}>Player</th>
            <th style={{ textAlign:'center', padding:'8px 6px', color:t.tableTextSubtle, fontFamily:BC, fontSize:10, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>GP</th>
            {STAT_COLS.map(c => <th key={c.key} style={{ textAlign:'center', padding:'8px 6px', color:t.tableTextSubtle, fontFamily:BC, fontSize:10, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>{c.label}</th>)}
            {PCT_COLS.map(c => <th key={c.label} style={{ textAlign:'center', padding:'8px 6px', color:t.tableTextSubtle, fontFamily:BC, fontSize:10, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {playerAvgs.map((p, i) => (
            <tr key={i} style={{ borderBottom:`1px solid ${t.tableLine}` }}>
              <td style={{ padding:'8px 12px', color:t.tableText, fontWeight:600, whiteSpace:'nowrap' }}>{p.player_name}</td>
              <td style={{ padding:'8px 6px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{p.games}</td>
              {STAT_COLS.map(c => (
                <td key={c.key} style={{ padding:'8px 6px', textAlign:'center', color:t.tableText, fontVariantNumeric:'tabular-nums' }}>
                  {fmtAvg((p[c.key]||0) / p.games)}
                </td>
              ))}
              {PCT_COLS.map(c => (
                <td key={c.label} style={{ padding:'8px 6px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>
                  {fmtPct(p[c.num]||0, p[c.den]||0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Game log */}
      <div style={{ padding:'12px 14px 6px', background:t.tableSectionBg, borderTop:`1px solid ${t.tableLine}`, borderBottom:`1px solid ${t.tableLine}`, fontFamily:BC, fontWeight:900, fontSize:11, letterSpacing:3, color:t.tableTextSubtle, textTransform:'uppercase' }}>Game Log</div>
      {gameRows.map(({ game, rows: gRows }) => {
        if (!game) return null
        const won = game.winner_team === teamAbbr
        const opp = won ? game.loser_team : game.winner_team
        const teamScore = won ? game.winner_score : game.loser_score
        const oppScore  = won ? game.loser_score : game.winner_score
        const isOpen = openGames.has(game.id)
        return (
          <div key={game.id}>
            <button onClick={()=>toggleGame(game.id)} aria-expanded={isOpen}
              style={{ width:'100%', padding:'8px 14px', display:'flex', alignItems:'center', gap:10, background:t.tableSectionBg, borderBottom:`1px solid ${t.tableLine}`, border:'none', borderTop:'none', borderLeft:'none', borderRight:'none', cursor:'pointer', textAlign:'left' }}>
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:t.tableTextSubtle, transition:'transform 0.18s ease', transform:isOpen?'rotate(90deg)':'rotate(0deg)', flexShrink:0 }}>
                <path d="M3 1.5L7 5L3 8.5"/>
              </svg>
              <div style={{ fontFamily:BC, fontWeight:700, fontSize:10, letterSpacing:1.5, color:t.tableTextSubtle, minWidth:84 }}>{game.game_date || '—'}</div>
              <div style={{ fontFamily:BC, fontSize:12, color:t.tableText }}>{opp || '—'}</div>
              {teamScore != null && oppScore != null && (
                <div style={{ fontFamily:BC, fontWeight:900, fontSize:12, color: won ? '#22a06b' : '#d14545' }}>
                  {won ? 'W' : 'L'} {teamScore}-{oppScore}
                </div>
              )}
              {game.notes && <div style={{ fontFamily:B, fontSize:11, color:t.tableTextSubtle, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>· {game.notes}</div>}
            </button>
            {isOpen && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'6px 12px', color:t.tableTextVeryMuted, fontFamily:BC, fontSize:9, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>Player</th>
                  {STAT_COLS.map(c => <th key={c.key} style={{ textAlign:'center', padding:'6px 6px', color:t.tableTextVeryMuted, fontFamily:BC, fontSize:9, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>{c.label}</th>)}
                  <th style={{ textAlign:'center', padding:'6px 6px', color:t.tableTextVeryMuted, fontFamily:BC, fontSize:9, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>FG</th>
                  <th style={{ textAlign:'center', padding:'6px 6px', color:t.tableTextVeryMuted, fontFamily:BC, fontSize:9, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>3PT</th>
                  <th style={{ textAlign:'center', padding:'6px 6px', color:t.tableTextVeryMuted, fontFamily:BC, fontSize:9, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>FT</th>
                </tr>
              </thead>
              <tbody>
                {gRows.map(r => r.dnp ? (
                  <tr key={r.id} style={{ borderTop:`1px solid ${t.tableLine}` }}>
                    <td style={{ padding:'6px 12px', color:t.tableTextSubtle, whiteSpace:'nowrap' }}>{r.player_name}</td>
                    <td colSpan={STAT_COLS.length + 3} style={{ padding:'6px 6px', textAlign:'center', color:t.tableTextSubtle, fontFamily:BC, fontSize:10, letterSpacing:2, textTransform:'uppercase' }}>DNP</td>
                  </tr>
                ) : (
                  <tr key={r.id} style={{ borderTop:`1px solid ${t.tableLine}` }}>
                    <td style={{ padding:'6px 12px', color:t.tableText, whiteSpace:'nowrap' }}>{r.player_name}</td>
                    {STAT_COLS.map(c => (
                      <td key={c.key} style={{ padding:'6px 6px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{r[c.key] ?? 0}</td>
                    ))}
                    <td style={{ padding:'6px 6px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{r.fgm}-{r.fga}</td>
                    <td style={{ padding:'6px 6px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{r.three_pm}-{r.three_pa}</td>
                    <td style={{ padding:'6px 6px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{r.ftm}-{r.fta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )
      })}
    </div>
  )
}
