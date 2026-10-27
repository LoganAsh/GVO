// sync-league-data: copies each team tab of the league's published Google
// Sheet into roster, team_cap, draft_picks and season_headers.
//
// The published Sheet address lives in app_kv (key gvo_sheet_pub_url) so a new
// season's Sheet is a one-row update. Team tab ids live in sheet_gids.
//
// The parser finds sections by their labels ("Player" header row, "Total" row,
// "Draft Picks" cell) instead of fixed row numbers, so added rows or columns in
// a new season's Sheet don't break it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const FALLBACK_PUBCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTebci5PJTpum58PBsx7rRl6Umj7hZTiLJEQjW0lBeMLB5k13jsAExgz_0dtm82qjZY57O71S9OyRJc/pub";
const TEAMS = ["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK","OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"];
const VALID_OPTIONS = new Set(["TO","PO","NG","2TO"]);

// Column positions within the roster block (0-based: A=0).
const COL = { name: 2, pos: 4, ovr: 5, salFirst: 6, option: 12, capA: 13, capB: 14, capC: 15 };
const SALARY_YEARS = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function parseCSV(text: string): string[][] {
  return text.split(/\r?\n/).map(line => {
    const row: string[] = []; let inQ = false; let cur = "";
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { row.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    row.push(cur.trim());
    return row;
  }).filter(r => r.some(c => c !== ""));
}

const cell = (r: string[] | undefined, i: number) => (r?.[i] || "").trim();
function cleanNum(v: string): number {
  const n = Number(String(v || "").replace(/[$,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}
function isMoney(s: string): boolean {
  const c = String(s || "").replace(/[$,\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(c) && Math.abs(Number(c)) > 10000;
}
function parseOptionType(v: string): string | null {
  const val = (v || "").trim().toUpperCase();
  return VALID_OPTIONS.has(val) ? val : null;
}
function parseSalaryLabel(v: string): string | null {
  const t = (v || "").trim();
  if (!t || isMoney(t)) return null;
  return t;
}

// "2027-2028" -> "2026-2027"
function previousSeason(label: string): string {
  const m = label.match(/^(\d{4})\s*-\s*(\d{2,4})$/);
  if (!m) return "";
  const a = Number(m[1]) - 1;
  const b = m[2].length === 2 ? String((Number(m[2]) - 1 + 100) % 100).padStart(2, "0") : String(Number(m[2]) - 1);
  return `${a}-${b}`;
}

function parseTeam(rows: string[][]) {
  // The roster header row has "Player" in the name column.
  const header = rows.findIndex(r => cell(r, COL.name) === "Player");
  if (header === -1) throw new Error('No "Player" header row found');

  // Season labels sit on the row above the header; the current year may be blank.
  const labelRow = rows[header - 1];
  const seasonHeaders = Array.from({ length: SALARY_YEARS }, (_, i) => cell(labelRow, COL.salFirst + i));
  if (!seasonHeaders[0] && seasonHeaders[1]) seasonHeaders[0] = previousSeason(seasonHeaders[1]);

  // Cap figures: thresholds on the header row, cap space two rows below it,
  // 2nd apron is the first figure over $200M further down that column.
  const cap: Record<string, number> = {};
  const hdr = rows[header];
  if (isMoney(cell(hdr, COL.capA))) cap["Salary Cap"] = cleanNum(cell(hdr, COL.capA));
  if (isMoney(cell(hdr, COL.capB))) cap["Luxury Tax"] = cleanNum(cell(hdr, COL.capB));
  if (isMoney(cell(hdr, COL.capC))) cap["1st Apron"] = cleanNum(cell(hdr, COL.capC));
  if (isMoney(cell(rows[header + 2], COL.capA))) cap["Cap Space"] = cleanNum(cell(rows[header + 2], COL.capA));
  for (let i = header + 1; i < Math.min(header + 12, rows.length); i++) {
    if (isMoney(cell(rows[i], COL.capA)) && cleanNum(cell(rows[i], COL.capA)) > 200_000_000) {
      cap["2nd Apron"] = cleanNum(cell(rows[i], COL.capA));
      break;
    }
  }

  // Players run from the row after the header until the "Total" row.
  const roster: any[] = [];
  for (let i = header + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = cell(r, COL.name);
    if (name === "Total" || name === "Extension" || name === "Years in Service") break;
    if (!name || /^[A-Z]$/.test(name)) continue;
    const salCells = Array.from({ length: SALARY_YEARS }, (_, k) => cell(r, COL.salFirst + k));
    const sals = salCells.map(s => (isMoney(s) ? cleanNum(s) : 0));
    const labels = salCells.map(parseSalaryLabel);
    roster.push({
      player_name: name,
      position: cell(r, COL.pos),
      ovr: cleanNum(cell(r, COL.ovr)) || null,
      salary_yr1: sals[0] || null, salary_yr2: sals[1] || null, salary_yr3: sals[2] || null,
      salary_yr4: sals[3] || null, salary_yr5: sals[4] || null,
      salary_yr1_label: labels[0], salary_yr2_label: labels[1], salary_yr3_label: labels[2],
      salary_yr4_label: labels[3], salary_yr5_label: labels[4],
      option_type: parseOptionType(cell(r, COL.option)),
      two_way: false,
    });
  }

  // Two-way players: listed under a "Two-Way Roster" label, with a header row
  // (Player, -, Position, Overall) and names below until the first blank.
  let tr = -1, tc = -1;
  for (let i = 0; i < rows.length && tr === -1; i++) {
    const c = rows[i].findIndex(v => v.trim() === "Two-Way Roster");
    if (c !== -1) { tr = i; tc = c; }
  }
  if (tr !== -1) {
    const start = cell(rows[tr + 1], tc) === "Player" ? tr + 2 : tr + 1;
    for (let i = start; i < rows.length; i++) {
      const name = cell(rows[i], tc);
      if (!name || name === "Draft Picks" || /^\d{4}$/.test(name)) break;
      roster.push({
        player_name: name, position: cell(rows[i], tc + 2), ovr: cleanNum(cell(rows[i], tc + 3)) || null,
        salary_yr1: null, salary_yr2: null, salary_yr3: null, salary_yr4: null, salary_yr5: null,
        salary_yr1_label: "Two-Way", salary_yr2_label: null, salary_yr3_label: null, salary_yr4_label: null, salary_yr5_label: null,
        option_type: null, two_way: true,
      });
    }
  }

  // Draft picks: wherever the "Draft Picks" label is, years are below it in
  // the same column and descriptions one column to the right.
  const picks: any[] = [];
  let pr = -1, pc = -1;
  for (let i = 0; i < rows.length && pr === -1; i++) {
    const c = rows[i].findIndex(v => v.trim() === "Draft Picks");
    if (c !== -1) { pr = i; pc = c; }
  }
  if (pr !== -1) {
    for (let i = pr + 1; i < rows.length; i++) {
      const year = cell(rows[i], pc);
      if (!/^\d{4}$/.test(year)) continue;
      picks.push({ pick_year: year, round: "", from_team: cell(rows[i], pc + 1), notes: "" });
    }
  }

  return { cap, roster, picks, seasonHeaders };
}

async function fetchCSV(pub: string, gid: string): Promise<{ rows?: string[][]; error?: string; attempts: number }> {
  const url = `${pub}?gid=${gid}&single=true&output=csv`;
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.length >= 32) return { rows: parseCSV(text), attempts: attempt };
        lastErr = `empty CSV body (len=${text?.length ?? 0})`;
      } else {
        lastErr = `HTTP ${res.status}`;
        if (res.status >= 400 && res.status < 500) return { error: lastErr, attempts: attempt };
      }
    } catch (e) {
      lastErr = `fetch threw: ${(e as Error).message || e}`;
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 300 * attempt + 100));
  }
  return { error: `CSV fetch failed after 3 attempts: ${lastErr}`, attempts: 3 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const reqUrl = new URL(req.url);
  const teamsParam = reqUrl.searchParams.get("teams");
  const teamsToSync = teamsParam ? teamsParam.split(",") : TEAMS;
  const dryRun = reqUrl.searchParams.get("dry_run") === "1";

  const { data: kv } = await supabase.from("app_kv").select("v").eq("k", "gvo_sheet_pub_url").maybeSingle();
  const pub = (kv?.v || FALLBACK_PUBCSV).replace(/\/pub(html)?(\?.*)?$/, "/pub");

  const { data: gidRows } = await supabase.from("sheet_gids").select("team_abbr,gid");
  const teamToGid: Record<string, string> = {};
  for (const r of (gidRows || [])) teamToGid[r.team_abbr] = r.gid;

  const results: any[] = [];
  let pendingHeaders: string[] | null = null;

  for (const abbr of teamsToSync) {
    const gid = teamToGid[abbr];
    if (!gid) { results.push({ team: abbr, ok: false, error: "GID unknown" }); continue; }
    const fetched = await fetchCSV(pub, gid);
    if (fetched.error || !fetched.rows) { results.push({ team: abbr, ok: false, error: fetched.error }); continue; }

    let parsed: ReturnType<typeof parseTeam>;
    try { parsed = parseTeam(fetched.rows); }
    catch (e) { results.push({ team: abbr, ok: false, error: `parse failed: ${(e as Error).message}` }); continue; }
    const { cap, roster, picks, seasonHeaders } = parsed;

    // Never wipe a team's roster because of a bad read.
    if (roster.filter(r => !r.two_way).length < 5) { results.push({ team: abbr, ok: false, error: `only ${roster.length} players parsed; left existing data alone` }); continue; }
    if (!pendingHeaders && seasonHeaders.some(h => h)) pendingHeaders = seasonHeaders;

    if (!dryRun) {
      await supabase.from("team_cap").delete().eq("team_abbr", abbr);
      await supabase.from("roster").delete().eq("team_abbr", abbr);
      await supabase.from("draft_picks").delete().eq("team_abbr", abbr);
      if (Object.keys(cap).length)
        await supabase.from("team_cap").insert(Object.entries(cap).map(([label, value]) => ({ team_abbr: abbr, label, value })));
      await supabase.from("roster").insert(roster.map(r => ({ ...r, team_abbr: abbr })));
      if (picks.length) await supabase.from("draft_picks").insert(picks.map(p => ({ ...p, team_abbr: abbr })));
    }
    results.push({ team: abbr, ok: true, players: roster.length, two_way: roster.filter(r => r.two_way).map(r => r.player_name), picks: picks.length, cap,
      sample: dryRun ? roster.slice(0, 3) : roster[0]?.player_name });
  }

  if (pendingHeaders && !dryRun) {
    const rows = pendingHeaders.map((label, i) => ({ year_index: i + 1, label: label || `Yr ${i + 1}` }));
    await supabase.from("season_headers").upsert(rows, { onConflict: "year_index" });
  }

  const failed = results.filter(r => !r.ok).length;
  return new Response(JSON.stringify({ dry_run: dryRun, ok_count: results.length - failed, failed_count: failed, seasonHeaders: pendingHeaders, results }, null, 2), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
});
