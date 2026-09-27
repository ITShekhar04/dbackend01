"""
Analytics Overview Route.
GET /api/analytics
Provides cross-platform metrics, engagement velocity, and platform distributions.
"""
from fastapi import APIRouter
from datetime import datetime

from schemas.content import AnalyticsResponse
from database.db import get_content_records
from analytics.processor import compute_cross_platform_analytics

router = APIRouter(prefix="/api", tags=["Analytics"])

@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics():
    """
    Returns aggregated metrics across all stored and collected multi-platform content.
    """
    records = get_content_records(limit=100)
    computed = compute_cross_platform_analytics(records)

    has_official = any(r.get("data_mode") == "OFFICIAL API" for r in records)
    overall_mode = "OFFICIAL API" if has_official else "DEMO DATA"

    return AnalyticsResponse(
        total_content=computed["total_content"],
        total_engagement=computed["total_engagement"],
        total_views=computed["total_views"],
        platform_distribution=computed["platform_distribution"],
        sentiment_summary=computed["sentiment_summary"],
        top_hashtags=computed["top_hashtags"],
        top_topics=computed["top_topics"],
        data_mode=overall_mode,
        timestamp=datetime.utcnow().isoformat() + "Z"
    )
