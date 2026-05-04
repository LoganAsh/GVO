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
