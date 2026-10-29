import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getCurrentSeason } from './season'
import { getTheme } from './theme'
import { PlayerAvatar } from './playerPhotos'

const BC = "'Barlow Condensed',sans-serif"

// Below this many minutes per game, a player's PER swings wildly game to game.
const LOW_MPG = 10

// Color a PER value against the league scale (15 = average).
function perColor(per, t) {
  if (per == null) return t.tableTextMuted
  if (per >= 25) return '#34d399'
  if (per >= 18) return '#86efac'
  if (per >= 12) return t.tableText
  if (per >= 8) return '#fbbf24'
  return '#f87171'
}

export default function AdvancedStatsTable({ teamAbbr, theme = 'dark' }) {
  const t = getTheme(theme)
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let on = true
    setRows(null)
    ;(async () => {
      const season = await getCurrentSeason()
      if (!season) { if (on) setRows([]); return }
      const { data } = await supabase.rpc('gvo_player_per', { p_season: season.id, p_team: teamAbbr })
      if (on) setRows(data || [])
    })()
    return () => { on = false }
  }, [teamAbbr])

  const th = { padding: '8px 10px', color: t.tableTextSubtle, fontFamily: BC, fontSize: 10, letterSpacing: 1.5,
    textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }

  return (
    <div style={{ overflowX: 'auto', background: t.tableBg }}>
      <div style={{ padding: '10px 14px', background: t.tableSectionBg, borderBottom: `1px solid ${t.tableLine}`,
        fontFamily: BC, fontWeight: 900, fontSize: 11, letterSpacing: 3, color: t.tableTextSubtle, textTransform: 'uppercase' }}>
        Player Efficiency Rating
      </div>

      {rows == null ? (
        <div style={{ padding: 20, color: t.tableTextSubtle, fontFamily: BC, letterSpacing: 2, fontSize: 11 }}>LOADING…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 20, color: t.tableTextSubtle, fontFamily: BC, letterSpacing: 2, fontSize: 11 }}>NO GAMES PLAYED YET</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.tableLine}` }}>
              <th style={{ ...th, textAlign: 'left', padding: '8px 12px' }}>Player</th>
              <th style={th}>GP</th>
              <th style={th}>MPG</th>
              <th style={th}>PER</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => {
              const low = Number(p.mpg) < LOW_MPG
              return (
                <tr key={p.player_name} style={{ borderBottom: `1px solid ${t.tableLine}`, opacity: low ? 0.55 : 1 }}>
                  <td style={{ padding: '8px 12px', color: t.tableText, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <PlayerAvatar name={p.player_name} size={24} />{p.player_name}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: t.tableTextMuted, fontVariantNumeric: 'tabular-nums' }}>{p.gp}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: t.tableTextMuted, fontVariantNumeric: 'tabular-nums' }}>{Number(p.mpg).toFixed(1)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: BC, fontWeight: 900, fontSize: 15,
                    color: perColor(p.per == null ? null : Number(p.per), t), fontVariantNumeric: 'tabular-nums' }}>
                    {p.per == null ? '—' : Number(p.per).toFixed(1)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <div style={{ padding: '10px 14px', color: t.tableTextSubtle, fontSize: 11, lineHeight: 1.5, borderTop: `1px solid ${t.tableLine}` }}>
        Hollinger PER, regular season. League average is 15. Faded rows play under {LOW_MPG} minutes a game, where PER is unreliable.
      </div>
    </div>
  )
}
