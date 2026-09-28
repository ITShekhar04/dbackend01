"""
Individual Platform Search and Retrieval Endpoints.
GET /api/youtube/search
GET /api/instagram/search
GET /api/facebook/search
GET /api/x/search
GET /api/reddit/search
GET /api/news/search
"""
from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime

from schemas.content import ContentListResponse
from services.youtube import youtube_service
from services.instagram import instagram_service
from services.facebook import facebook_service
from services.x import x_service
from services.reddit import reddit_service
from services.news import news_service
from services.telegram import telegram_service
from utils.helpers import sanitize_query

router = APIRouter(prefix="/api", tags=["Platform Search"])

@router.get("/youtube/search", response_model=ContentListResponse)
async def search_youtube(query: str = Query(default="cyber safety", min_length=1), limit: int = Query(default=10, ge=1, le=50)):
    clean_q = sanitize_query(query)
    items = await youtube_service.search_videos(query=clean_q, limit=limit)
    data_mode = items[0].data_mode if items else "DEMO DATA"
    return ContentListResponse(total=len(items), page=1, limit=limit, data_mode=data_mode, items=items)

@router.get("/instagram/status")
async def get_instagram_status():
    """Returns official Instagram Meta Graph API token validity and connection status."""
    return await instagram_service.get_instagram_status()

@router.get("/instagram/search", response_model=ContentListResponse)
async def search_instagram(query: Optional[str] = Query(default=""), limit: int = Query(default=10, ge=1, le=50)):
    clean_q = sanitize_query(query)
    items = await instagram_service.search_media(query=clean_q, limit=limit)
    data_mode = items[0].data_mode if items else "DEMO DATA"
    return ContentListResponse(total=len(items), page=1, limit=limit, data_mode=data_mode, items=items)

@router.get("/instagram/hashtag/{hashtag}", response_model=ContentListResponse)
async def get_instagram_hashtag(hashtag: str, limit: int = Query(default=15, ge=1, le=50)):
    """Fetches public media for a given hashtag via Meta Graph API."""
    items = await instagram_service.search_hashtag(hashtag=hashtag, limit=limit)
    data_mode = items[0].data_mode if items else "DEMO DATA"
    return ContentListResponse(total=len(items), page=1, limit=limit, data_mode=data_mode, items=items)

@router.get("/instagram/recent", response_model=ContentListResponse)
async def get_instagram_recent(limit: int = Query(default=15, ge=1, le=50)):
    """Fetches recent posts and reels from authorized Instagram account."""
    items = await instagram_service.get_recent_media(limit=limit)
    data_mode = items[0].data_mode if items else "DEMO DATA"
    return ContentListResponse(total=len(items), page=1, limit=limit, data_mode=data_mode, items=items)

@router.get("/instagram/insights")
async def get_instagram_insights(period: str = Query(default="day")):
    """Fetches account-level impressions, reach, and profile views."""
    return await instagram_service.get_account_insights(period=period)

@router.get("/instagram/trends")
async def get_instagram_trends(limit: int = Query(default=10, ge=1, le=50)):
    """Analyzes and aggregates hashtag trends based on collected Instagram data in SQLite."""
    trends = await instagram_service.get_hashtag_trends(limit=limit)
    return {"total": len(trends), "platform": "instagram", "trends": trends}

@router.get("/facebook/status")
async def get_facebook_status():
    """Returns official Facebook Meta Graph API token validity, user details, and accessible pages."""
    return await facebook_service.get_facebook_status()

@router.get("/facebook/pages")
async def get_facebook_pages():
    """Retrieves list of accessible Facebook Pages and Page IDs for authenticated user."""
    pages = await facebook_service.get_accessible_pages()
    return {"total": len(pages), "pages": pages}

@router.get("/facebook/feed", response_model=ContentListResponse)
async def get_facebook_feed(limit: int = Query(default=15, ge=1, le=50)):
    """Retrieves public feed posts from configured/accessible Facebook Page."""
    items = await facebook_service.get_page_feed(limit=limit)
    data_mode = items[0].data_mode if items else "DEMO DATA"
    return ContentListResponse(total=len(items), page=1, limit=limit, data_mode=data_mode, items=items)

@router.get("/facebook/search", response_model=ContentListResponse)
async def search_facebook(query: Optional[str] = Query(default=""), limit: int = Query(default=10, ge=1, le=50)):
    clean_q = sanitize_query(query)
    items = await facebook_service.search_posts(query=clean_q, limit=limit)
    data_mode = items[0].data_mode if items else "DEMO DATA"
    return ContentListResponse(total=len(items), page=1, limit=limit, data_mode=data_mode, items=items)

@router.get("/x/search", response_model=ContentListResponse)
async def search_x(query: str = Query(default="cyber India", min_length=1), limit: int = Query(default=10, ge=1, le=50)):
    clean_q = sanitize_query(query)
    items = await x_service.search_tweets(query=clean_q, limit=limit)
    data_mode = items[0].data_mode if items else "DEMO DATA"
    return ContentListResponse(total=len(items), page=1, limit=limit, data_mode=data_mode, items=items)

@router.get("/telegram/search", response_model=ContentListResponse)
async def search_telegram(query: Optional[str] = Query(default=""), limit: int = Query(default=10, ge=1, le=50)):
    clean_q = sanitize_query(query or "")
    items = await telegram_service.search_messages(query=clean_q, limit=limit)
    data_mode = items[0].data_mode if items else "DEMO DATA"
    return ContentListResponse(total=len(items), page=1, limit=limit, data_mode=data_mode, items=items)

@router.get("/telegram/status")
async def telegram_status():
    """Returns MTProto connection status and session authorization state."""
    return await telegram_service.get_auth_status()

@router.get("/reddit/search", response_model=ContentListResponse)
async def search_reddit(query: str = Query(default="cybersecurity", min_length=1), limit: int = Query(default=10, ge=1, le=50)):
    clean_q = sanitize_query(query)
    items = await reddit_service.search_submissions(query=clean_q, limit=limit)
    data_mode = items[0].data_mode if items else "DEMO DATA"
    return ContentListResponse(total=len(items), page=1, limit=limit, data_mode=data_mode, items=items)

@router.get("/news/search", response_model=ContentListResponse)
async def search_news(query: str = Query(default="technology", min_length=1), category: str = Query(default="technology"), limit: int = Query(default=10, ge=1, le=50)):
    clean_q = sanitize_query(query)
    items = await news_service.get_top_headlines(query=clean_q, category=category, limit=limit)
    data_mode = items[0].data_mode if items else "DEMO DATA"
    return ContentListResponse(total=len(items), page=1, limit=limit, data_mode=data_mode, items=items)
