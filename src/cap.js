// CBA constants and helpers for the trade machine.
// Values match the rest of the app's 2025-26 cap year.

export const CAP = {
  cap:    154_647_000,  // Salary cap
  tax:    187_900_000,  // Luxury tax line
  apron1: 195_900_000,  // 1st apron
  apron2: 207_800_000,  // 2nd apron
}

// Salary-matching thresholds for over-the-cap teams below the 1st apron.
// (2025-26 estimated; sim league uses these as a fixed reference.)
const TIER1_MAX =  7_944_000  // ≤ this → max incoming = 200% + 250K
const TIER2_MAX = 31_776_000  // ≤ this → max incoming = outgoing + 7.94M
                              //  > TIER2_MAX → max incoming = 125% + 250K
const TIER2_BUMP = 7_944_000

export function maxIncomingForOutgoing(outgoing) {
  if (outgoing <= 0) return 0
  if (outgoing <= TIER1_MAX) return outgoing * 2 + 250_000
  if (outgoing <= TIER2_MAX) return outgoing + TIER2_BUMP
  return outgoing * 1.25 + 250_000
}

// Compare a team's payroll to cap milestones and return a status label.
export function capStatus(payroll) {
  if (payroll >= CAP.apron2) return { key: 'apron2', label: 'Above 2nd Apron', color: '#f43f5e' }
  if (payroll >= CAP.apron1) return { key: 'apron1', label: 'Above 1st Apron', color: '#f97316' }
  if (payroll >= CAP.tax)    return { key: 'tax',    label: 'In Luxury Tax',  color: '#fbbf24' }
  if (payroll >= CAP.cap)    return { key: 'over',   label: 'Over Cap',       color: '#fb923c' }
  return { key: 'under', label: 'Under Cap', color: '#34d399' }
}

// Sum of yr1 salaries for a list of roster rows. Cap holds (no contract but
// non-zero salary_yr1 in our schema) count as payroll for trade math.
export function payrollFromRoster(rows) {
  if (!rows || !rows.length) return 0
  return rows.reduce((s, p) => s + (Number(p.salary_yr1) || 0), 0)
}

export function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—'
  const neg = n < 0, a = Math.abs(n)
  const sign = neg ? '-' : ''
  if (a >= 1e6) return `${sign}$${(a/1e6).toFixed(2)}M`
  if (a >= 1e3) return `${sign}$${(a/1e3).toFixed(0)}K`
  return `${sign}$${a}`
}

// Stepien rule: a team can never go two consecutive future drafts without
// owning at least one 1st-round pick. Check the 7-year window starting at
// `fromYear` and flag any consecutive pair of years where the team would
// own zero 1st-rounders post-trade.
//
// Per-league interpretation (confirmed): owning ANY 1st-round pick in a
// year (including a swap right) counts as owning a pick that year.
export function validateStepien(picksAfter, fromYear) {
  const ownedYears = new Set(
    picksAfter
      .filter(p => Number(p.round) === 1 && Number(p.year) >= fromYear && Number(p.year) <= fromYear + 6)
      .map(p => Number(p.year))
  )
  const issues = []
  for (let y = fromYear; y < fromYear + 6; y++) {
    if (!ownedYears.has(y) && !ownedYears.has(y + 1)) {
      issues.push({ level: 'error', msg: `Stepien rule: would have no 1st-round pick in both ${y} and ${y + 1}.` })
    }
  }
  return issues
}

// Seven-year rule: picks more than 7 years out can't be traded. Check the
// outgoing picks for any year past the 7-year horizon.
export function validateSevenYear(outgoingPicks, fromYear) {
  const issues = []
  for (const p of outgoingPicks) {
    const y = Number(p.year)
    if (!y) continue
    if (y > fromYear + 6) {
      issues.push({ level: 'error', msg: `Seven-year rule: ${y} round ${p.round} pick is more than 7 years out (max ${fromYear + 6}).` })
    }
  }
  return issues
}

// Evaluate trade legality for one side of a 2-team deal. Returns the
// arithmetic + a list of human-readable issues. `outgoingPlayers` is just
// used to detect aggregation (more than one player in the outgoing leg)
// for 2nd-apron teams.
//
// Rules captured (intentionally simplified for a sim league):
//  - Above 2nd apron (before or after): can't take back more than sent;
//    can't aggregate; can't end above 2nd apron.
//  - Above 1st apron (before or after): must satisfy bracket matching;
//    can't end above 1st apron (1st apron acts as hard cap for the team).
//  - Over the cap, below 1st apron: must satisfy bracket matching.
//  - Under the cap: legal as long as projected payroll stays at/under cap,
//    OR they would also satisfy bracket matching as an over-cap team.
export function evaluateTradeLeg({ currentPayroll, outgoing, incoming, outgoingPlayers = [], picksAfter, outgoingPicks, nextDraftYear }) {
  const before = capStatus(currentPayroll)
  const newPayroll = currentPayroll - outgoing + incoming
  const after = capStatus(newPayroll)
  const issues = []
  if (picksAfter && nextDraftYear) {
    for (const i of validateStepien(picksAfter, nextDraftYear)) issues.push(i)
  }
  if (outgoingPicks && nextDraftYear) {
    for (const i of validateSevenYear(outgoingPicks, nextDraftYear)) issues.push(i)
  }

  const aboveApron2 = before.key === 'apron2' || after.key === 'apron2'
  const aboveApron1 = aboveApron2 || before.key === 'apron1' || after.key === 'apron1'
  const overCap = before.key !== 'under'

  const aggregating = outgoingPlayers.length > 1
  const maxIncoming = maxIncomingForOutgoing(outgoing)
  const excess = Math.max(0, incoming - maxIncoming)
  const capRoom = Math.max(0, CAP.cap - currentPayroll)

  if (aboveApron2) {
    if (incoming > outgoing) {
      issues.push({ level: 'error', msg: `Above 2nd apron — cannot take back more than sent (incoming ${fmtMoney(incoming)} > outgoing ${fmtMoney(outgoing)}).` })
    }
    if (aggregating) {
      issues.push({ level: 'error', msg: `Above 2nd apron — cannot aggregate ${outgoingPlayers.length} outgoing players in a single trade.` })
    }
    if (after.key === 'apron2' && newPayroll > CAP.apron2) {
      // capStatus returns apron2 only when ≥ apron2; flag if it would push higher
      issues.push({ level: 'error', msg: `Trade pushes payroll above the 2nd apron hard cap (${fmtMoney(newPayroll)} > ${fmtMoney(CAP.apron2)}).` })
    }
  } else if (aboveApron1) {
    if (incoming > maxIncoming) {
      issues.push({ level: 'error', msg: `Doesn't satisfy salary matching: incoming ${fmtMoney(incoming)} exceeds max ${fmtMoney(maxIncoming)} for outgoing ${fmtMoney(outgoing)}.` })
    }
    if (newPayroll > CAP.apron1) {
      issues.push({ level: 'error', msg: `Trade pushes payroll above the 1st apron hard cap (${fmtMoney(newPayroll)} > ${fmtMoney(CAP.apron1)}).` })
    }
  } else if (overCap) {
    if (incoming > maxIncoming) {
      issues.push({ level: 'error', msg: `Doesn't satisfy salary matching: incoming ${fmtMoney(incoming)} exceeds max ${fmtMoney(maxIncoming)} for outgoing ${fmtMoney(outgoing)}.` })
    }
  } else {
    // Under cap: legal if either the projected payroll is at/under the cap
    // (using cap room) OR bracket matching would have worked as an over-cap
    // team (they can choose not to use room and operate over the cap).
    const fitsRoom = newPayroll <= CAP.cap
    const fitsMatch = incoming <= maxIncoming
    if (!fitsRoom && !fitsMatch) {
      issues.push({ level: 'error', msg: `Cap room (${fmtMoney(capRoom)}) and salary matching (max ${fmtMoney(maxIncoming)}) both fall short of incoming ${fmtMoney(incoming)}.` })
    }
  }

  // Trade exception generated when sending out more salary than receiving
  // (only meaningful for over-the-cap teams; a sub-cap team usually
  // absorbs the difference into cap room instead).
  const tpe = overCap && outgoing > incoming ? outgoing - incoming : 0

  return {
    before, after,
    currentPayroll, newPayroll,
    outgoing, incoming,
    maxIncoming, excess,
    capRoom,
    aggregating, outgoingCount: outgoingPlayers.length,
    tpe,
    legal: issues.every(i => i.level !== 'error'),
    issues,
  }
}
