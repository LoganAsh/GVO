import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { getTheme } from './theme'

const BC = "'Barlow Condensed', sans-serif"

const EAST = ['ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS']
const WEST = ['DAL','DEN','GSW','HOU','LAC','LAL','MEM','MIN','NOP','OKC','PHX','POR','SAC','SAS','UTA']

export default function Standings({ theme = 'dark' }) {
  const t = getTheme(theme)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await supabase
      .from('games')
      .select('winner_team,loser_team,winner_score,loser_score')
      .not('winner_team', 'is', null)
      .not('loser_team', 'is', null)
    setGames(data || [])
    setLoading(false)
  }

  const recordFor = (abbr) => {
    let W = 0, L = 0, PF = 0, PA = 0
    for (const g of games) {
      if (g.winner_team === abbr) {
        W += 1
        PF += g.winner_score || 0
        PA += g.loser_score || 0
      } else if (g.loser_team === abbr) {
        L += 1
        PF += g.loser_score || 0
        PA += g.winner_score || 0
      }
    }
    const GP = W + L
    return { W, L, GP, PF, PA, PPG: GP ? PF/GP : 0, PAPG: GP ? PA/GP : 0 }
  }

  // Build a conference table sorted by W desc / L asc, with GB computed
  // relative to the leader: ((leadW - W) + (L - leadL)) / 2.
  const buildConf = (teams) => {
    const rows = teams.map(team => ({ team, ...recordFor(team) }))
    rows.sort((a, b) => b.W - a.W || a.L - b.L || b.PPG - a.PPG)
    if (rows.length) {
      const lead = rows[0]
      for (const r of rows) {
        r.GB = ((lead.W - r.W) + (r.L - lead.L)) / 2
      }
    }
    return rows
  }

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:t.tableTextSubtle, fontFamily:BC, letterSpacing:2, fontSize:12 }}>LOADING STANDINGS…</div>
  )

  const east = buildConf(EAST)
  const west = buildConf(WEST)

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(380px, 1fr))', gap:20 }}>
      <ConfTable title="Eastern Conference" rows={east} t={t}/>
      <ConfTable title="Western Conference" rows={west} t={t}/>
    </div>
  )
}

function ConfTable({ title, rows, t }) {
  return (
    <div style={{ background:t.tableBg, border:`1px solid ${t.border}`, borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', background:t.tableSectionBg, borderBottom:`1px solid ${t.tableLine}`, fontFamily:BC, fontWeight:900, fontSize:11, letterSpacing:3, color:t.tableTextSubtle, textTransform:'uppercase' }}>{title}</div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${t.tableLine}` }}>
              {[
                ['Team','left'],
                ['W','center'],['L','center'],['GB','center'],
                ['PPG','center'],['PAPG','center']
              ].map(([h,al]) => (
                <th key={h} style={{ textAlign:al, padding:'8px 10px', color:t.tableTextSubtle, fontFamily:BC, fontSize:10, letterSpacing:2, textTransform:'uppercase', fontWeight:700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team} style={{ borderBottom:`1px solid ${t.tableLine}` }}>
                <td style={{ padding:'8px 10px', color:t.tableText, fontFamily:BC, fontWeight:700, whiteSpace:'nowrap' }}><span style={{ color:t.tableTextSubtle, marginRight:6 }}>{i+1}.</span>{r.team}</td>
                <td style={{ padding:'8px 10px', textAlign:'center', color:t.tableText, fontVariantNumeric:'tabular-nums' }}>{r.W}</td>
                <td style={{ padding:'8px 10px', textAlign:'center', color:t.tableText, fontVariantNumeric:'tabular-nums' }}>{r.L}</td>
                <td style={{ padding:'8px 10px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{!r.GP ? '—' : r.GB === 0 ? '—' : r.GB.toFixed(1)}</td>
                <td style={{ padding:'8px 10px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{r.GP ? r.PPG.toFixed(1) : '—'}</td>
                <td style={{ padding:'8px 10px', textAlign:'center', color:t.tableTextMuted, fontVariantNumeric:'tabular-nums' }}>{r.GP ? r.PAPG.toFixed(1) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
