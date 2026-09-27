"""
Platform Registry Route.
GET /api/platforms
Lists all supported platforms, connection requirements, developer portals, and capabilities.
"""
from fastapi import APIRouter
from config.config import settings

router = APIRouter(prefix="/api", tags=["Platforms"])

@router.get("/platforms")
async def list_platforms():
    """Lists all integrated platforms and their current integration status."""
    return {
        "status": "success",
        "total_platforms": 7,
        "platforms": [
            {
                "code": "youtube",
                "name": "YouTube",
                "developer_portal": "https://console.cloud.google.com/",
                "api_name": "YouTube Data API v3",
                "required_credential": "YOUTUBE_API_KEY",
                "is_configured": settings.is_youtube_configured,
                "data_mode": "OFFICIAL API" if settings.is_youtube_configured else "DEMO DATA",
                "supported_filters": ["query", "category", "limit"],
                "limitations": "10,000 quota units/day on default Google Cloud tier."
            },
            {
                "code": "instagram",
                "name": "Instagram",
                "developer_portal": "https://developers.facebook.com/",
                "api_name": "Meta Graph API (Instagram Professional)",
                "required_credential": "INSTAGRAM_ACCESS_TOKEN",
                "is_configured": settings.is_instagram_configured,
                "data_mode": "OFFICIAL API" if settings.is_instagram_configured else "DEMO DATA",
                "supported_filters": ["limit", "query"],
                "limitations": "Requires connected Instagram Business or Creator account."
            },
            {
                "code": "facebook",
                "name": "Facebook",
                "developer_portal": "https://developers.facebook.com/",
                "api_name": "Meta Graph API (Page Public Feed)",
                "required_credential": "FACEBOOK_ACCESS_TOKEN",
                "is_configured": settings.is_facebook_configured,
                "data_mode": "OFFICIAL API" if settings.is_facebook_configured else "DEMO DATA",
                "supported_filters": ["limit", "query"],
                "limitations": "Read access restricted to managed or public page feeds."
            },
            {
                "code": "x",
                "name": "X (Twitter)",
                "developer_portal": "https://developer.x.com/",
                "api_name": "X API v2",
                "required_credential": "X_BEARER_TOKEN",
                "is_configured": settings.is_x_configured,
                "data_mode": "OFFICIAL API" if settings.is_x_configured else "DEMO DATA",
                "supported_filters": ["query", "limit"],
                "limitations": "Basic tier search is limited to tweets from the last 7 days."
            },
            {
                "code": "telegram",
                "name": "Telegram",
                "developer_portal": "https://my.telegram.org/",
                "api_name": "Telegram MTProto & Channel Broadcasts",
                "required_credential": "TELEGRAM_API_KEY, TELEGRAM_API_HASH",
                "is_configured": settings.is_telegram_configured,
                "data_mode": "OFFICIAL API" if settings.is_telegram_configured else "DEMO DATA",
                "supported_filters": ["query", "limit"],
                "limitations": "Public channel broadcasts and verified security wire feeds."
            },
            {
                "code": "reddit",
                "name": "Reddit",
                "developer_portal": "https://www.reddit.com/prefs/apps",
                "api_name": "Reddit OAuth2 Data API",
                "required_credential": "REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET",
                "is_configured": settings.is_reddit_configured,
                "data_mode": "OFFICIAL API" if settings.is_reddit_configured else "DEMO DATA",
                "supported_filters": ["subreddit", "query", "limit"],
                "limitations": "OAuth rate limit of 60 requests/minute."
            },
            {
                "code": "news",
                "name": "News Sources (NewsAPI / GNews)",
                "developer_portal": "https://newsapi.org/ or https://gnews.io/",
                "api_name": "NewsAPI / GNews REST API",
                "required_credential": "NEWS_API_KEY or GNEWS_API_KEY",
                "is_configured": settings.is_news_configured,
                "data_mode": "OFFICIAL API" if settings.is_news_configured else "DEMO DATA",
                "supported_filters": ["query", "category", "limit"],
                "limitations": "Free developer tier limited to 100 requests/day."
            }
        ]
    }
