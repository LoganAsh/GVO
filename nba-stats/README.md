# nba-stats

Pulls NBA stats via [`nba_api`](https://github.com/swar/nba_api) and loads
them into a Supabase Postgres database. Scope of v1: player season averages
(per-game), plus the supporting `nba_teams` and `nba_players` reference tables.

## Setup

```bash
cd nba-stats
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and replace the placeholder with your **service_role** key from
Supabase: Project Settings → API → `service_role` (the secret one, not the
publishable/anon key). It's needed because the NBA tables have RLS enabled
with read-only public access; writes go through service_role.

## Usage

```bash
# Sync all 30 teams (static data, rarely changes)
python -m nba_stats.cli sync-teams

# Sync the static player roster (~5,000 players, active + historical)
python -m nba_stats.cli sync-players

# Sync current-season player averages (Regular Season, PerGame)
python -m nba_stats.cli sync-season-stats

# Or do everything in one shot
python -m nba_stats.cli sync-all

# Pull a specific season / mode
python -m nba_stats.cli sync-season-stats --season 2023-24 --per-mode Per36
python -m nba_stats.cli sync-season-stats --season 2024-25 --season-type Playoffs
```

## Schema

Tables live in the `public` schema with an `nba_` prefix:

- `nba_teams` — 30 NBA teams (id, abbreviation, city, etc.)
- `nba_players` — static player roster (id, name, is_active, team_id)
- `nba_player_season_stats` — per-season averages keyed by
  `(player_id, season, season_type, per_mode)`. Stats columns mirror
  the [`LeagueDashPlayerStats`](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/leaguedashplayerstats.md)
  endpoint (gp, min, pts, reb, ast, fg_pct, fg3_pct, ft_pct, plus_minus, …).

RLS is enabled; anyone with the anon key can `SELECT`, but writes require
the service_role key.

## Next steps

For contextualized projections you'll likely want:

1. **Game logs** — per-game stat lines, needed for recent-form / matchup
   adjustments. Endpoint: `PlayerGameLog` or `LeagueGameLog`.
2. **Team pace / defensive rating** — opponent context. Endpoint:
   `LeagueDashTeamStats`.
3. **Schedule** — for upcoming-game projections. Endpoint:
   `LeagueGameFinder` / `ScoreboardV2`.

Each is a separate sync command following the same pattern as
`sync_player_season_stats` in `nba_stats/etl.py`.
