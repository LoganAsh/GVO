import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { getTheme } from './theme'

const BC = "'Barlow Condensed', sans-serif"

const fmt1 = v => (v == null || isNaN(v) ? '—' : v.toFixed(1))
const fmtPct = (n, d) => (!d ? '—' : `${((n / d) * 100).toFixed(1)}%`)

const COLS = [
  { key: 'player_name', label: 'Player', align: 'left' },
  { key: 'team_abbr',   label: 'Team',   align: 'center' },
  { key: 'GP',          label: 'GP'      },
  { key: 'min',         label: 'MIN'     },
  { key: 'pts',         label: 'PPG'     },
  { key: 'reb',         label: 'RPG'     },
  { key: 'ast',         label: 'APG'     },
  { key: 'stl',         label: 'SPG'     },
  { key: 'blk',         label: 'BPG'     },
  { key: 'tov',         label: 'TO'      },
  { key: 'fgPct',       label: 'FG%'     },
  { key: 'threePct',    label: '3P%'     },
  { key: 'ftPct',       label: 'FT%'     },
]

const PER_PAGE = 30

export default function LeagueStats({ theme = 'dark' }) {
  const t = getTheme(theme)
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('pts')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await supabase.from('player_stats').select('*').eq('dnp', false)
    setStats(data || [])
    setLoading(false)
  }

  const players = useMemo(() => {
    const byPlayer = {}
    for (const r of stats) {
      const key = r.player_id ?? `name:${r.player_name}:${r.team_abbr}`
      if (!byPlayer[key]) byPlayer[key] = { player_name: r.player_name, team_abbr: r.team_abbr, GP: 0 }
      const p = byPlayer[key]
      p.GP += 1
      for (const f of ['min','pts','reb','ast','stl','blk','tov','fgm','fga','three_pm','three_pa','ftm','fta']) {
        p[f] = (p[f] || 0) + (r[f] || 0)
      }
    }
    return Object.values(byPlayer)
  }, [stats])

  const sortVal = (p, key) => {
    if (key === 'player_name') return (p.player_name || '').toLowerCase()
    if (key === 'team_abbr')   return p.team_abbr || ''
    if (key === 'GP')          return p.GP
    if (key === 'fgPct')       return p.fga ? p.fgm / p.fga : -1
    if (key === 'threePct')    return p.three_pa ? p.three_pm / p.three_pa : -1
    if (key === 'ftPct')       return p.fta ? p.ftm / p.fta : -1
    // per-game cumulative for min/pts/reb/ast/stl/blk/tov
    return p.GP ? p[key] / p.GP : -1
  }

  const sorted = useMemo(() => {
    const arr = [...players]
    arr.sort((a, b) => {
      const va = sortVal(a, sortBy)
      const vb = sortVal(b, sortBy)
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      // Stable secondary sort by name so tied rows render consistently.
      return (a.player_name || '').localeCompare(b.player_name || '')
    })
    return arr
  }, [players, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages - 1)
  const start = currentPage * PER_PAGE
  const visible = sorted.slice(start, start + PER_PAGE)

  const onHeaderClick = (key) => {
    if (sortBy === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(key)
      // Strings sort ascending by default, numbers descending so leaders surface.
      setSortDir(['player_name', 'team_abbr'].includes(key) ? 'asc' : 'desc')
    }
    setPage(0)
  }

  const cellValue = (p, key) => {
    switch (key) {
      case 'player_name': return p.player_name
      case 'team_abbr':   return p.team_abbr
      case 'GP':          return p.GP
      case 'min':         return fmt1(p.GP ? p.min / p.GP : null)
      case 'pts':         return fmt1(p.GP ? p.pts / p.GP : null)
      case 'reb':         return fmt1(p.GP ? p.reb / p.GP : null)
      case 'ast':         return fmt1(p.GP ? p.ast / p.GP : null)
      case 'stl':         return fmt1(p.GP ? p.stl / p.GP : null)
      case 'blk':         return fmt1(p.GP ? p.blk / p.GP : null)
      case 'tov':         return fmt1(p.GP ? p.tov / p.GP : null)
      case 'fgPct':       return fmtPct(p.fgm, p.fga)
      case 'threePct':    return fmtPct(p.three_pm, p.three_pa)
      case 'ftPct':       return fmtPct(p.ftm, p.fta)
      default:            return ''
    }
  }

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:t.tableTextSubtle, fontFamily:BC, letterSpacing:2, fontSize:12 }}>LOADING LEAGUE STATS…</div>
  )

  return (
    <div style={{ background:t.tableBg, border:`1px solid ${t.border}`, borderRadius:12, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:t.tableSectionBg, borderBottom:`1px solid ${t.tableLine}`, gap:8, flexWrap:'wrap' }}>
        <div style={{ fontFamily:BC, fontWeight:900, fontSize:11, letterSpacing:3, color:t.tableTextSubtle, textTransform:'uppercase' }}>League Stats · {sorted.length} players</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={()=>setPage(p => Math.max(0, p-1))} disabled={currentPage === 0}
            style={{ padding:'4px 12px', borderRadius:6, border:`1px solid ${t.border}`, background:'transparent', color: currentPage === 0 ? t.tableTextVeryMuted : t.tableText, fontFamily:BC, fontSize:11, letterSpacing:1, cursor: currentPage === 0 ? 'default' : 'pointer' }}>← Prev</button>
          <span style={{ fontFamily:BC, fontSize:11, color:t.tableTextSubtle, letterSpacing:1, fontVariantNumeric:'tabular-nums' }}>
            {sorted.length === 0 ? '0' : `${start+1}–${Math.min(start+PER_PAGE, sorted.length)} of ${sorted.length}`}
          </span>
          <button onClick={()=>setPage(p => Math.min(totalPages-1, p+1))} disabled={currentPage >= totalPages-1}
            style={{ padding:'4px 12px', borderRadius:6, border:`1px solid ${t.border}`, background:'transparent', color: currentPage >= totalPages-1 ? t.tableTextVeryMuted : t.tableText, fontFamily:BC, fontSize:11, letterSpacing:1, cursor: currentPage >= totalPages-1 ? 'default' : 'pointer' }}>Next →</button>
        </div>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${t.tableLine}`, background:t.tableHeaderBg }}>
              {COLS.map(c => {
                const active = sortBy === c.key
                const arrow = active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''
                return (
                  <th key={c.key} onClick={()=>onHeaderClick(c.key)}
                    style={{
                      textAlign: c.align || 'center',
                      padding:'8px 10px',
                      color: active ? t.tableText : t.tableTextSubtle,
                      fontFamily:BC,
                      fontSize:10,
                      letterSpacing:2,
                      textTransform:'uppercase',
                      fontWeight:700,
                      cursor:'pointer',
                      userSelect:'none',
                      whiteSpace:'nowrap',
                    }}>{c.label}{arrow}</th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={COLS.length} style={{ padding:'24px', textAlign:'center', color:t.tableTextSubtle, fontFamily:BC, letterSpacing:2, fontSize:11 }}>NO PLAYERS YET</td></tr>
            ) : visible.map((p, i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${t.tableLine}` }}>
                {COLS.map(c => (
                  <td key={c.key} style={{
                    padding:'7px 10px',
                    textAlign: c.align || 'center',
                    color: c.key === 'player_name' ? t.tableText : t.tableTextMuted,
                    fontWeight: c.key === 'player_name' ? 600 : 400,
                    fontVariantNumeric:'tabular-nums',
                    whiteSpace:'nowrap',
                  }}>{cellValue(p, c.key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
