import { useState, useEffect } from 'react'
import { supabase } from './supabase'

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

export default function TeamStatsTable({ teamAbbr }) {
  const [rows, setRows]     = useState([])
  const [games, setGames]   = useState({})
  const [loading, setLoading] = useState(true)

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
    <div style={{ padding:40, textAlign:'center', color:'#334155', fontFamily:BC, letterSpacing:2, fontSize:12 }}>LOADING STATS…</div>
  )
  if (!rows.length) return (
    <div style={{ padding:48, textAlign:'center', color:'#475569' }}>
      <div style={{ fontSize:28, marginBottom:8 }}>📊</div>
      <div style={{ fontFamily:BC, letterSpacing:2, fontSize:13 }}>NO GAMES LOGGED</div>
      <div style={{ fontSize:12, marginTop:6, color:'#334155' }}>Add games via the Admin Portal Stats tab</div>
    </div>
  )

  // Group rows by player to compute season averages
  const byPlayer = {}
  for (const r of rows) {
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
    <div style={{ overflowX:'auto' }}>
      {/* Season averages */}
      <div style={{ padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.06)', fontFamily:BC, fontWeight:900, fontSize:11, letterSpacing:3, color:'#475569', textTransform:'uppercase' }}>Season Averages</div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
            <th style={{ textAlign:'left', padding:'8px 12px', color:'#475569', fontFamily:BC, fontSize:10, letterSpacing:2, textTransform:'uppercase', fontWeight:700 }}>Player</th>
            <th style={{ textAlign:'center', padding:'8px 6px', color:'#475569', fontFamily:BC, fontSize:10, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>GP</th>
            {STAT_COLS.map(c => <th key={c.key} style={{ textAlign:'center', padding:'8px 6px', color:'#475569', fontFamily:BC, fontSize:10, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>{c.label}</th>)}
            {PCT_COLS.map(c => <th key={c.label} style={{ textAlign:'center', padding:'8px 6px', color:'#475569', fontFamily:BC, fontSize:10, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {playerAvgs.map((p, i) => (
            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding:'8px 12px', color:'#f1f5f9', fontWeight:600, whiteSpace:'nowrap' }}>{p.player_name}</td>
              <td style={{ padding:'8px 6px', textAlign:'center', color:'#94a3b8', fontVariantNumeric:'tabular-nums' }}>{p.games}</td>
              {STAT_COLS.map(c => (
                <td key={c.key} style={{ padding:'8px 6px', textAlign:'center', color:'#cbd5e1', fontVariantNumeric:'tabular-nums' }}>
                  {fmtAvg((p[c.key]||0) / p.games)}
                </td>
              ))}
              {PCT_COLS.map(c => (
                <td key={c.label} style={{ padding:'8px 6px', textAlign:'center', color:'#94a3b8', fontVariantNumeric:'tabular-nums' }}>
                  {fmtPct(p[c.num]||0, p[c.den]||0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Game log */}
      <div style={{ padding:'12px 14px 6px', background:'rgba(255,255,255,0.03)', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', fontFamily:BC, fontWeight:900, fontSize:11, letterSpacing:3, color:'#475569', textTransform:'uppercase' }}>Game Log</div>
      {gameRows.map(({ game, rows: gRows }) => {
        if (!game) return null
        const opp = game.home_team === teamAbbr ? game.away_team : game.home_team
        const isHome = game.home_team === teamAbbr
        const teamScore = isHome ? game.home_score : game.away_score
        const oppScore  = isHome ? game.away_score : game.home_score
        const won = teamScore != null && oppScore != null && teamScore > oppScore
        return (
          <div key={game.id}>
            <div style={{ padding:'8px 14px', display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.02)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontFamily:BC, fontWeight:700, fontSize:10, letterSpacing:1.5, color:'#475569', minWidth:84 }}>{game.game_date || '—'}</div>
              <div style={{ fontFamily:BC, fontSize:12, color:'#94a3b8' }}>{isHome?'vs':'@'} {opp}</div>
              {teamScore != null && oppScore != null && (
                <div style={{ fontFamily:BC, fontWeight:900, fontSize:12, color: won ? '#34d399' : '#f87171' }}>
                  {won ? 'W' : 'L'} {teamScore}-{oppScore}
                </div>
              )}
              {game.notes && <div style={{ fontFamily:B, fontSize:11, color:'#475569', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>· {game.notes}</div>}
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'6px 12px', color:'#334155', fontFamily:BC, fontSize:9, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>Player</th>
                  {STAT_COLS.map(c => <th key={c.key} style={{ textAlign:'center', padding:'6px 6px', color:'#334155', fontFamily:BC, fontSize:9, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>{c.label}</th>)}
                  <th style={{ textAlign:'center', padding:'6px 6px', color:'#334155', fontFamily:BC, fontSize:9, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>FG</th>
                  <th style={{ textAlign:'center', padding:'6px 6px', color:'#334155', fontFamily:BC, fontSize:9, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>3PT</th>
                  <th style={{ textAlign:'center', padding:'6px 6px', color:'#334155', fontFamily:BC, fontSize:9, letterSpacing:1, textTransform:'uppercase', fontWeight:700 }}>FT</th>
                </tr>
              </thead>
              <tbody>
                {gRows.map(r => (
                  <tr key={r.id} style={{ borderTop:'1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding:'6px 12px', color:'#cbd5e1', whiteSpace:'nowrap' }}>{r.player_name}</td>
                    {STAT_COLS.map(c => (
                      <td key={c.key} style={{ padding:'6px 6px', textAlign:'center', color:'#94a3b8', fontVariantNumeric:'tabular-nums' }}>{r[c.key] ?? 0}</td>
                    ))}
                    <td style={{ padding:'6px 6px', textAlign:'center', color:'#94a3b8', fontVariantNumeric:'tabular-nums' }}>{r.fgm}-{r.fga}</td>
                    <td style={{ padding:'6px 6px', textAlign:'center', color:'#94a3b8', fontVariantNumeric:'tabular-nums' }}>{r.three_pm}-{r.three_pa}</td>
                    <td style={{ padding:'6px 6px', textAlign:'center', color:'#94a3b8', fontVariantNumeric:'tabular-nums' }}>{r.ftm}-{r.fta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
