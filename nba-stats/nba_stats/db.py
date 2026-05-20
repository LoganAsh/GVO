from supabase import Client, create_client

from .config import Settings


def get_client(settings: Settings) -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)
