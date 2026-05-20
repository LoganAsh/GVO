from typing import Any, Iterable

from supabase import Client

from . import fetch


STAT_COLUMNS = (
    "team_id", "team_abbreviation", "age", "gp", "w", "l", "w_pct", "min",
    "fgm", "fga", "fg_pct", "fg3m", "fg3a", "fg3_pct", "ftm", "fta", "ft_pct",
    "oreb", "dreb", "reb", "ast", "tov", "stl", "blk", "blka", "pf", "pfd",
    "pts", "plus_minus", "nba_fantasy_pts", "dd2", "td3",
)


def _chunks(rows: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def sync_teams(client: Client) -> int:
    raw = fetch.fetch_teams()
    rows = [
        {
            "team_id": t["id"],
            "abbreviation": t.get("abbreviation"),
            "full_name": t.get("full_name"),
            "city": t.get("city"),
            "nickname": t.get("nickname"),
            "state": t.get("state"),
            "year_founded": t.get("year_founded"),
        }
        for t in raw
    ]
    client.table("nba_teams").upsert(rows, on_conflict="team_id").execute()
    return len(rows)


def sync_players(client: Client) -> int:
    raw = fetch.fetch_players(active_only=False)
    rows = [
        {
            "player_id": p["id"],
            "full_name": p["full_name"],
            "first_name": p.get("first_name"),
            "last_name": p.get("last_name"),
            "is_active": bool(p.get("is_active", False)),
        }
        for p in raw
    ]
    for batch in _chunks(rows, 500):
        client.table("nba_players").upsert(batch, on_conflict="player_id").execute()
    return len(rows)


def sync_player_season_stats(
    client: Client,
    season: str,
    season_type: str = "Regular Season",
    per_mode: str = "PerGame",
) -> int:
    raw = fetch.fetch_league_player_stats(season, season_type, per_mode)
    rows = []
    for r in raw:
        row = {
            "player_id": r["player_id"],
            "season": season,
            "season_type": season_type,
            "per_mode": per_mode,
        }
        for col in STAT_COLUMNS:
            row[col] = r.get(col)
        rows.append(row)

    if not rows:
        return 0

    # Players returned by LeagueDashPlayerStats may not be in the static
    # players list yet (e.g. mid-season call-ups). Ensure they exist so the
    # FK on nba_player_season_stats holds.
    player_stub_rows = [
        {
            "player_id": r["player_id"],
            "full_name": r.get("player_name") or f"Player {r['player_id']}",
            "is_active": True,
        }
        for r in raw
    ]
    for batch in _chunks(player_stub_rows, 500):
        client.table("nba_players").upsert(
            batch, on_conflict="player_id", ignore_duplicates=True
        ).execute()

    for batch in _chunks(rows, 500):
        client.table("nba_player_season_stats").upsert(
            batch, on_conflict="player_id,season,season_type,per_mode"
        ).execute()
    return len(rows)
