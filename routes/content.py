"""
Unified Content Query and Pagination Route.
GET /api/content
Supports multi-platform filtering, date, category, location, and pagination.
"""
from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime

from schemas.content import ContentListResponse, NormalizedContent
from database.db import get_content_records, get_content_count
from services.youtube import youtube_service

router = APIRouter(prefix="/api", tags=["Content Storage"])

@router.get("/content", response_model=ContentListResponse)
async def list_content(
    platform: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    location: Optional[str] = Query(default=None),
    query: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100)
):
    offset = (page - 1) * limit
    db_items = get_content_records(platform=platform, category=category, location=location, query=query, limit=limit, offset=offset)

    if not db_items:
        # If DB is empty, pull initial items
        fresh = await youtube_service.get_trending(limit=10)
        return ContentListResponse(
            total=len(fresh),
            page=1,
            limit=limit,
            data_mode=fresh[0].data_mode if fresh else "DEMO DATA",
            items=fresh
        )

    # Convert DB rows to NormalizedContent
    normalized_list = []
    for r in db_items:
        item = NormalizedContent(
            platform=r["platform"],
            content_id=r["content_id"],
            content_type=r["content_type"],
            title=r["title"] or "",
            description=r["description"],
            author=r["author_name"] or "Unknown",
            author_id=r["author_id"],
            url=r["url"] or "",
            thumbnail=r["thumbnail"],
            published_at=r["published_at"],
            views=r["views"],
            likes=r["likes"],
            comments=r["comments"],
            shares=r["shares"],
            engagement=r["engagement"] or 0,
            engagement_rate=r["engagement_rate"],
            location=r["location"],
            location_type=r["location_type"],
            category=r["category"],
            sentiment=r["sentiment"],
            sentiment_score=r["sentiment_score"],
            data_mode=r["data_mode"] or "DEMO DATA"
        )
        normalized_list.append(item)

    total_count = get_content_count()
    overall_mode = "OFFICIAL API" if any(it.data_mode == "OFFICIAL API" for it in normalized_list) else "DEMO DATA"

    return ContentListResponse(
        total=total_count,
        page=page,
        limit=limit,
        data_mode=overall_mode,
        timestamp=datetime.utcnow().isoformat() + "Z",
        items=normalized_list
    )
