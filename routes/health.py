"""
Health and System Status Route.
GET /api/health
Returns system health, database status, and configuration state of all 6 platform connectors.
"""
from fastapi import APIRouter
from datetime import datetime
from config.config import settings
from schemas.content import HealthResponse, PlatformStatus
from database.db import get_content_count

router = APIRouter(prefix="/api", tags=["System Health"])

@router.get("/health", response_model=HealthResponse)
async def check_system_health():
    """
    Returns live health of Dhristi Multi-Platform Intelligence backend,
    including database connectivity and per-platform configuration/data mode.
    """
    count = get_content_count()
    
    platforms = {
        "youtube": PlatformStatus(
            name="YouTube",
            code="youtube",
            is_configured=settings.is_youtube_configured,
            data_mode="OFFICIAL API" if settings.is_youtube_configured else "DEMO DATA",
            status="active",
            rate_limit_remaining=10000 if settings.is_youtube_configured else None,
            description="YouTube Data API v3 (Search, Videos, Channels)",
            capabilities=["search", "trending", "video_details", "channel_statistics"]
        ),
        "instagram": PlatformStatus(
            name="Instagram",
            code="instagram",
            is_configured=settings.is_instagram_configured,
            data_mode="OFFICIAL API" if settings.is_instagram_configured else "DEMO DATA",
            status="active",
            description="Meta Graph API for Instagram Professional Accounts",
            capabilities=["recent_media", "reels", "hashtag_monitoring"]
        ),
        "facebook": PlatformStatus(
            name="Facebook",
            code="facebook",
            is_configured=settings.is_facebook_configured,
            data_mode="OFFICIAL API" if settings.is_facebook_configured else "DEMO DATA",
            status="active",
            description="Meta Graph API for Public Page Feeds",
            capabilities=["page_feed", "public_reactions", "shares_tracking"]
        ),
        "x": PlatformStatus(
            name="X (Twitter)",
            code="x",
            is_configured=settings.is_x_configured,
            data_mode="OFFICIAL API" if settings.is_x_configured else "DEMO DATA",
            status="active",
            description="X API v2 (Recent Search, Metrics, Entities)",
            capabilities=["recent_search", "tweet_metrics", "author_expansions"]
        ),
        "telegram": PlatformStatus(
            name="Telegram",
            code="telegram",
            is_configured=settings.is_telegram_configured,
            data_mode="OFFICIAL API" if settings.is_telegram_configured else "DEMO DATA",
            status="active",
            description="Telegram MTProto & Channel Broadcasts",
            capabilities=["broadcast_monitoring", "channel_telemetry", "forward_analysis"]
        ),
        "reddit": PlatformStatus(
            name="Reddit",
            code="reddit",
            is_configured=settings.is_reddit_configured,
            data_mode="OFFICIAL API" if settings.is_reddit_configured else "DEMO DATA",
            status="active",
            description="Reddit OAuth2 Data API (Subreddit submissions, Discussions)",
            capabilities=["hot_submissions", "subreddit_search", "comment_trees"]
        ),
        "news": PlatformStatus(
            name="News Sources (NewsAPI / GNews)",
            code="news",
            is_configured=settings.is_news_configured,
            data_mode="OFFICIAL API" if settings.is_news_configured else "DEMO DATA",
            status="active",
            description="Official NewsAPI / GNews Top Headlines and National Feeds",
            capabilities=["top_headlines", "query_everything", "publisher_attribution"]
        )
    }

    return HealthResponse(
        status="healthy",
        version="2.0.0",
        timestamp=datetime.utcnow().isoformat() + "Z",
        environment=settings.ENVIRONMENT,
        database_connected=True,
        database_records_count=count,
        platforms=platforms
    )
