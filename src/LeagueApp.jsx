import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import DraftPicksTable from "./DraftPicksTable";
import TeamStatsTable from "./TeamStatsTable";
import Standings from "./Standings";
import Leaderboard from "./Leaderboard";
import LeagueStats from "./LeagueStats";
import DiscordFeedPage from "./DiscordFeedPage";
import DraftPage from "./DraftPage";
import TradeMachine from "./TradeMachine";
import { getTheme } from "./theme";
import { BasketballIcon, ClipboardIcon, TargetIcon, BarChartIcon, HamburgerIcon } from "./Icons";

const FEED_PAGES = {
  sim_news:        { title: "Sim News",        channel: "news"     },
  rumor_mill:      { title: "Rumor Mill",      channel: "rumors"   },
  league_analysis: { title: "League Analysis", channel: "analysis" },
};

const T = {"sat":154647000,"lux":187900000,"a1":195900000,"a2":207800000};

const TEAMS = ["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"];
const FULL = {ATL:"Atlanta Hawks",BOS:"Boston Celtics",BKN:"Brooklyn Nets",CHA:"Charlotte Hornets",CHI:"Chicago Bulls",CLE:"Cleveland Cavaliers",DAL:"Dallas Mavericks",DEN:"Denver Nuggets",DET:"Detroit Pistons",GSW:"Golden State Warriors",HOU:"Houston Rockets",IND:"Indiana Pacers",LAC:"LA Clippers",LAL:"LA Lakers",MEM:"Memphis Grizzlies",MIA:"Miami Heat",MIL:"Milwaukee Bucks",MIN:"Minnesota Timberwolves",NOP:"New Orleans Pelicans",NYK:"New York Knicks",OKC:"OKC Thunder",ORL:"Orlando Magic",PHI:"Philadelphia 76ers",PHX:"Phoenix Suns",POR:"Portland Trail Blazers",SAC:"Sacramento Kings",SAS:"San Antonio Spurs",TOR:"Toronto Raptors",UTA:"Utah Jazz",WAS:"Washington Wizards"};
const CLR = {ATL:"#E03A3E",BOS:"#007A33",BKN:"#888",CHA:"#1D1160",CHI:"#CE1141",CLE:"#860038",DAL:"#00538C",DEN:"#0E2240",DET:"#C8102E",GSW:"#1D428A",HOU:"#CE1141",IND:"#002D62",LAC:"#C8102E",LAL:"#552583",MEM:"#5D76A9",MIA:"#98002E",MIL:"#00471B",MIN:"#0C2340",NOP:"#0C2340",NYK:"#006BB6",OKC:"#007AC1",ORL:"#0077C0",PHI:"#006BB6",PHX:"#1D1160",POR:"#E03A3E",SAC:"#5A2D81",SAS:"#666",TOR:"#CE1141",UTA:"#002B5C",WAS:"#002B5C"};

function money(n) {
  if (!n) return "—";
  const neg = n < 0, a = Math.abs(n);
  const s = neg ? "-" : "";
  if (a >= 1e6) return `${s}$${(a/1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a/1e3).toFixed(0)}K`;
  return `${s}$${a}`;
}

function ovrColor(ovr) {
  if (!ovr) return "#334155";
  if (ovr >= 90) return "#f59e0b";
  if (ovr >= 85) return "#34d399";
  if (ovr >= 80) return "#60a5fa";
  if (ovr >= 75) return "#94a3b8";
  return "#475569";
}
function ovrBg(ovr) {
  if (!ovr) return "rgba(51,65,85,0.2)";
  if (ovr >= 90) return "rgba(245,158,11,0.15)";
  if (ovr >= 85) return "rgba(52,211,153,0.12)";
  if (ovr >= 80) return "rgba(96,165,250,0.12)";
  return "rgba(148,163,184,0.08)";
}

// Build the 2KRatings.com URL for a player. Slug rules: lowercase, strip
// accents, drop apostrophes, drop generational suffixes (Jr., II, …),
// then collapse anything non-alphanumeric to hyphens.
function ratings2kUrl(name) {
  const slug = (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['']/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\.?\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) return null
  return `https://www.2kratings.com/${slug}`
}

function capStatus(capSpace) {
  const payroll = T.sat - capSpace;
  if (payroll >= T.a2) return { label:"Above 2nd Apron", color:"#f43f5e" };
  if (payroll >= T.a1) return { label:"Above 1st Apron", color:"#f97316" };
  if (payroll >= T.lux) return { label:"Luxury Tax", color:"#fbbf24" };
  if (payroll >= T.sat) return { label:"Over Cap", color:"#fb923c" };
  return { label:"Under Cap", color:"#34d399" };
}

function CapRow({ capSpace, th }) {
  const t = th || getTheme("dark");
  const payroll = T.sat - capSpace;
  const st = capStatus(capSpace);
  const items = [
    { label:"Cap Space", val:capSpace, color:capSpace<0?"#f87171":"#34d399" },
    { label:"Lux Tax",   val:-(payroll-T.lux), color:"#fbbf24" },
    { label:"1st Apron", val:-(payroll-T.a1),  color:"#f97316" },
    { label:"2nd Apron", val:-(payroll-T.a2),  color:"#f43f5e" },
  ];
  return (
    <div style={{background:t.tableHeaderBg,borderRadius:10,padding:"12px 16px",marginBottom:18,border:`1px solid ${t.border}`,display:"flex",flexWrap:"wrap",gap:"12px 24px",alignItems:"center"}}>
      <span style={{background:st.color+"22",color:st.color,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,flexShrink:0}}>{st.label}</span>
      {items.map(({label,val,color})=>(
        <div key={label} style={{display:"flex",flexDirection:"column",gap:1}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,letterSpacing:2,color:t.tableTextSubtle,textTransform:"uppercase"}}>{label}</span>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color,letterSpacing:0.5,fontVariantNumeric:"tabular-nums"}}>{money(val)}</span>
        </div>
      ))}
    </div>
  );
}

function RosterTable({ players, seasonLabels = [], th }) {
  const t = th || getTheme("dark");
  if (!players || !players.length) return (
    <div style={{padding:48,textAlign:"center",color:t.tableTextSubtle}}>
      <div style={{marginBottom:8,display:"inline-flex"}}><ClipboardIcon size={28}/></div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2,fontSize:13}}>NO ROSTER DATA</div>
    </div>
  );
  const maxSal = Math.max(...players.map(p => p[3].filter(v=>v>0).length), 1);
  const dimText = t.tableTextVeryMuted;
  const greyHold = t.tableTextSubtle;
  const dashColor = t.tableTextVeryMuted;
  return (
    <div style={{overflowX:"auto",background:t.tableBg}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${t.tableLine}`,background:t.tableHeaderBg}}>
            {["#","Player","Pos","OVR",...Array.from({length:maxSal},(_,i)=>i===0?"Current":(seasonLabels[i]||`Yr ${i+1}`))].map(h=>(
              <th key={h} style={{textAlign:h==="Player"?"left":"center",padding:"9px 12px",color:t.tableTextSubtle,fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:2,textTransform:"uppercase",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map(([name,pos,ovr,sals,opt,labels],i)=>(
            <tr key={i} style={{borderBottom:`1px solid ${t.tableLine}`,transition:"background 0.12s"}}
              onMouseEnter={e=>e.currentTarget.style.background=t.tableRowHover}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{padding:"10px 12px",color:dimText,fontSize:11,fontWeight:700,textAlign:"center"}}>{i+1}</td>
              <td style={{padding:"10px 12px",color:t.tableText,fontWeight:600,whiteSpace:"nowrap"}}>
                {ratings2kUrl(name) ? (
                  <a href={ratings2kUrl(name)} target="_blank" rel="noopener noreferrer"
                    title={`View ${name} on 2KRatings.com`}
                    style={{color:t.tableText,textDecoration:"none",borderBottom:`1px dotted ${t.tableTextSubtle}`}}
                    onMouseEnter={e=>{e.currentTarget.style.color="#60a5fa";e.currentTarget.style.borderBottomColor="#60a5fa";}}
                    onMouseLeave={e=>{e.currentTarget.style.color=t.tableText;e.currentTarget.style.borderBottomColor=t.tableTextSubtle;}}>
                    {name}
                  </a>
                ) : name}
              </td>
              <td style={{padding:"10px 12px",textAlign:"center"}}>
                {pos?<span style={{background:"rgba(99,102,241,0.15)",color:"#818cf8",borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:700}}>{pos}</span>:<span style={{color:dashColor}}>—</span>}
              </td>
              <td style={{padding:"10px 12px",textAlign:"center"}}>
                {ovr?<span style={{background:ovrBg(ovr),color:ovrColor(ovr),borderRadius:5,padding:"3px 8px",fontSize:12,fontWeight:800,fontVariantNumeric:"tabular-nums",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:0.5}}>{ovr}</span>:<span style={{color:dashColor}}>—</span>}
              </td>
              {Array.from({length:maxSal},(_,yi)=>{
                const v = sals[yi]||0;
                const label = labels?.[yi] || null;
                const nonZero = sals.slice(0,maxSal).map((s,i)=>s>0?i:-1).filter(i=>i>=0);
                const lastIdx = nonZero[nonZero.length-1];
                const finalIdx = nonZero.length>1 ? nonZero[nonZero.length-2] : nonZero[0];
                const isCapHold = v>0 && yi===lastIdx && nonZero.length>1;
                const isFinalYear = v>0 && yi===finalIdx;
                const OPT_CLR = {TO:"#a78bfa",PO:"#34d399",NG:"#2dd4bf","2TO":"#a78bfa"};
                const is2TOYear = opt==="2TO" && v>0 && nonZero.length>1 && (yi===finalIdx || yi===nonZero[nonZero.length-3]);
                const salColor = !v?dimText:isCapHold?greyHold:(is2TOYear||(isFinalYear&&opt&&OPT_CLR[opt]))?OPT_CLR[opt]:"#60a5fa";
                const showOptionTag = opt==="2TO" ? is2TOYear : (isFinalYear && !!OPT_CLR[opt]);
                const optionTagText = opt==="2TO" ? "TO" : opt;
                return (
                  <td key={yi} style={{padding:"8px 12px",textAlign:"center",whiteSpace:"nowrap"}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      {label && !v ? (
                        <span style={{color:greyHold,fontWeight:600,fontSize:12,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:0.5}}>{label}</span>
                      ) : (
                        <span style={{color:salColor,fontWeight:v?600:400,fontVariantNumeric:"tabular-nums",fontSize:13}}>{v?money(v):"—"}</span>
                      )}
                      {isCapHold&&<span style={{color:greyHold,fontSize:9,fontWeight:700,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>HOLD</span>}
                      {showOptionTag&&<span style={{color:salColor,fontSize:9,fontWeight:700,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>{optionTagText}</span>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PicksTable({ picks }) {
  if (!picks || !picks.length) return (
    <div style={{padding:48,textAlign:"center",color:"#475569"}}>
      <div style={{marginBottom:8,display:"inline-flex"}}><TargetIcon size={28}/></div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2,fontSize:13}}>NO PICKS ON FILE</div>
    </div>
  );
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead>
          <tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
            {["Year","Picks"].map(h=>(
              <th key={h} style={{textAlign:"left",padding:"9px 14px",color:"#475569",fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:2,textTransform:"uppercase",fontWeight:700}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {picks.map(([year,desc],i)=>(
            <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",transition:"background 0.12s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{padding:"10px 14px",color:"#fbbf24",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,letterSpacing:1,whiteSpace:"nowrap"}}>{year}</td>
              <td style={{padding:"10px 14px",color:"#94a3b8",fontSize:13,lineHeight:1.5}}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LeagueApp() {
  const [page, setPage] = useState("landing"); // "landing" | "team"
  const [sel, setSel] = useState("WAS");
  const [tab, setTab] = useState("roster");
  const [leagueTab, setLeagueTab] = useState("standings"); // landing-page tabs
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teamsExpanded, setTeamsExpanded] = useState(true);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("gvo-theme") === "light" ? "light" : "dark";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("gvo-theme", theme);
  }, [theme]);

  const th = getTheme(theme);
  const drawerRef = useRef(null);
  const lastFocusRef = useRef(null);

  const [rostersByTeam, setRostersByTeam] = useState({});
  const [summaryByTeam, setSummaryByTeam] = useState({});
  const [picksByTeam, setPicksByTeam] = useState({});
  const [seasonLabels, setSeasonLabels] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rosterRes, summaryRes, picksRes, headersRes] = await Promise.all([
          supabase.from("roster").select("team_abbr,player_name,position,ovr,salary_yr1,salary_yr2,salary_yr3,salary_yr4,salary_yr5,salary_yr1_label,salary_yr2_label,salary_yr3_label,salary_yr4_label,salary_yr5_label,option_type").order("id"),
          supabase.from("league_summary").select("team_abbr,gm,avg_ovr,cap_space_with_holds"),
          supabase.from("draft_picks").select("team_abbr,pick_year,from_team").order("pick_year"),
          supabase.from("season_headers").select("year_index,label").order("year_index"),
        ]);
        if (cancelled) return;
        if (rosterRes.error) throw rosterRes.error;
        if (summaryRes.error) throw summaryRes.error;
        if (picksRes.error) throw picksRes.error;
        if (headersRes.error) throw headersRes.error;

        const num = (v) => (v == null || v === "" ? 0 : Number(v));
        const r = {};
        for (const row of rosterRes.data || []) {
          const t = row.team_abbr;
          if (!t) continue;
          if (!r[t]) r[t] = [];
          r[t].push([
            row.player_name,
            row.position || "",
            row.ovr != null ? Number(row.ovr) : null,
            [row.salary_yr1, row.salary_yr2, row.salary_yr3, row.salary_yr4, row.salary_yr5].map(num),
            row.option_type || null,
            [row.salary_yr1_label, row.salary_yr2_label, row.salary_yr3_label, row.salary_yr4_label, row.salary_yr5_label].map(l => l || null),
          ]);
        }
        const s = {};
        for (const row of summaryRes.data || []) {
          s[row.team_abbr] = {
            gm: row.gm || null,
            ovr: row.avg_ovr != null ? Number(row.avg_ovr) : null,
            cap: row.cap_space_with_holds != null ? Number(row.cap_space_with_holds) : null,
          };
        }
        const p = {};
        for (const row of picksRes.data || []) {
          const t = row.team_abbr;
          if (!t) continue;
          if (!p[t]) p[t] = [];
          p[t].push([row.pick_year, row.from_team || ""]);
        }
        setRostersByTeam(r);
        setSummaryByTeam(s);
        setPicksByTeam(p);
        const labels = [];
        for (const row of headersRes.data || []) {
          if (row.year_index >= 1 && row.year_index <= 5) labels[row.year_index - 1] = row.label || "";
        }
        setSeasonLabels(labels);
        setDataLoaded(true);
      } catch (e) {
        if (!cancelled) setLoadError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    lastFocusRef.current = document.activeElement;
    const drawer = drawerRef.current;
    const focusableSel = 'button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])';
    const first = drawer?.querySelector(focusableSel);
    first?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { setSidebarOpen(false); return; }
      if (e.key === "Tab" && drawer) {
        const items = Array.from(drawer.querySelectorAll(focusableSel)).filter(el => !el.disabled && el.offsetParent !== null);
        if (!items.length) return;
        const f = items[0], l = items[items.length - 1];
        if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); }
        else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const prev = lastFocusRef.current;
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [sidebarOpen]);

  if (loadError) return (
    <div style={{minHeight:"100vh",background:"#070b12",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",textAlign:"center"}}>
      <div>
        <div style={{color:"#f43f5e",fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,letterSpacing:3,textTransform:"uppercase",marginBottom:6}}>Failed to load league data</div>
        <div style={{color:"#475569",fontFamily:"'Barlow',sans-serif",fontSize:12}}>{loadError}</div>
      </div>
    </div>
  );
  if (!dataLoaded) return (
    <div style={{minHeight:"100vh",background:"#070b12",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#334155",fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,letterSpacing:3,textTransform:"uppercase"}}>Loading league…</div>
    </div>
  );

  const players = rostersByTeam[sel] || [];
  const picks = picksByTeam[sel] || [];
  const info = summaryByTeam[sel] || {};
  const color = CLR[sel] || "#475569";

  const filtered = TEAMS.filter(t =>
    t.toLowerCase().includes(search.toLowerCase()) ||
    FULL[t].toLowerCase().includes(search.toLowerCase())
  );

  const pick = (t) => { setSel(t); setTab("roster"); setPage("team"); setSidebarOpen(false); };

  const TeamList = () => (
    <>
      <div style={{padding:"10px 10px 6px"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search teams…"
          style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"7px 10px",color:"#f1f5f9",fontSize:12,fontFamily:"'Barlow',sans-serif",outline:"none"}}/>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"4px 8px 16px"}}>
        {filtered.map(t=>{
          const active=t===sel&&page==="team";
          return (
            <button key={t} onClick={()=>pick(t)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,border:"none",cursor:"pointer",textAlign:"left",marginBottom:2,background:active?"rgba(249,115,22,0.15)":"transparent",borderLeft:active?"2px solid #f97316":"2px solid transparent"}}>
              <div style={{width:28,height:28,borderRadius:7,background:CLR[t]||"#555",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:10,color:"#fff",flexShrink:0}}>{t}</div>
              <span style={{fontSize:11,color:active?"#cbd5e1":"#475569",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{FULL[t].split(" ").slice(-1)[0]}</span>
            </button>
          );
        })}
      </div>
    </>
  );

  const drawer = (
    <>
      <div onClick={()=>setSidebarOpen(false)} aria-hidden="true"
        style={{position:"fixed",inset:0,background:th.backdrop,zIndex:200,
          opacity:sidebarOpen?1:0,pointerEvents:sidebarOpen?"auto":"none",
          transition:"opacity 0.22s ease"}}/>
      <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Teams menu"
        inert={sidebarOpen?undefined:""}
        style={{position:"fixed",top:0,left:0,bottom:0,width:240,background:th.surface,
          borderRight:`1px solid ${th.border}`,
          display:"flex",flexDirection:"column",zIndex:201,
          transform:sidebarOpen?"translateX(0)":"translateX(-100%)",
          transition:"transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow:sidebarOpen?"4px 0 24px rgba(0,0,0,0.18)":"none"}}>
        <div style={{padding:"14px",borderBottom:`1px solid ${th.borderSoft}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <button onClick={()=>{setPage("landing");setSidebarOpen(false);}}
            aria-label="Back to home"
            style={{display:"flex",alignItems:"center",gap:8,minWidth:0,background:"none",border:"none",cursor:"pointer",padding:"4px 6px",margin:"-4px -6px",borderRadius:6,color:th.text}}>
            <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#f97316,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0}}><BasketballIcon size={16}/></div>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,letterSpacing:1,color:th.text}}>MENU</span>
          </button>
          <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
            <button onClick={()=>setTheme(theme==="light"?"dark":"light")}
              aria-label={theme==="light"?"Switch to dark theme":"Switch to light theme"}
              title={theme==="light"?"Switch to dark theme":"Switch to light theme"}
              style={{background:"none",border:"none",color:th.closeBtn,cursor:"pointer",padding:"6px",display:"inline-flex",alignItems:"center",justifyContent:"center",borderRadius:6}}>
              {theme==="light" ? (
                // Moon icon (currently light → click for dark)
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                // Sun icon (currently dark → click for light)
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              )}
            </button>
            <button onClick={()=>setSidebarOpen(false)} aria-label="Close teams menu"
              style={{background:"none",border:"none",color:th.closeBtn,fontSize:20,cursor:"pointer",padding:"4px 8px"}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
          <button onClick={()=>{setPage("trade_machine");setSidebarOpen(false);}}
            style={{display:"flex",alignItems:"center",justifyContent:"flex-start",gap:8,padding:"10px 14px",background:page==="trade_machine"?"rgba(249,115,22,0.12)":"none",borderLeft:page==="trade_machine"?"2px solid #f97316":"2px solid transparent",border:"none",borderBottom:`1px solid ${th.borderSoft}`,color:page==="trade_machine"?th.text:th.textMuted,cursor:"pointer",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>
            <BarChartIcon size={13}/><span>Trade Machine</span>
          </button>
          <button onClick={()=>{setPage("draft");setSidebarOpen(false);}}
            style={{display:"flex",alignItems:"center",justifyContent:"flex-start",gap:8,padding:"10px 14px",background:page==="draft"?"rgba(249,115,22,0.12)":"none",borderLeft:page==="draft"?"2px solid #f97316":"2px solid transparent",border:"none",borderBottom:`1px solid ${th.borderSoft}`,color:page==="draft"?th.text:th.textMuted,cursor:"pointer",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>
            <TargetIcon size={13}/><span>Draft</span>
          </button>
          <button onClick={()=>setTeamsExpanded(v=>!v)} aria-expanded={teamsExpanded}
            style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"none",border:"none",borderBottom:`1px solid ${th.borderSoft}`,color:th.textMuted,cursor:"pointer",textAlign:"left",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>
            <span>Teams</span>
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:th.closeBtn,transition:"transform 0.18s ease",transform:teamsExpanded?"rotate(90deg)":"rotate(0deg)",flexShrink:0}}>
              <path d="M3 1.5L7 5L3 8.5"/>
            </svg>
          </button>
          {teamsExpanded && <TeamList/>}
        </div>
        <div style={{borderTop:`1px solid ${th.borderSoft}`,padding:"12px 14px"}}>
          <a href="/admin/login"
            style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:th.surfaceAlt,border:`1px solid ${th.border}`,borderRadius:7,color:th.text,textDecoration:"none",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Admin Sign-In</span>
          </a>
        </div>
      </div>
    </>
  );

  // ── Trade Machine ──────────────────────────────────────────────
  if (page === "trade_machine") {
    return (
      <div style={{minHeight:"100vh",background:th.bgGradient,display:"flex",flexDirection:"column"}}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:${th.bg};color:${th.text};font-family:'Barlow',sans-serif}
          ::-webkit-scrollbar{width:5px;height:5px}
          ::-webkit-scrollbar-track{background:transparent}
          ::-webkit-scrollbar-thumb{background:${th.border};border-radius:99px}
        `}</style>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:`1px solid ${th.borderSoft}`,flexShrink:0}}>
          <button aria-label="Open teams menu" aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(true)}
            style={{background:th.surfaceAlt,border:`1px solid ${th.border}`,borderRadius:8,padding:"9px 11px",color:th.text,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
            <HamburgerIcon size={16}/>
          </button>
          <button onClick={()=>setPage("landing")} aria-label="Back to home"
            style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",padding:"4px 6px"}}>
            <div style={{width:30,height:30,borderRadius:7,background:"linear-gradient(135deg,#f97316,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}><BasketballIcon size={16}/></div>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,letterSpacing:1,color:th.text}}>GVO SIM LEAGUE</span>
          </button>
          <div style={{marginLeft:"auto"}}>
            <button onClick={()=>setPage("landing")}
              style={{background:"none",border:`1px solid ${th.border}`,borderRadius:7,padding:"6px 12px",color:th.textMuted,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>
              ← Home
            </button>
          </div>
        </div>
        <div style={{flex:1,maxWidth:1200,width:"100%",margin:"0 auto",padding:"24px 20px 32px"}}>
          <div style={{marginBottom:18}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:4,color:th.textSubtle,textTransform:"uppercase",marginBottom:4}}>Front Office</div>
            <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(24px,5vw,38px)",lineHeight:1,color:th.text}}>Trade Machine</h1>
          </div>
          <TradeMachine theme={theme}/>
        </div>
        <div style={{borderTop:`1px solid ${th.borderSoft}`,padding:"10px 20px",textAlign:"center",color:th.textVeryMuted,fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:3,textTransform:"uppercase",flexShrink:0}}>
          GVO 25-26 · OVR from 2KRatings.com · Syncs hourly
        </div>
        {drawer}
      </div>
    );
  }

  // ── Draft Page ─────────────────────────────────────────────────
  if (page === "draft") {
    return (
      <div style={{minHeight:"100vh",background:th.bgGradient,display:"flex",flexDirection:"column"}}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:${th.bg};color:${th.text};font-family:'Barlow',sans-serif}
          ::-webkit-scrollbar{width:5px;height:5px}
          ::-webkit-scrollbar-track{background:transparent}
          ::-webkit-scrollbar-thumb{background:${th.border};border-radius:99px}
        `}</style>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:`1px solid ${th.borderSoft}`,flexShrink:0}}>
          <button aria-label="Open teams menu" aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(true)}
            style={{background:th.surfaceAlt,border:`1px solid ${th.border}`,borderRadius:8,padding:"9px 11px",color:th.text,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
            <HamburgerIcon size={16}/>
          </button>
          <button onClick={()=>setPage("landing")} aria-label="Back to home"
            style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",padding:"4px 6px"}}>
            <div style={{width:30,height:30,borderRadius:7,background:"linear-gradient(135deg,#f97316,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}><BasketballIcon size={16}/></div>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,letterSpacing:1,color:th.text}}>GVO SIM LEAGUE</span>
          </button>
          <div style={{marginLeft:"auto"}}>
            <button onClick={()=>setPage("landing")}
              style={{background:"none",border:`1px solid ${th.border}`,borderRadius:7,padding:"6px 12px",color:th.textMuted,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>
              ← Home
            </button>
          </div>
        </div>
        <div style={{flex:1,maxWidth:1100,width:"100%",margin:"0 auto",padding:"24px 20px 32px"}}>
          <div style={{marginBottom:18}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:4,color:th.textSubtle,textTransform:"uppercase",marginBottom:4}}>2026 NBA Draft</div>
            <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(24px,5vw,38px)",lineHeight:1,color:th.text}}>Draft Board</h1>
          </div>
          <DraftPage theme={theme}/>
        </div>
        <div style={{borderTop:`1px solid ${th.borderSoft}`,padding:"10px 20px",textAlign:"center",color:th.textVeryMuted,fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:3,textTransform:"uppercase",flexShrink:0}}>
          GVO 25-26 · OVR from 2KRatings.com · Syncs hourly
        </div>
        {drawer}
      </div>
    );
  }

  // ── Discord Feed Pages (Sim News / Rumor Mill / League Analysis) ──
  if (FEED_PAGES[page]) {
    const { title, channel } = FEED_PAGES[page];
    return (
      <div style={{minHeight:"100vh",background:th.bgGradient,display:"flex",flexDirection:"column"}}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:${th.bg};color:${th.text};font-family:'Barlow',sans-serif}
          ::-webkit-scrollbar{width:5px;height:5px}
          ::-webkit-scrollbar-track{background:transparent}
          ::-webkit-scrollbar-thumb{background:${th.border};border-radius:99px}
        `}</style>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:`1px solid ${th.borderSoft}`,flexShrink:0}}>
          <button aria-label="Open teams menu" aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(true)}
            style={{background:th.surfaceAlt,border:`1px solid ${th.border}`,borderRadius:8,padding:"9px 11px",color:th.text,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
            <HamburgerIcon size={16}/>
          </button>
          <button onClick={()=>setPage("landing")} aria-label="Back to home"
            style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",padding:"4px 6px"}}>
            <div style={{width:30,height:30,borderRadius:7,background:"linear-gradient(135deg,#f97316,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}><BasketballIcon size={16}/></div>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,letterSpacing:1,color:th.text}}>GVO SIM LEAGUE</span>
          </button>
          <div style={{marginLeft:"auto"}}>
            <button onClick={()=>setPage("landing")}
              style={{background:"none",border:`1px solid ${th.border}`,borderRadius:7,padding:"6px 12px",color:th.textMuted,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>
              ← Home
            </button>
          </div>
        </div>
        <div style={{flex:1,maxWidth:760,width:"100%",margin:"0 auto",padding:"24px 20px 32px"}}>
          <div style={{marginBottom:18}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:4,color:th.textSubtle,textTransform:"uppercase",marginBottom:4}}>Latest from Discord</div>
            <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(24px,5vw,38px)",lineHeight:1,color:th.text}}>{title}</h1>
          </div>
          <DiscordFeedPage channel={channel} theme={theme}/>
        </div>
        <div style={{borderTop:`1px solid ${th.borderSoft}`,padding:"10px 20px",textAlign:"center",color:th.textVeryMuted,fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:3,textTransform:"uppercase",flexShrink:0}}>
          GVO 25-26 · OVR from 2KRatings.com · Syncs hourly
        </div>
        {drawer}
      </div>
    );
  }

  // ── Landing Page ──────────────────────────────────────────────
  if (page === "landing") {
    return (
      <div style={{minHeight:"100vh",background:th.bgGradient,display:"flex",flexDirection:"column"}}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:${th.bg};color:${th.text};font-family:'Barlow',sans-serif}
          input::placeholder{color:${th.textVeryMuted}}
          ::-webkit-scrollbar{width:5px;height:5px}
          ::-webkit-scrollbar-track{background:transparent}
          ::-webkit-scrollbar-thumb{background:${th.border};border-radius:99px}
        `}</style>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",padding:"14px 20px",borderBottom:`1px solid ${th.borderSoft}`,flexShrink:0}}>
          <button aria-label="Open teams menu" aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(true)}
            style={{background:th.surfaceAlt,border:`1px solid ${th.border}`,borderRadius:8,padding:"9px 11px",color:th.text,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
            <HamburgerIcon size={16}/>
          </button>
        </div>
        {/* Compact hero */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"28px 20px 12px",textAlign:"center"}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:54,height:54,borderRadius:14,background:"linear-gradient(135deg,#f97316,#ef4444)",color:"#fff",marginBottom:14,boxShadow:"0 0 40px rgba(249,115,22,0.25)"}}><BasketballIcon size={28}/></div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:5,color:th.textSubtle,textTransform:"uppercase",marginBottom:4}}>GVO 25-26 Season</div>
          <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(26px,5vw,44px)",lineHeight:1,marginBottom:4,color:th.text}}>SIM LEAGUE</h1>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:4,color:th.textSubtle,textTransform:"uppercase",marginBottom:18}}>Front Office Dashboard</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center"}}>
            {[["sim_news","Sim News"],["rumor_mill","Rumor Mill"],["league_analysis","League Analysis"]].map(([key,label])=>(
              <button key={key} onClick={()=>setPage(key)}
                style={{padding:"12px 22px",borderRadius:10,border:`1px solid ${th.border}`,background:th.surfaceAlt,color:th.text,cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:13,letterSpacing:2,textTransform:"uppercase",minWidth:140,transition:"background 0.15s ease,border-color 0.15s ease"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(249,115,22,0.12)";e.currentTarget.style.borderColor="rgba(249,115,22,0.5)";}}
                onMouseLeave={e=>{e.currentTarget.style.background=th.surfaceAlt;e.currentTarget.style.borderColor=th.border;}}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {/* League Tabs */}
        <div style={{flex:1,maxWidth:1100,width:"100%",margin:"0 auto",padding:"16px 20px 32px"}}>
          <div style={{display:"flex",gap:3,marginBottom:16,background:th.surfaceAlt,borderRadius:9,padding:3,width:"fit-content"}}>
            {[["standings", BarChartIcon, "Standings"],["leaderboard", TargetIcon, "Leaderboard"],["league_stats", ClipboardIcon, "League Stats"]].map(([key, Icon, label])=>(
              <button key={key} onClick={()=>setLeagueTab(key)}
                style={{padding:"7px 16px",borderRadius:7,border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,letterSpacing:1,background:leagueTab===key?"rgba(249,115,22,0.9)":"transparent",color:leagueTab===key?"#fff":th.textMuted,display:"inline-flex",alignItems:"center",gap:6}}>
                <Icon size={13}/><span>{label}</span>
              </button>
            ))}
          </div>
          {leagueTab === "standings"    && <Standings    theme={theme} onTeamClick={pick}/>}
          {leagueTab === "leaderboard"  && <Leaderboard  theme={theme}/>}
          {leagueTab === "league_stats" && <LeagueStats  theme={theme}/>}
        </div>
        {/* Footer */}
        <div style={{borderTop:`1px solid ${th.borderSoft}`,padding:"10px 20px",textAlign:"center",color:th.textVeryMuted,fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:3,textTransform:"uppercase",flexShrink:0}}>
          GVO 25-26 · OVR from 2KRatings.com · Syncs hourly
        </div>
        {drawer}
      </div>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${th.bg};color:${th.text};font-family:'Barlow',sans-serif;min-height:100vh}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${th.border};border-radius:99px}
        input::placeholder{color:${th.textVeryMuted}}
        @media(max-width:640px){.desk{display:none!important}}
        @media(min-width:641px){.mob{display:none!important}}
      `}</style>

      <div style={{display:"flex",minHeight:"100vh",background:th.bgGradient}}>

        {/* Desktop Sidebar */}
        <div className="desk" style={{width:200,flexShrink:0,background:th.surface,borderRight:`1px solid ${th.borderSoft}`,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
          <button onClick={()=>setPage("landing")} style={{padding:"16px",borderBottom:`1px solid ${th.borderSoft}`,display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",textAlign:"left",width:"100%"}}>
            <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#f97316,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0}}><BasketballIcon size={18}/></div>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,letterSpacing:1,lineHeight:1,color:th.text}}>GVO SIM LEAGUE</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,letterSpacing:3,color:th.textSubtle,textTransform:"uppercase"}}>Front Office</div>
            </div>
          </button>
          <TeamList/>
        </div>

        {/* Slide-out drawer (mobile + landing) */}
        {drawer}

        {/* Main Content */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
          {/* Mobile Header */}
          <div className="mob" style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:`1px solid ${th.borderSoft}`,background:th.headerBg,position:"sticky",top:0,zIndex:100}}>
            <button aria-label="Open teams menu" aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(true)} style={{background:th.surfaceAlt,border:`1px solid ${th.border}`,borderRadius:7,padding:"6px 10px",color:th.text,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}><HamburgerIcon size={16}/></button>
            <button onClick={()=>setPage("landing")} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer"}}>
              <div style={{width:26,height:26,borderRadius:6,background:"linear-gradient(135deg,#f97316,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}><BasketballIcon size={15}/></div>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,letterSpacing:1,color:th.text}}>GVO SIM LEAGUE</span>
            </button>
            <span style={{marginLeft:"auto",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:14,color,letterSpacing:1}}>{sel}</span>
          </div>

          <div style={{flex:1,maxWidth:980,width:"100%",margin:"0 auto",padding:"24px 20px",overflowY:"auto"}}>
            {/* Team Header */}
            <div style={{marginBottom:18}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,letterSpacing:4,color:th.textSubtle,textTransform:"uppercase",marginBottom:4}}>Team Overview</div>
              <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:"clamp(22px,5vw,42px)",lineHeight:1,borderLeft:`4px solid ${color}`,paddingLeft:12,marginBottom:6,color:th.text}}>{FULL[sel]}</h1>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,letterSpacing:3,color:th.textSubtle,textTransform:"uppercase",paddingLeft:12,display:"flex",flexWrap:"wrap",gap:"4px 18px"}}>
                <span>{players.length} Players</span>
                {info.gm&&<span>GM: <span style={{color:th.textMuted}}>{info.gm}</span></span>}
                {info.ovr&&<span>Avg OVR: <span style={{color:"#60a5fa"}}>{info.ovr}</span></span>}
              </div>
            </div>

            {/* Cap Row */}
            {info.cap!=null&&<CapRow capSpace={info.cap} th={th}/>}

            {/* Tab Switcher */}
            <div style={{display:"flex",gap:3,marginBottom:16,background:th.surfaceAlt,borderRadius:9,padding:3,width:"fit-content"}}>
              {[["roster", ClipboardIcon, "Roster"], ["picks", TargetIcon, "Picks"], ["stats", BarChartIcon, "Stats"]].map(([key, Icon, label])=>(
                <button key={key} onClick={()=>setTab(key)} style={{padding:"7px 16px",borderRadius:7,border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,letterSpacing:1,background:tab===key?"rgba(249,115,22,0.9)":"transparent",color:tab===key?"#fff":th.textMuted,display:"inline-flex",alignItems:"center",gap:6}}>
                  <Icon size={13}/><span>{label}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{background:th.tableBg,border:`1px solid ${th.border}`,borderRadius:12,overflow:"hidden"}}>
              {tab==="roster"&&<RosterTable players={players} seasonLabels={seasonLabels} th={th}/>}
              {tab==="picks"&&<DraftPicksTable teamAbbr={sel} theme={theme} />}
              {tab==="stats"&&<TeamStatsTable teamAbbr={sel} theme={theme} />}
            </div>
          </div>

          <div style={{borderTop:`1px solid ${th.borderSoft}`,padding:"12px 20px",textAlign:"center",color:th.textVeryMuted,fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:3,textTransform:"uppercase"}}>
            GVO 25-26 · OVR from 2KRatings.com · Syncs hourly
          </div>
        </div>
      </div>
    </>
  );
}
