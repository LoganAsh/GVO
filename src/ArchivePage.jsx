import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getTheme } from './theme'
import { TeamLogo } from './teamLogos'

const BC = "'Barlow Condensed',sans-serif"

// Past seasons, playoffs, and drafts. Draft results are live; the stats
// sections are placeholders until those archives are built.
export default function ArchivePage({ theme = 'dark' }) {
  const t = getTheme(theme)
  const [draftYears, setDraftYears] = useState([])
  const [openYear, setOpenYear] = useState(null)
  const [picks, setPicks] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    ;(async () => {
      // Every draft before the one the board is currently running.
      const { data: settings } = await supabase.from('draft_settings').select('draft_year').eq('id', 1).maybeSingle()
      const current = settings?.draft_year || 9999
      const { data } = await supabase.from('draft_results').select('draft_year').lt('draft_year', current)
      if (!on) return
      const years = [...new Set((data || []).map(r => r.draft_year))].sort((a, b) => b - a)
      setDraftYears(years)
      setLoading(false)
    })()
    return () => { on = false }
  }, [])

  const toggleYear = async (year) => {
    if (openYear === year) { setOpenYear(null); return }
    setOpenYear(year)
    if (!picks[year]) {
      const { data } = await supabase.from('draft_results').select('*').eq('draft_year', year).order('pick_number')
      setPicks(p => ({ ...p, [year]: data || [] }))
    }
  }

  const sectionTitle = (text) => (
    <div style={{ fontFamily: BC, fontSize: 11, letterSpacing: 3, color: t.tableTextSubtle, textTransform: 'uppercase', margin: '4px 2px 8px' }}>{text}</div>
  )
  const card = { background: t.tableBg, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }
  const comingSoon = (label) => (
    <div style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontFamily: BC, fontWeight: 700, fontSize: 15, color: t.tableTextMuted }}>{label}</span>
      <span style={{ fontFamily: BC, fontSize: 10, letterSpacing: 2, color: t.tableTextSubtle, textTransform: 'uppercase',
        border: `1px solid ${t.border}`, borderRadius: 99, padding: '3px 10px' }}>Coming soon</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section>
        {sectionTitle('Draft Results')}
        {loading ? (
          <div style={{ ...card, padding: 18, color: t.tableTextSubtle, fontFamily: BC, letterSpacing: 2, fontSize: 11 }}>LOADING…</div>
        ) : draftYears.length === 0 ? (
          <div style={{ ...card, padding: 18, color: t.tableTextSubtle, fontFamily: BC, letterSpacing: 2, fontSize: 11 }}>NO PAST DRAFTS YET</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {draftYears.map(year => {
              const open = openYear === year
              const rows = picks[year]
              return (
                <div key={year} style={card}>
                  <button onClick={() => toggleYear(year)} aria-expanded={open}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', color: t.tableText }}>
                    <span style={{ fontFamily: BC, fontWeight: 900, fontSize: 18 }}>{year} NBA Draft</span>
                    <span style={{ fontFamily: BC, fontSize: 18, color: t.tableTextSubtle, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
                  </button>
                  {open && (
                    <div style={{ borderTop: `1px solid ${t.tableLine}`, overflowX: 'auto' }}>
                      {!rows ? (
                        <div style={{ padding: 16, color: t.tableTextSubtle, fontFamily: BC, letterSpacing: 2, fontSize: 11 }}>LOADING…</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ color: t.tableTextSubtle, fontFamily: BC, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>
                              {['#', 'Team', 'Player', 'Pos', 'School'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: h === '#' ? 'center' : 'left', fontWeight: 700 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(p => (
                              <tr key={p.id} style={{ borderTop: `1px solid ${t.tableLine}` }}>
                                <td style={{ padding: '8px 12px', textAlign: 'center', color: t.tableTextSubtle, fontFamily: BC, fontWeight: 700, width: 36 }}>{p.pick_number}</td>
                                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: t.tableTextMuted, fontFamily: BC, fontSize: 12 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <TeamLogo abbr={p.owns_team} size={16} />{p.owns_team}
                                    {p.original_team && p.original_team !== p.owns_team && (
                                      <span style={{ color: t.tableTextSubtle, fontSize: 11 }}>via {p.original_team}</span>
                                    )}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: t.tableText, fontWeight: 600 }}>{p.player_name || '—'}</td>
                                <td style={{ padding: '8px 12px', color: t.tableTextMuted }}>{p.position || '—'}</td>
                                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: t.tableTextMuted }}>{p.school || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        {sectionTitle('Season Stats')}
        {comingSoon('Past regular seasons')}
      </section>

      <section>
        {sectionTitle('Playoff Stats')}
        {comingSoon('Past playoffs')}
      </section>
    </div>
  )
}
