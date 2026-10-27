import { supabase } from './supabase'

// The current season row ({ id, label, current_phase, ... }), fetched once per page load.
let currentSeasonPromise = null
export function getCurrentSeason() {
  if (!currentSeasonPromise) {
    currentSeasonPromise = supabase.from('seasons').select('*').eq('is_current', true).maybeSingle()
      .then(({ data }) => data || null)
  }
  return currentSeasonPromise
}

// Supabase returns at most 1,000 rows per request. A full season of stat
// lines passes that within a few weeks, so page through everything.
export async function fetchAll(buildQuery, pageSize = 1000) {
  const out = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return out
}
