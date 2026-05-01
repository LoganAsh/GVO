// Stroke-based icon set used across the app. All icons inherit color from the
// surrounding text via `stroke="currentColor"`, so they pick up theme
// foreground tokens automatically.

const baseProps = (size, extra) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  ...extra,
})

export function BasketballIcon({ size = 14, ...rest }) {
  return (
    <svg {...baseProps(size, rest)}>
      <circle cx="12" cy="12" r="9"/>
      <path d="M3 12h18"/>
      <path d="M12 3v18"/>
      <path d="M5.6 5.6c4 4 8.8 4 12.8 0"/>
      <path d="M5.6 18.4c4-4 8.8-4 12.8 0"/>
    </svg>
  )
}

export function ClipboardIcon({ size = 14, ...rest }) {
  return (
    <svg {...baseProps(size, rest)}>
      <rect x="6" y="4" width="12" height="17" rx="2"/>
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/>
      <path d="M9 10h6M9 14h6M9 18h4"/>
    </svg>
  )
}

export function TargetIcon({ size = 14, ...rest }) {
  return (
    <svg {...baseProps(size, rest)}>
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="5"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  )
}

export function BarChartIcon({ size = 14, ...rest }) {
  return (
    <svg {...baseProps(size, rest)}>
      <line x1="6"  y1="20" x2="6"  y2="13"/>
      <line x1="12" y1="20" x2="12" y2="6"/>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="3"  y1="20" x2="21" y2="20"/>
    </svg>
  )
}

export function SyncIcon({ size = 14, spinning = false, ...rest }) {
  return (
    <svg {...baseProps(size, rest)} style={{ ...(rest.style || {}), animation: spinning ? "gvo-spin 1.1s linear infinite" : undefined }}>
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/>
      <path d="M21 4v4h-4"/>
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/>
      <path d="M3 20v-4h4"/>
    </svg>
  )
}

export function PersonIcon({ size = 14, ...rest }) {
  return (
    <svg {...baseProps(size, rest)}>
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
    </svg>
  )
}

export function LockIcon({ size = 14, ...rest }) {
  return (
    <svg {...baseProps(size, rest)}>
      <rect x="4" y="11" width="16" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    </svg>
  )
}

export function CameraIcon({ size = 14, ...rest }) {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <circle cx="12" cy="13" r="3.5"/>
    </svg>
  )
}

export function HamburgerIcon({ size = 16, ...rest }) {
  return (
    <svg {...baseProps(size, rest)}>
      <line x1="4"  y1="7"  x2="20" y2="7"/>
      <line x1="4"  y1="12" x2="20" y2="12"/>
      <line x1="4"  y1="17" x2="20" y2="17"/>
    </svg>
  )
}

export function HourglassIcon({ size = 14, ...rest }) {
  return (
    <svg {...baseProps(size, rest)}>
      <path d="M6 3h12"/>
      <path d="M6 21h12"/>
      <path d="M7 3v3a5 5 0 0 0 10 0V3"/>
      <path d="M7 21v-3a5 5 0 0 1 10 0v3"/>
    </svg>
  )
}

// Small CSS keyframe used by SyncIcon's `spinning` prop. Imported lazily by
// inserting the rule once at module load.
if (typeof document !== "undefined" && !document.getElementById("gvo-icon-styles")) {
  const style = document.createElement("style")
  style.id = "gvo-icon-styles"
  style.textContent = `@keyframes gvo-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`
  document.head.appendChild(style)
}
