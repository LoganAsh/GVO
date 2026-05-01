import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { getTheme } from './theme'

const BC = "'Barlow Condensed', sans-serif"

const PER_GAME_CATS = [
  { key: 'pts', label: 'Points',   short: 'PPG' },
  { key: 'reb', label: 'Rebounds', short: 'RPG' },
  { key: 'ast', label: 'Assists',  short: 'APG' },
  { key: 'stl', label: 'Steals',   short: 'SPG' },
  { key: 'blk', label: 'Blocks',   short: 'BPG' },
]

// Min attempts/game keeps a player who shot 1-1 from popping above career
// shooters. These thresholds are generous for a sim league with few games.
const PCT_CATS = [
  { num: 'fgm',      den: 'fga',      label: 'FG%', minAttPerGame: 5   },
  { num: 'three_pm', den: 'three_pa', label: '3P%', minAttPerGame: 1.5 },
  { num: 'ftm',      den: 'fta',      label: 'FT%', minAttPerGame: 1.5 },
]

export default function Leaderboard({ theme = 'dark' }) {
  const t = getTheme(theme)
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await supabase.from('player_stats').select('*').eq('dnp', false)
    setStats(data || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:t.tableTextSubtle, fontFamily:BC, letterSpacing:2, fontSize:12 }}>LOADING LEADERBOARD…</div>
  )

  // Aggregate per player. Use player_id when present, fall back to name+team
  // so free-typed (unmatched) names still group correctly.
  const byPlayer = {}
  for (const r of stats) {
    const key = r.player_id ?? `name:${r.player_name}:${r.team_abbr}`
    if (!byPlayer[key]) byPlayer[key] = { player_name: r.player_name, team_abbr: r.team_abbr, GP: 0 }
    const p = byPlayer[key]
    p.GP += 1
    for (const c of PER_GAME_CATS) p[c.key] = (p[c.key]||0) + (r[c.key]||0)
    for (const c of PCT_CATS) {
      p[c.num] = (p[c.num]||0) + (r[c.num]||0)
      p[c.den] = (p[c.den]||0) + (r[c.den]||0)
    }
  }
  const players = Object.values(byPlayer)

  const top10 = (mapVal) => players
    .map(p => ({ ...p, _val: mapVal(p) }))
    .filter(p => p._val != null && !isNaN(p._val))
    .sort((a, b) => b._val - a._val)
    .slice(0, 10)

  const cards = [
    ...PER_GAME_CATS.map(c => ({
      key: c.key,
      label: c.label,
      rows: top10(p => (p.GP ? p[c.key] / p.GP : null)),
      fmt: v => v.toFixed(1),
    })),
    ...PCT_CATS.map(c => ({
      key: c.label,
      label: c.label,
      rows: top10(p => (p[c.den] >= p.GP * c.minAttPerGame ? p[c.num] / p[c.den] : null)),
      fmt: v => `${(v * 100).toFixed(1)}%`,
    })),
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16 }}>
      {cards.map(card => (
        <div key={card.key} style={{ background:t.tableBg, border:`1px solid ${t.border}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', background:t.tableSectionBg, borderBottom:`1px solid ${t.tableLine}`, fontFamily:BC, fontWeight:900, fontSize:11, letterSpacing:3, color:t.tableTextSubtle, textTransform:'uppercase' }}>{card.label}</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <tbody>
              {card.rows.length === 0 ? (
                <tr><td colSpan={4} style={{ padding:'16px', textAlign:'center', color:t.tableTextSubtle, fontFamily:BC, letterSpacing:2, fontSize:11 }}>NO DATA YET</td></tr>
              ) : card.rows.map((p, i) => (
                <tr key={i} style={{ borderBottom: i === card.rows.length-1 ? 'none' : `1px solid ${t.tableLine}` }}>
                  <td style={{ padding:'7px 10px', color:t.tableTextSubtle, fontFamily:BC, fontWeight:700, width:24 }}>{i+1}</td>
                  <td style={{ padding:'7px 10px', color:t.tableText, fontWeight:600, whiteSpace:'nowrap' }}>{p.player_name}</td>
                  <td style={{ padding:'7px 10px', color:t.tableTextMuted, fontFamily:BC, fontSize:11 }}>{p.team_abbr}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:t.tableText, fontVariantNumeric:'tabular-nums', fontWeight:700 }}>{card.fmt(p._val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
