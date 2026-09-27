"""
Configuration module for Dhristi Multi-Platform Intelligence Backend.
Loads environment variables safely without exposing secrets.
"""
import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Locate .env file in backend directory
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

class Settings:
    # Server Settings
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # CORS Origins
    _cors_raw: str = os.getenv(
        "CORS_ORIGINS", 
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5000,http://127.0.0.1:5000"
    )
    CORS_ORIGINS: List[str] = [origin.strip() for origin in _cors_raw.split(",") if origin.strip()]

    # Data Refresh Interval in Minutes
    REFRESH_INTERVAL_MINUTES: int = int(os.getenv("REFRESH_INTERVAL_MINUTES", "15"))

    # Database
    DATABASE_PATH: Path = BASE_DIR / "data" / "multi_platform.db"
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_PATH.as_posix()}")

    # Official Platform Credentials
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "").strip()
    YOUTUBE_REFERER: str = os.getenv("YOUTUBE_REFERER", "").strip()
    INSTAGRAM_ACCESS_TOKEN: str = os.getenv("INSTAGRAM_ACCESS_TOKEN", "").strip()
    INSTAGRAM_ACCOUNT_ID: str = os.getenv("INSTAGRAM_ACCOUNT_ID", "").strip()
    FACEBOOK_ACCESS_TOKEN: str = os.getenv("FACEBOOK_ACCESS_TOKEN", "").strip()
    FACEBOOK_PAGE_ID: str = os.getenv("FACEBOOK_PAGE_ID", "").strip()
    X_API_KEY: str = os.getenv("X_API_KEY", "").strip()
    X_API_SECRET: str = os.getenv("X_API_SECRET", "").strip()
    X_BEARER_TOKEN: str = os.getenv("X_BEARER_TOKEN", "").strip()
    X_ACCESS_TOKEN: str = os.getenv("X_ACCESS_TOKEN", "").strip()
    X_ACCESS_TOKEN_SECRET: str = os.getenv("X_ACCESS_TOKEN_SECRET", "").strip()
    TELEGRAM_API_KEY: str = os.getenv("TELEGRAM_API_KEY", "").strip()
    TELEGRAM_API_HASH: str = os.getenv("TELEGRAM_API_HASH", "").strip()
    REDDIT_CLIENT_ID: str = os.getenv("REDDIT_CLIENT_ID", "").strip()
    REDDIT_CLIENT_SECRET: str = os.getenv("REDDIT_CLIENT_SECRET", "").strip()
    REDDIT_USER_AGENT: str = os.getenv("REDDIT_USER_AGENT", "DhristiIntelligence/1.0").strip()
    NEWS_API_KEY: str = os.getenv("NEWS_API_KEY", "").strip()
    GNEWS_API_KEY: str = os.getenv("GNEWS_API_KEY", "").strip()

    # Connector Configuration Checkers
    @property
    def is_youtube_configured(self) -> bool:
        return bool(self.YOUTUBE_API_KEY and len(self.YOUTUBE_API_KEY) > 10)

    @property
    def is_instagram_configured(self) -> bool:
        return bool(self.INSTAGRAM_ACCESS_TOKEN and len(self.INSTAGRAM_ACCESS_TOKEN) > 15)

    @property
    def is_facebook_configured(self) -> bool:
        return bool(self.FACEBOOK_ACCESS_TOKEN and len(self.FACEBOOK_ACCESS_TOKEN) > 15)

    @property
    def is_x_configured(self) -> bool:
        return bool(self.X_BEARER_TOKEN or (self.X_API_KEY and self.X_API_SECRET))

    @property
    def is_telegram_configured(self) -> bool:
        return bool(self.TELEGRAM_API_KEY or self.TELEGRAM_API_HASH)

    @property
    def is_reddit_configured(self) -> bool:
        return bool(self.REDDIT_CLIENT_ID and self.REDDIT_CLIENT_SECRET)

    @property
    def is_news_configured(self) -> bool:
        return bool(self.NEWS_API_KEY or self.GNEWS_API_KEY)

settings = Settings()
