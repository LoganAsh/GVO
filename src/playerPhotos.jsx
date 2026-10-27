import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fetchAll } from './season'

// Same rule as the gvo_name_key() database function: letters only, no accents or suffixes.
export const photoKey = (v) => (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '').replace(/[^a-z]/g, '')

// All headshots, loaded once per page load and shared by every avatar.
let photosPromise = null
function loadPhotos() {
  if (!photosPromise) {
    photosPromise = fetchAll(() => supabase.from('player_photos').select('name_key,photo_url,espn_id').order('name_key'))
      .then(rows => {
        const map = {}
        for (const r of rows) map[r.name_key] = r
        return map
      })
      .catch(() => ({}))
  }
  return photosPromise
}

export function usePlayerPhotos() {
  const [map, setMap] = useState({})
  useEffect(() => { let on = true; loadPhotos().then(m => { if (on) setMap(m) }); return () => { on = false } }, [])
  return map
}

// Small, cropped version of ESPN's headshot so phones don't download full-size images.
const smallUrl = (r, px) => r?.espn_id
  ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${r.espn_id}.png&w=${px * 3}&h=${Math.round(px * 2.2)}`
  : r?.photo_url

export function PlayerAvatar({ name, size = 26, bg = 'rgba(148,163,184,0.18)', color = '#94a3b8' }) {
  const photos = usePlayerPhotos()
  const [broken, setBroken] = useState(false)
  const row = photos[photoKey(name)]
  const initials = (name || '').replace(/[^A-Za-z .'-]/g, '').split(/\s+/).filter(Boolean)
    .map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const box = { width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
    background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
  if (!row || broken) {
    return <span aria-hidden="true" style={{ ...box, color, fontSize: Math.round(size * 0.38), fontWeight: 700,
      fontFamily: "'Barlow Condensed',sans-serif" }}>{initials}</span>
  }
  return (
    <span aria-hidden="true" style={box}>
      <img src={smallUrl(row, size)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
    </span>
  )
}
