from datetime import date
from typing import Any

from nba_api.stats.endpoints import LeagueDashPlayerStats
from nba_api.stats.static import players, teams


def current_season(today: date | None = None) -> str:
    today = today or date.today()
    start_year = today.year if today.month >= 8 else today.year - 1
    end_short = (start_year + 1) % 100
    return f"{start_year}-{end_short:02d}"


def fetch_teams() -> list[dict[str, Any]]:
    return list(teams.get_teams())


def fetch_players(active_only: bool = False) -> list[dict[str, Any]]:
    return list(players.get_active_players() if active_only else players.get_players())


def fetch_league_player_stats(
    season: str,
    season_type: str = "Regular Season",
    per_mode: str = "PerGame",
    timeout: int = 60,
) -> list[dict[str, Any]]:
    endpoint = LeagueDashPlayerStats(
        season=season,
        season_type_all_star=season_type,
        per_mode_detailed=per_mode,
        timeout=timeout,
    )
    frames = endpoint.get_data_frames()
    if not frames:
        return []
    df = frames[0]
    df.columns = [c.lower() for c in df.columns]
    return df.to_dict(orient="records")
