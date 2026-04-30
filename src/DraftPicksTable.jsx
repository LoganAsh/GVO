import { useState, useEffect } from 'react'
import { supabase } from './supabase'

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

export default function DraftPicksTable({ teamAbbr }) {
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
      .or(`owned_by.eq.${teamAbbr},original_team.eq.${teamAbbr},worst_team.eq.${teamAbbr}`)
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
    <div style={{ padding: 40, textAlign: 'center', color: '#334155', fontFamily: BC, letterSpacing: 2, fontSize: 12 }}>
      LOADING PICKS…
    </div>
  )

  if (!picks.length) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#475569' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
      <div style={{ fontFamily: BC, letterSpacing: 2, fontSize: 13 }}>NO PICKS ON FILE</div>
      <div style={{ fontSize: 12, marginTop: 6, color: '#334155' }}>Add picks via the Admin Portal</div>
    </div>
  )

  // Group by year for visual separation
  const byYear = picks.reduce((acc, p) => {
    acc[p.year] = acc[p.year] || []
    acc[p.year].push(p)
    return acc
  }, {})

  return (
    <div style={{ overflowX: 'auto' }}>
      {Object.entries(byYear).map(([year, yearPicks]) => (
        <div key={year}>
          {/* Year header */}
          <div style={{
            padding: '8px 16px', background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontFamily: BC, fontWeight: 900, fontSize: 11,
            letterSpacing: 3, color: '#475569', textTransform: 'uppercase'
          }}>{year}</div>

          {yearPicks.map(pick => {
            const isOwner    = pick.owned_by === teamAbbr
            const isOriginal = pick.original_team === teamAbbr && pick.owned_by !== teamAbbr
            const isSwapOnly = !isOwner && !isOriginal

            return (
              <div key={pick.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: isOwner ? 'rgba(96,165,250,0.03)' : isOriginal ? 'rgba(248,113,113,0.03)' : 'transparent',
                transition: 'background 0.12s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = isOwner ? 'rgba(96,165,250,0.03)' : isOriginal ? 'rgba(248,113,113,0.03)' : 'transparent'}
              >
                {/* Round badge */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: pick.round === 1 ? 'rgba(251,191,36,0.12)' : 'rgba(148,163,184,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: BC, fontWeight: 900, fontSize: 13,
                  color: pick.round === 1 ? '#fbbf24' : '#64748b'
                }}>R{pick.round}</div>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Row 1: type badge + ownership header (original → owned_by) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <PickTypeBadge type={pick.pick_type} direction={pick.swap_direction} />
                    <TeamChip abbr={pick.original_team} />
                    {pick.original_team !== pick.owned_by ? (
                      <>
                        <span style={{ color: '#334155', fontSize: 11 }}>→</span>
                        <TeamChip abbr={pick.owned_by} />
                      </>
                    ) : (
                      <span style={{ color: '#475569', fontSize: 12, fontFamily: BC }}>own pick</span>
                    )}
                  </div>

                  {/* Row 2: swap detail */}
                  {pick.pick_type !== 'own' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {(pick.swap_teams || []).map((t, i, arr) => (
                        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <TeamChip abbr={t} />
                          {i < arr.length - 1 && <span style={{ color: '#475569', fontSize: 11 }}>⇄</span>}
                        </span>
                      ))}
                      {pick.worst_team ? (
                        pick.pick_type === 'multi_swap' ? (
                          <span style={{ color: '#64748b', fontFamily: BC, fontSize: 11 }}>
                            · <span style={{ color: '#94a3b8' }}>{pick.owned_by}</span> best ·
                            {' '}<span style={{ color: '#94a3b8' }}>{(pick.swap_teams||[]).filter(t => t !== pick.owned_by && t !== pick.worst_team).join(', ') || '—'}</span> 2nd ·
                            {' '}<span style={{ color: '#94a3b8' }}>{pick.worst_team}</span> worst
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontFamily: BC, fontSize: 11 }}>
                            · <span style={{ color: '#94a3b8' }}>{pick.owned_by}</span> best ·
                            {' '}<span style={{ color: '#94a3b8' }}>{pick.worst_team}</span> worst
                          </span>
                        )
                      ) : (
                        <span style={{ color: '#64748b', fontFamily: BC, fontSize: 11 }}>
                          · {pick.owned_by} takes {pick.swap_direction === 'best' ? (pick.pick_type === 'swap' ? 'better' : 'best') : pick.swap_direction === 'second_best' ? '2nd best' : (pick.pick_type === 'swap' ? 'worse' : 'worst')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Row 2: protection + notes */}
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
                        <span style={{ color: '#475569', fontSize: 12, fontFamily: B, lineHeight: 1.4 }}>{pick.notes}</span>
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
