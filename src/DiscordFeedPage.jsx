import { useState, useEffect } from 'react'
import { getTheme } from './theme'

const FEED_URL = 'https://vdbrbtuidsfftgotmlol.supabase.co/functions/v1/discord-feed'
const BC = "'Barlow Condensed', sans-serif"
const B  = "'Barlow', sans-serif"

function relTime(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (isNaN(ms)) return ''
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

// Best-effort detection of an image attachment (Discord sometimes mislabels
// content_type, so fall back to a filename extension check).
function isImage(att) {
  if (att?.content_type?.startsWith('image/')) return true
  const f = (att?.filename || '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/.test(f)
}

export default function DiscordFeedPage({ channel, theme = 'dark' }) {
  const t = getTheme(theme)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`${FEED_URL}?channel=${encodeURIComponent(channel)}&limit=5`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          const detail = typeof json?.detail === 'string' ? json.detail : ''
          throw new Error(`${json?.error || `HTTP ${res.status}`}${detail ? ` — ${detail.slice(0, 280)}` : ''}`)
        }
        if (!cancelled) setMessages(json.messages || [])
      } catch (e) {
        if (!cancelled) setError(e.message || String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [channel])

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: t.tableTextSubtle, fontFamily: BC, letterSpacing: 2, fontSize: 12 }}>LOADING…</div>
  )

  if (error) return (
    <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, padding: '14px 16px', color: '#fde68a', fontFamily: B, fontSize: 13 }}>
      <div style={{ fontFamily: BC, fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#fbbf24', marginBottom: 4 }}>Couldn't load feed</div>
      {error}
    </div>
  )

  if (!messages.length) return (
    <div style={{ padding: 48, textAlign: 'center', color: t.tableTextSubtle, fontFamily: BC, letterSpacing: 2, fontSize: 13 }}>NO RECENT POSTS</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {messages.map(m => (
        <article key={m.id} style={{ background: t.tableBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {m.author?.avatar_url ? (
              <img src={m.author.avatar_url} alt="" width={32} height={32} style={{ borderRadius: '50%', flexShrink: 0 }}/>
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.surfaceAlt, border: `1px solid ${t.border}`, flexShrink: 0 }}/>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: BC, fontWeight: 800, fontSize: 13, color: t.tableText, letterSpacing: 0.5 }}>{m.author?.name || 'Unknown'}</div>
              <div style={{ fontFamily: BC, fontSize: 10, letterSpacing: 1.5, color: t.tableTextSubtle, textTransform: 'uppercase' }}>
                {relTime(m.timestamp)}{m.edited_timestamp ? ' · edited' : ''}
              </div>
            </div>
          </div>

          {m.content && (
            <div style={{ fontFamily: B, fontSize: 14, color: t.tableText, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{m.content}</div>
          )}

          {m.attachments?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: m.content ? 10 : 0 }}>
              {m.attachments.map((a, i) => isImage(a) ? (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', maxWidth: 320, flex: '0 1 auto' }}>
                  <img src={a.url} alt={a.filename || ''} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block', border: `1px solid ${t.border}` }}/>
                </a>
              ) : (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 7, color: t.tableText, fontFamily: BC, fontSize: 11, letterSpacing: 1, textDecoration: 'none' }}>
                  📎 {a.filename || 'attachment'}
                </a>
              ))}
            </div>
          )}

          {m.embeds?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {m.embeds.map((e, i) => (
                <div key={i} style={{ borderLeft: `3px solid ${t.border}`, padding: '6px 10px', background: t.surfaceAlt, borderRadius: 6 }}>
                  {e.title && <div style={{ fontFamily: BC, fontWeight: 800, fontSize: 13, color: t.tableText, marginBottom: 2 }}>{e.title}</div>}
                  {e.description && <div style={{ fontFamily: B, fontSize: 13, color: t.tableTextMuted, whiteSpace: 'pre-wrap' }}>{e.description}</div>}
                  {e.image && <img src={e.image} alt="" style={{ marginTop: 6, maxWidth: 320, width: '100%', borderRadius: 6 }}/>}
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
