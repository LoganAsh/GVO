// discord-sync: pulls box score posts from the GVO Discord channel, reads the
// images with Claude, and publishes a game automatically when every check
// passes. Anything that fails a check stays in the admin review queue with the
// reason attached.
//
// Callers: the pg_cron job "gvo-discord-sync" (x-gvo-sync-secret header) and
// the admin portal (signed-in admin session).
//
// Body options:
//   {}                    poll Discord, retry failed parses, re-check the queue
//   { retry_failed:true } only retry failed parses and re-check the queue
//   { dry_run:true }      list new Discord messages without processing them
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-gvo-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json", ...CORS } });

const FAST_MODEL = "claude-haiku-4-5-20251001";
const STRONG_MODEL = "claude-sonnet-4-6";
const TIME_BUDGET_MS = 100_000; // stop starting new work after this, so the run finishes cleanly
const BUCKET = "box-scores";

const INT_FIELDS = ["min","pts","reb","ast","stl","blk","tov","fgm","fga","three_pm","three_pa","ftm","fta","oreb","fls"] as const;
type Row = { player_name: string } & Record<(typeof INT_FIELDS)[number], number>;

const PROMPT = `You are parsing an NBA-style box score image. Return ONLY a JSON object with this exact shape (no surrounding prose, no code fences):

{
  "team_hint": string | null,
  "rows": [
    { "player_name": string, "min": integer, "pts": integer, "reb": integer, "ast": integer, "stl": integer,
      "blk": integer, "tov": integer, "fgm": integer, "fga": integer, "three_pm": integer, "three_pa": integer,
      "ftm": integer, "fta": integer, "oreb": integer, "fls": integer }
  ]
}

Rules:
- The columns are typically: NAME, MIN, PTS, REB, AST, STL, BLK, TO, FG, 3PT, FT, OR, FLS. Read each row straight across; do not shift values between columns.
- FG / 3PT / FT cells are formatted like "14-21" meaning 14 made of 21 attempts. Split into the two integer fields.
- REB is total rebounds; OR is offensive rebounds only. Keep them separate.
- Use 0 for any missing or unclear value (do not omit the field).
- player_name must be exactly as displayed in the image (e.g. "A. Edwards", do not expand to "Anthony Edwards").
- Do NOT invent rows. Only include players visible in the box score. Do not include a team totals row.
- If the image is not a basketball box score, return {"team_hint": null, "rows": []}.
- team_hint can be a team abbreviation (e.g. "MIN") or city ("Wolves") if obvious; otherwise null.`;

const TEAM_NICKNAMES: Record<string, string[]> = {
  ATL: ["Hawks", "Atlanta"], BOS: ["Celtics", "Boston"], BKN: ["Nets", "Brooklyn"], CHA: ["Hornets", "Charlotte"],
  CHI: ["Bulls", "Chicago"], CLE: ["Cavaliers", "Cavs", "Cleveland"], DAL: ["Mavericks", "Mavs", "Dallas"],
  DEN: ["Nuggets", "Denver"], DET: ["Pistons", "Detroit"], GSW: ["Warriors", "Golden State", "GSW"],
  HOU: ["Rockets", "Houston"], IND: ["Pacers", "Indiana"], LAC: ["Clippers", "LA Clippers"], LAL: ["Lakers", "LA Lakers"],
  MEM: ["Grizzlies", "Memphis"], MIA: ["Heat", "Miami"], MIL: ["Bucks", "Milwaukee"],
  MIN: ["Timberwolves", "Wolves", "Minnesota"], NOP: ["Pelicans", "New Orleans"], NYK: ["Knicks", "New York"],
  OKC: ["Thunder", "OKC", "Oklahoma City", "Oklahoma"], ORL: ["Magic", "Orlando"], PHI: ["76ers", "Sixers", "Philadelphia"],
  PHX: ["Suns", "Phoenix"], POR: ["Trail Blazers", "Blazers", "Portland"], SAC: ["Kings", "Sacramento"],
  SAS: ["Spurs", "San Antonio"], TOR: ["Raptors", "Toronto"], UTA: ["Jazz", "Utah"], WAS: ["Wizards", "Washington"],
};

// Two roster players who show up under the same screenshot name on one team.
// Rows are sorted by sortBy and assigned to candidates in order.
const DISAMBIG_RULES = [
  { team: "IND", typed: "A. Thompson", candidates: ["Amen Thompson", "Ausar Thompson"],
    sortBy: (a: Row, b: Row) => (b.min || 0) - (a.min || 0) },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeName(raw: string) {
  const s = (raw || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\b(jr|sr|ii|iii|iv)\b/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const parts = s.split(" ");
  return parts.length === 1 ? { first: "", last: parts[0], key: s } : { first: parts[0], last: parts[parts.length - 1], key: s };
}

function parseGameInfo(text: string) {
  if (!text) return null;
  const hits: { abbr: string; idx: number }[] = [];
  for (const [abbr, names] of Object.entries(TEAM_NICKNAMES)) {
    let best = -1;
    for (const n of names) {
      const m = text.match(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
      if (m?.index != null && (best === -1 || m.index < best)) best = m.index;
    }
    if (best >= 0) hits.push({ abbr, idx: best });
  }
  hits.sort((a, b) => a.idx - b.idx);
  const scores = [...text.matchAll(/\b(\d{2,3})\s*-\s*(\d{2,3})\b/g)];
  const last = scores[scores.length - 1];
  return { teams: hits.map(h => h.abbr), high: last ? Math.max(+last[1], +last[2]) : null, low: last ? Math.min(+last[1], +last[2]) : null };
}

function rowProblems(r: Row): string[] {
  const p: string[] = [];
  if (r.pts !== 2 * r.fgm + r.three_pm + r.ftm) p.push("points don't match made shots");
  if (r.fgm > r.fga || r.three_pm > r.three_pa || r.ftm > r.fta) p.push("more makes than attempts");
  if (r.three_pa > r.fga || r.three_pm > r.fgm) p.push("3PT exceeds FG");
  if (r.oreb > r.reb) p.push("OR exceeds REB");
  if (r.min > 70 || INT_FIELDS.some(f => r[f] < 0)) p.push("impossible value");
  return p;
}
const badRowCount = (rows: Row[]) => rows.filter(r => rowProblems(r).length).length;

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function sniffMediaType(b: Uint8Array) {
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
  if (b[0] === 0x52 && b[8] === 0x57) return "image/webp";
  return "image/png";
}
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

async function readImage(apiKey: string, bytes: Uint8Array, model: string): Promise<Row[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model, max_tokens: 4096,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: sniffMediaType(bytes), data: bytesToBase64(bytes) } },
        { type: "text", text: PROMPT },
      ] }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  const reply: string = JSON.parse(text)?.content?.find((c: any) => c.type === "text")?.text || "";
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`Model reply had no JSON: ${reply.slice(0, 200)}`);
  const parsed = JSON.parse(m[0]);
  return (Array.isArray(parsed.rows) ? parsed.rows : []).map((r: any) => {
    const out: any = { player_name: String(r?.player_name || "").trim() };
    for (const f of INT_FIELDS) out[f] = Math.trunc(Number(r?.[f]) || 0);
    return out as Row;
  }).filter((r: Row) => r.player_name && !/^(team|totals?)$/i.test(r.player_name));
}

// Read with the fast model; if any row fails the math checks, re-read with the
// stronger model and keep whichever result has fewer bad rows.
async function readWithFallback(apiKey: string, bytes: Uint8Array) {
  let rows = await readImage(apiKey, bytes, FAST_MODEL);
  let model = FAST_MODEL;
  if (rows.length && badRowCount(rows) > 0) {
    try {
      const retry = await readImage(apiKey, bytes, STRONG_MODEL);
      if (retry.length && badRowCount(retry) < badRowCount(rows)) { rows = retry; model = STRONG_MODEL; }
    } catch { /* keep the first read */ }
  }
  return { rows, model };
}

// ── Roster matching ────────────────────────────────────────────────────────

type RosterP = { name: string; n: NonNullable<ReturnType<typeof normalizeName>> };
type Ctx = { rosters: Record<string, RosterP[]>; aliases: { team: string | null; key: string; roster_name: string }[] };

function candidatesFor(typed: string, team: string, ctx: Ctx): string[] {
  const n = normalizeName(typed);
  if (!n) return [];
  const alias = ctx.aliases.find(a => a.key === n.key && (a.team === team || a.team === null));
  const roster = ctx.rosters[team] || [];
  if (alias) return roster.some(p => p.name === alias.roster_name) ? [alias.roster_name] : [];
  const exact = roster.filter(p => p.n.key === n.key);
  if (exact.length) return exact.map(p => p.name);
  return roster.filter(p => p.n.last === n.last && (!n.first || !p.n.first || n.first[0] === p.n.first[0])).map(p => p.name);
}

function bestTeamFor(rows: Row[], ctx: Ctx) {
  let best = { team: "", hits: 0 };
  for (const team of Object.keys(ctx.rosters)) {
    const hits = rows.filter(r => candidatesFor(r.player_name, team, ctx).length > 0).length;
    if (hits > best.hits) best = { team, hits };
  }
  return best;
}

// Map every row to exactly one roster name, or return the names that failed.
function resolveRows(rows: Row[], team: string, ctx: Ctx): { names: string[] | null; unresolved: string[] } {
  const names: (string | null)[] = rows.map(r => {
    const c = candidatesFor(r.player_name, team, ctx);
    return c.length === 1 ? c[0] : null;
  });
  for (const rule of DISAMBIG_RULES) {
    if (rule.team !== team) continue;
    const typed = normalizeName(rule.typed)!.key;
    const idxs = rows.map((r, i) => (normalizeName(r.player_name)?.key === typed ? i : -1)).filter(i => i >= 0);
    if (!idxs.length || idxs.length > rule.candidates.length) continue;
    idxs.sort((a, b) => rule.sortBy(rows[a], rows[b])).forEach((rowIdx, k) => { names[rowIdx] = rule.candidates[k]; });
  }
  const unresolved = rows.filter((_, i) => !names[i]).map(r => r.player_name);
  const dupes = names.filter((n, i) => n && names.indexOf(n) !== i);
  if (dupes.length) unresolved.push(...dupes.map(d => `${d} (matched twice)`));
  return unresolved.length ? { names: null, unresolved } : { names: names as string[], unresolved: [] };
}

// ── Auto-import one Discord message ────────────────────────────────────────

const denverDate = (iso: string | null) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(iso ? new Date(iso) : new Date());

async function tryImport(db: SupabaseClient, ctx: Ctx, messageId: string): Promise<"imported" | "review" | "skip"> {
  const { data: rows } = await db.from("pending_box_scores").select("*")
    .eq("discord_message_id", messageId).eq("status", "pending").order("id");
  if (!rows?.length) return "skip";
  const ids = rows.map(r => r.id);
  const flag = async (reason: string) => {
    await db.from("pending_box_scores").update({ review_reason: reason }).in("id", ids);
    return "review" as const;
  };

  const { data: existing } = await db.from("games").select("id").eq("discord_message_id", messageId).maybeSingle();
  if (existing) {
    await db.from("pending_box_scores").update({ status: "approved", approved_game_id: existing.id, review_reason: null }).in("id", ids);
    return "skip";
  }
  if (rows.some(r => r.parse_error)) return flag("An image couldn't be read; it will be retried automatically.");

  // Images with no box score (memes, logos) are dropped from the queue.
  const empty = rows.filter(r => !(r.parsed_rows || []).length);
  if (empty.length) {
    await db.from("pending_box_scores").update({ status: "rejected", review_reason: "No box score found in this image." })
      .in("id", empty.map(r => r.id));
  }
  const imgs = rows.filter(r => (r.parsed_rows || []).length);
  if (!imgs.length) return "skip";
  const flagImgs = async (reason: string) => {
    await db.from("pending_box_scores").update({ review_reason: reason }).in("id", imgs.map(r => r.id));
    return "review" as const;
  };
  if (imgs.length !== 2) return flagImgs(`Expected 2 box score images in the post, found ${imgs.length}.`);

  // Which team is each image? Decided by roster names, not by image order.
  const sides = imgs.map(img => {
    const parsed = img.parsed_rows as Row[];
    const best = bestTeamFor(parsed, ctx);
    return { img, rows: parsed, team: best.team, hits: best.hits, sum: parsed.reduce((s, r) => s + r.pts, 0) };
  });
  for (const s of sides) {
    if (!s.team || s.hits < Math.ceil(s.rows.length * 0.6)) {
      return flagImgs(`Couldn't tell which team an image belongs to (best match ${s.team || "none"}, ${s.hits}/${s.rows.length} names).`);
    }
  }
  if (sides[0].team === sides[1].team) return flagImgs(`Both images matched ${sides[0].team}.`);

  const info = parseGameInfo(rows[0].message_text || "");
  const textTeams = new Set(info?.teams || []);
  if (!sides.every(s => textTeams.has(s.team))) {
    return flagImgs(`Recap text doesn't name both teams found in the images (${sides[0].team}, ${sides[1].team}).`);
  }
  if (info?.high == null) return flagImgs("Recap text has no final score.");
  if (sides[0].sum === sides[1].sum) return flagImgs("Both images total the same points.");
  const [win, lose] = sides[0].sum > sides[1].sum ? [sides[0], sides[1]] : [sides[1], sides[0]];
  if (win.sum !== info.high || lose.sum !== info.low) {
    return flagImgs(`Player points (${win.team} ${win.sum}, ${lose.team} ${lose.sum}) don't match the recap score ${info.high}-${info.low}.`);
  }

  const problems: string[] = [];
  for (const s of sides) for (const r of s.rows) {
    const p = rowProblems(r);
    if (p.length) problems.push(`${s.team} ${r.player_name}: ${p.join(", ")}`);
  }
  if (problems.length) return flagImgs(`Stat lines that don't add up: ${problems.slice(0, 4).join("; ")}${problems.length > 4 ? "…" : ""}`);

  const stats: any[] = [];
  for (const s of sides) {
    const res = resolveRows(s.rows, s.team, ctx);
    if (!res.names) return flagImgs(`No roster match on ${s.team} for: ${res.unresolved.join(", ")}. Add an alias or fix the roster.`);
    s.rows.forEach((r, i) => {
      const allZero = INT_FIELDS.every(f => !r[f]);
      stats.push({ ...r, team_abbr: s.team, player_name: res.names![i], player_id: null, dnp: allZero });
    });
  }

  const notes = (rows[0].message_text || "").replace(/\*\*/g, "").trim().slice(0, 250) || null;
  const { data: gameId, error } = await db.rpc("save_game", {
    p_game_id: null,
    p_game: {
      game_date: denverDate(rows[0].posted_at), winner_team: win.team, loser_team: lose.team,
      winner_score: win.sum, loser_score: lose.sum, notes, discord_message_id: messageId, source: "discord",
    },
    p_stats: stats,
  });
  if (error) {
    if (/duplicate key/i.test(error.message)) return "skip";
    return flagImgs(`Save failed: ${error.message}`);
  }
  await db.from("pending_box_scores").update({ status: "approved", approved_game_id: gameId, review_reason: null }).in("id", imgs.map(r => r.id));
  return "imported";
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const started = Date.now();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Auth: the cron secret, or a signed-in admin. The public app key is not enough.
  const secret = req.headers.get("x-gvo-sync-secret");
  let authorized = false;
  if (secret) {
    const { data } = await db.rpc("gvo_check_sync_secret", { p_secret: secret });
    authorized = data === true;
  } else {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (token) {
      const { data } = await db.auth.getUser(token);
      authorized = !!data?.user;
    }
  }
  if (!authorized) return json({ error: "Unauthorized" }, 401);

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const channelId = Deno.env.get("DISCORD_CHANNEL_ID");
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!botToken || !channelId || !apiKey) return json({ error: "Missing secrets: DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID or ANTHROPIC_API_KEY" }, 500);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const outOfTime = () => Date.now() - started > TIME_BUDGET_MS;

  const [{ data: rosterRows }, { data: aliasRows }] = await Promise.all([
    db.from("roster").select("team_abbr,player_name"),
    db.from("player_name_aliases").select("team_abbr,alias,roster_name"),
  ]);
  const ctx: Ctx = { rosters: {}, aliases: [] };
  for (const r of rosterRows || []) {
    const n = normalizeName(r.player_name);
    if (!r.team_abbr || !n) continue;
    (ctx.rosters[r.team_abbr] ||= []).push({ name: r.player_name, n });
  }
  for (const a of aliasRows || []) {
    const n = normalizeName(a.alias);
    if (n) ctx.aliases.push({ team: a.team_abbr, key: n.key, roster_name: a.roster_name });
  }

  const summary = { mode: body?.retry_failed ? "retry_failed" : body?.dry_run ? "dry_run" : "poll",
    fetched: 0, created_count: 0, error_count: 0, retried: 0, recovered: 0, imported_count: 0, needs_review: 0,
    caught_up: true, errors: [] as any[], messages: [] as any[] };
  const touched = new Set<string>();

  // 1) Poll Discord for new posts.
  if (!body?.retry_failed) {
    const cursorKey = `discord_last_message_id_${channelId}`;
    let after: string | null = body?.since_message_id || null;
    if (!after) after = (await db.from("app_kv").select("v").eq("k", cursorKey).maybeSingle()).data?.v || null;
    const saveCursor = async () => {
      if (!body?.dry_run && after) await db.from("app_kv").upsert({ k: cursorKey, v: after, updated_at: new Date().toISOString() }, { onConflict: "k" });
    };

    pages: for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({ limit: "100" });
      if (after) params.set("after", after);
      const dRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?${params}`,
        { headers: { Authorization: `Bot ${botToken}`, "User-Agent": "GVO-Sync (https://gvo-gamma.vercel.app)" } });
      if (!dRes.ok) return json({ error: `Discord ${dRes.status}`, detail: (await dRes.text()).slice(0, 300) }, 502);
      const messages: any[] = (await dRes.json()).sort((a: any, b: any) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
      if (!messages.length) break;
      summary.fetched += messages.length;

      for (const m of messages) {
        const images = (m.attachments || []).filter((a: any) => String(a?.content_type || "").startsWith("image/"));
        if (body?.dry_run) {
          summary.messages.push({ id: m.id, at: m.timestamp, images: images.length, text: String(m.content || "").slice(0, 120) });
          after = m.id;
          continue;
        }
        if (images.length && outOfTime()) { summary.caught_up = false; await saveCursor(); break pages; }
        for (const att of images) {
          const { data: seen } = await db.from("pending_box_scores").select("id")
            .eq("discord_message_id", m.id).eq("discord_attachment_id", String(att.id)).maybeSingle();
          if (seen) continue;
          let parsedRows: Row[] = [], parseError: string | null = null, storagePath: string | null = null;
          let imageUrl = att.url, model: string | null = null;
          try {
            const ir = await fetch(att.url);
            if (!ir.ok) throw new Error(`download HTTP ${ir.status}`);
            const bytes = new Uint8Array(await ir.arrayBuffer());
            const type = sniffMediaType(bytes);
            storagePath = `${m.id}/${att.id}.${EXT[type]}`;
            const up = await db.storage.from(BUCKET).upload(storagePath, bytes, { contentType: type, upsert: true });
            if (up.error) storagePath = null;
            else imageUrl = db.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
            const out = await readWithFallback(apiKey, bytes);
            parsedRows = out.rows; model = out.model;
          } catch (e) {
            parseError = (e as Error).message || String(e);
          }
          const { error: insErr } = await db.from("pending_box_scores").insert({
            discord_message_id: m.id, discord_attachment_id: String(att.id), discord_channel_id: channelId,
            image_url: imageUrl, storage_path: storagePath, message_text: m.content || null, posted_at: m.timestamp || null,
            parsed_rows: parsedRows, status: "pending", parse_error: parseError, model,
          });
          if (insErr) { summary.errors.push({ message_id: m.id, error: insErr.message }); summary.error_count++; continue; }
          summary.created_count++;
          if (parseError) summary.error_count++;
        }
        if (images.length) touched.add(m.id);
        after = m.id;
      }
      await saveCursor();
      if (messages.length < 100) break;
      if (page === 4) summary.caught_up = false;
    }
    if (body?.dry_run) return json(summary);
  }

  // 2) Retry images that failed to read, from the stored copy.
  const { data: failed } = await db.from("pending_box_scores").select("id,discord_message_id,image_url,storage_path")
    .eq("status", "pending").not("parse_error", "is", null).limit(20);
  for (const r of failed || []) {
    if (outOfTime()) { summary.caught_up = false; break; }
    summary.retried++;
    try {
      let bytes: Uint8Array;
      if (r.storage_path) {
        const { data, error } = await db.storage.from(BUCKET).download(r.storage_path);
        if (error || !data) throw new Error(`storage: ${error?.message}`);
        bytes = new Uint8Array(await data.arrayBuffer());
      } else {
        const ir = await fetch(r.image_url);
        if (!ir.ok) throw new Error(`download HTTP ${ir.status} (Discord link expired; re-upload by hand)`);
        bytes = new Uint8Array(await ir.arrayBuffer());
      }
      const out = await readWithFallback(apiKey, bytes);
      await db.from("pending_box_scores").update({ parsed_rows: out.rows, model: out.model, parse_error: null }).eq("id", r.id);
      summary.recovered++;
    } catch (e) {
      await db.from("pending_box_scores").update({ parse_error: (e as Error).message }).eq("id", r.id);
    }
    touched.add(r.discord_message_id);
  }

  // 3) Re-check everything still in the queue (new aliases or roster fixes may
  //    now let it through) and publish what passes.
  const { data: queued } = await db.from("pending_box_scores").select("discord_message_id").eq("status", "pending");
  for (const q of queued || []) touched.add(q.discord_message_id);
  for (const id of touched) {
    const result = await tryImport(db, ctx, id);
    if (result === "imported") summary.imported_count++;
    if (result === "review") summary.needs_review++;
  }
  return json(summary);
});
