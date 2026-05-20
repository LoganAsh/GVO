import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_key: str


def load_settings() -> Settings:
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set. "
            "Copy .env.example to .env and fill in the service_role key "
            "from Supabase dashboard > Project Settings > API."
        )
    return Settings(supabase_url=url, supabase_service_key=key)
