import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { getTheme } from './theme'

const BC = "'Barlow Condensed', sans-serif"
const B  = "'Barlow', sans-serif"

const FULL = {
  ATL:"Atlanta",BOS:"Boston",BKN:"Brooklyn",CHA:"Charlotte",CHI:"Chicago",
  CLE:"Cleveland",DAL:"Dallas",DEN:"Denver",DET:"Detroit",GSW:"Golden State",
  HOU:"Houston",IND:"Indiana",LAC:"LA Clippers",LAL:"LA Lakers",MEM:"Memphis",
  MIA:"Miami",MIL:"Milwaukee",MIN:"Minnesota",NOP:"New Orleans",NYK:"New York",
  OKC:"OKC",ORL:"Orlando",PHI:"Philadelphia",PHX:"Phoenix",POR:"Portland",
  SAC:"Sacramento",SAS:"San Antonio",TOR:"Toronto",UTA:"Utah",WAS:"Washington"
}

const CLR = {
  ATL:"#E03A3E",BOS:"#007A33",BKN:"#888",CHA:"#1D1160",CHI:"#CE1141",
  CLE:"#860038",DAL:"#00538C",DEN:"#0E2240",DET:"#C8102E",GSW:"#1D428A",
  HOU:"#CE1141",IND:"#002D62",LAC:"#C8102E",LAL:"#552583",MEM:"#5D76A9",
  MIA:"#98002E",MIL:"#00471B",MIN:"#0C2340",NOP:"#0C2340",NYK:"#006BB6",
  OKC:"#007AC1",ORL:"#0077C0",PHI:"#006BB6",PHX:"#1D1160",POR:"#E03A3E",
  SAC:"#5A2D81",SAS:"#666",TOR:"#CE1141",UTA:"#002B5C",WAS:"#002B5C"
}

function TeamChip({ abbr }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: CLR[abbr] || '#475569', color: '#fff',
      borderRadius: 5, padding: '2px 7px',
      fontFamily: BC, fontWeight: 900, fontSize: 11, letterSpacing: 0.5,
      flexShrink: 0
    }}>{abbr}</span>
  )
}

function PickTypeBadge({ type, direction }) {
  const multiLabel = direction === 'best' ? 'MULTI ↑' : direction === 'second_best' ? 'MULTI #2' : 'MULTI ↓'
  const cfg = {
    own:        { label: 'OWNS',      bg: 'rgba(96,165,250,0.12)',  c: '#60a5fa' },
    swap:       { label: direction === 'best' ? 'SWAP ↑' : 'SWAP ↓', bg: 'rgba(167,139,250,0.12)', c: '#a78bfa' },
    multi_swap: { label: multiLabel, bg: 'rgba(251,191,36,0.12)', c: '#fbbf24' },
  }
  const { label, bg, c } = cfg[type] || cfg.own
  return (
    <span style={{
      background: bg, color: c, borderRadius: 5,
      padding: '2px 8px', fontFamily: BC, fontWeight: 800,
      fontSize: 10, letterSpacing: 1, flexShrink: 0
    }}>{label}</span>
  )
}

export default function DraftPicksTable({ teamAbbr, theme = "dark" }) {
  const t = getTheme(theme)
  const [picks, setPicks]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPicks()
  }, [teamAbbr])

  const loadPicks = async () => {
    setLoading(true)

    // Fetch all picks that involve this team in any role
    const { data, error } = await supabase
      .from('draft_picks')
      .select('*')
      .or(`owned_by.eq.${teamAbbr},original_team.eq.${teamAbbr},worst_team.eq.${teamAbbr},receiving_team.eq.${teamAbbr}`)
      .order('year')
      .order('round')

    if (error) { setLoading(false); return }

    // Also fetch picks where this team is in swap_teams array
    const { data: swapData } = await supabase
      .from('draft_picks')
      .select('*')
      .contains('swap_teams', [teamAbbr])
      .order('year')
      .order('round')

    // Merge and deduplicate by id
    const all = [...(data || []), ...(swapData || [])]
    const unique = Array.from(new Map(all.map(p => [p.id, p])).values())
    unique.sort((a, b) => a.year - b.year || a.round - b.round)

    setPicks(unique)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: t.tableTextVeryMuted, fontFamily: BC, letterSpacing: 2, fontSize: 12, background: t.tableBg }}>
      LOADING PICKS…
    </div>
  )

  if (!picks.length) return (
    <div style={{ padding: 48, textAlign: 'center', color: t.tableTextSubtle, background: t.tableBg }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
      <div style={{ fontFamily: BC, letterSpacing: 2, fontSize: 13 }}>NO PICKS ON FILE</div>
      <div style={{ fontSize: 12, marginTop: 6, color: t.tableTextVeryMuted }}>Add picks via the Admin Portal</div>
    </div>
  )

  // Group by year for visual separation
  const byYear = picks.reduce((acc, p) => {
    acc[p.year] = acc[p.year] || []
    acc[p.year].push(p)
    return acc
  }, {})

  return (
    <div style={{ overflowX: 'auto', background: t.tableBg }}>
      {Object.entries(byYear).map(([year, yearPicks]) => (
        <div key={year}>
          {/* Year header */}
          <div style={{
            padding: '8px 16px', background: t.tableSectionBg,
            borderBottom: `1px solid ${t.tableLine}`,
            fontFamily: BC, fontWeight: 900, fontSize: 11,
            letterSpacing: 3, color: t.tableTextSubtle, textTransform: 'uppercase'
          }}>{year}</div>

          {yearPicks.map(pick => {
            const isOwner    = pick.owned_by === teamAbbr
            const isOriginal = pick.original_team === teamAbbr && pick.owned_by !== teamAbbr
            const isSwapOnly = !isOwner && !isOriginal

            return (
              <div key={pick.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 16px',
                borderBottom: `1px solid ${t.tableLine}`,
                background: isOwner ? 'rgba(96,165,250,0.06)' : isOriginal ? 'rgba(248,113,113,0.06)' : 'transparent',
                transition: 'background 0.12s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = t.tableRowHover}
                onMouseLeave={e => e.currentTarget.style.background = isOwner ? 'rgba(96,165,250,0.06)' : isOriginal ? 'rgba(248,113,113,0.06)' : 'transparent'}
              >
                {/* Round badge */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: pick.round === 1 ? 'rgba(251,191,36,0.18)' : 'rgba(148,163,184,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: BC, fontWeight: 900, fontSize: 13,
                  color: pick.round === 1 ? '#a87f00' : t.tableTextMuted
                }}>R{pick.round}</div>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Row 1: type badge + ownership header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <PickTypeBadge type={pick.pick_type} direction={pick.swap_direction} />
                    {!(pick.pick_type !== 'own' && (pick.swap_teams || []).includes(pick.original_team)) && (() => {
                      const holder = pick.pick_type !== 'own' ? (pick.receiving_team || pick.owned_by) : pick.owned_by
                      return (
                        <>
                          <TeamChip abbr={pick.original_team} />
                          {pick.original_team !== holder ? (
                            <>
                              <span style={{ color: t.tableTextSubtle, fontSize: 11 }}>→</span>
                              <TeamChip abbr={holder} />
                            </>
                          ) : (
                            <span style={{ color: t.tableTextSubtle, fontSize: 12, fontFamily: BC }}>own pick</span>
                          )}
                        </>
                      )
                    })()}
                  </div>

                  {/* Row 2: swap detail */}
                  {pick.pick_type !== 'own' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {(pick.swap_teams || []).map((tm, i, arr) => (
                        <span key={tm} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <TeamChip abbr={tm} />
                          {i < arr.length - 1 && <span style={{ color: t.tableTextSubtle, fontSize: 11 }}>⇄</span>}
                        </span>
                      ))}
                      {pick.worst_team ? (
                        pick.pick_type === 'multi_swap' ? (
                          <span style={{ color: t.tableTextMuted, fontFamily: BC, fontSize: 11 }}>
                            · <span style={{ color: t.tableText }}>{pick.owned_by}</span> best ·
                            {' '}<span style={{ color: t.tableText }}>{(pick.swap_teams||[]).filter(tm => tm !== pick.owned_by && tm !== pick.worst_team).join(', ') || '—'}</span> 2nd ·
                            {' '}<span style={{ color: t.tableText }}>{pick.worst_team}</span> worst
                          </span>
                        ) : (
                          <span style={{ color: t.tableTextMuted, fontFamily: BC, fontSize: 11 }}>
                            · <span style={{ color: t.tableText }}>{pick.owned_by}</span> best ·
                            {' '}<span style={{ color: t.tableText }}>{pick.worst_team}</span> worst
                          </span>
                        )
                      ) : (
                        <span style={{ color: t.tableTextMuted, fontFamily: BC, fontSize: 11 }}>
                          · {pick.owned_by} takes {pick.swap_direction === 'best' ? (pick.pick_type === 'swap' ? 'better' : 'best') : pick.swap_direction === 'second_best' ? '2nd best' : (pick.pick_type === 'swap' ? 'worse' : 'worst')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Row 3: protection + notes */}
                  {(pick.protection || pick.notes) && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                      {pick.protection && (
                        <span style={{
                          background: 'rgba(249,115,22,0.1)', color: '#f97316',
                          borderRadius: 4, padding: '1px 7px',
                          fontFamily: BC, fontSize: 10, fontWeight: 700, letterSpacing: 0.5
                        }}>🔒 {pick.protection}</span>
                      )}
                      {pick.notes && (
                        <span style={{ color: t.tableTextSubtle, fontSize: 12, fontFamily: B, lineHeight: 1.4 }}>{pick.notes}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: perspective label */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  {isOwner && pick.original_team !== teamAbbr && (
                    <span style={{ fontFamily: BC, fontSize: 9, letterSpacing: 1, color: '#60a5fa', textTransform: 'uppercase' }}>RECEIVING</span>
                  )}
                  {isOriginal && (
                    <span style={{ fontFamily: BC, fontSize: 9, letterSpacing: 1, color: '#f87171', textTransform: 'uppercase' }}>OWED</span>
                  )}
                  {isSwapOnly && (
                    <span style={{ fontFamily: BC, fontSize: 9, letterSpacing: 1, color: '#a78bfa', textTransform: 'uppercase' }}>SWAP</span>
                  )}
                  {isOwner && pick.original_team === teamAbbr && pick.pick_type === 'own' && (
                    <span style={{ fontFamily: BC, fontSize: 9, letterSpacing: 1, color: '#34d399', textTransform: 'uppercase' }}>OWN</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
