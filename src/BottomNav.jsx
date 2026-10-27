// Mobile-only bottom tab bar. Hidden above 768px by src/mobile.css, where the
// hamburger drawer stays the main navigation.
const ACCENT = "#f97316";

const icon = (paths) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
);

const ICONS = {
  home: icon(<><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></>),
  teams: icon(<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.2A6.5 6.5 0 0 1 21.5 20"/></>),
  draft: icon(<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></>),
  trades: icon(<><path d="M4 8h14"/><path d="m14 4 4 4-4 4"/><path d="M20 16H6"/><path d="m10 12-4 4 4 4"/></>),
  more: icon(<><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>),
};

export default function BottomNav({ active, th, onNavigate }) {
  const items = [
    ["home", "Home"],
    ["teams", "Teams"],
    ["draft", "Draft"],
    ["trades", "Trades"],
    ["more", "More"],
  ];
  return (
    <nav className="gvo-bottom-nav" aria-label="Main"
      style={{position:"fixed",left:0,right:0,bottom:0,zIndex:150,background:th.surface,
        borderTop:`1px solid ${th.border}`,paddingBottom:"env(safe-area-inset-bottom, 0px)"}}>
      {items.map(([key, label]) => {
        const on = active === key;
        return (
          <button key={key} onClick={() => onNavigate(key)} aria-current={on ? "page" : undefined}
            style={{flex:1,minHeight:56,display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",gap:3,background:"none",border:"none",cursor:"pointer",
              color:on ? ACCENT : th.textMuted,fontFamily:"'Barlow Condensed',sans-serif",
              fontWeight:700,fontSize:11,letterSpacing:0.5,WebkitTapHighlightColor:"transparent"}}>
            {ICONS[key]}
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
