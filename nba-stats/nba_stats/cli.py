import argparse
import sys

from . import etl, fetch
from .config import load_settings
from .db import get_client


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="nba-stats", description="Sync NBA stats to Supabase.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("sync-teams", help="Sync NBA teams (static list).")
    sub.add_parser("sync-players", help="Sync the NBA static player roster.")

    p_stats = sub.add_parser(
        "sync-season-stats",
        help="Sync league-wide player season stats for a given season.",
    )
    p_stats.add_argument(
        "--season",
        default=fetch.current_season(),
        help="Season string, e.g. 2024-25. Defaults to the current NBA season.",
    )
    p_stats.add_argument(
        "--season-type",
        default="Regular Season",
        choices=["Pre Season", "Regular Season", "Playoffs", "All Star"],
    )
    p_stats.add_argument(
        "--per-mode",
        default="PerGame",
        choices=["Totals", "PerGame", "Per36", "Per48", "Per100Possessions"],
    )

    sub.add_parser(
        "sync-all",
        help="Run teams + players + current-season per-game stats in order.",
    )

    args = parser.parse_args(argv)
    settings = load_settings()
    client = get_client(settings)

    if args.cmd == "sync-teams":
        n = etl.sync_teams(client)
        print(f"Upserted {n} teams.")
    elif args.cmd == "sync-players":
        n = etl.sync_players(client)
        print(f"Upserted {n} players.")
    elif args.cmd == "sync-season-stats":
        n = etl.sync_player_season_stats(
            client, args.season, args.season_type, args.per_mode
        )
        print(f"Upserted {n} {args.season} {args.season_type} {args.per_mode} stat rows.")
    elif args.cmd == "sync-all":
        nt = etl.sync_teams(client)
        np_ = etl.sync_players(client)
        season = fetch.current_season()
        ns = etl.sync_player_season_stats(client, season)
        print(f"Teams: {nt}  Players: {np_}  {season} PerGame stats: {ns}")
    else:
        parser.error(f"Unknown command: {args.cmd}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
