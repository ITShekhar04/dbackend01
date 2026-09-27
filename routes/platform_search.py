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

@router.get("/instagram/search", response_model=ContentListResponse)
async def search_instagram(query: Optional[str] = Query(default=""), limit: int = Query(default=10, ge=1, le=50)):
    clean_q = sanitize_query(query)
    items = await instagram_service.search_media(query=clean_q, limit=limit)
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
