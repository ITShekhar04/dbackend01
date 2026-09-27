"""
YouTube Data API v3 Connector.
Uses official Google API endpoints for video search and trending feeds.
Transforms raw YouTube API responses into the unified NormalizedContent schema.
Provides cleanly labeled DEMO DATA fallback if API key is unconfigured or rate limited.
"""
import logging
import time
from typing import List, Dict, Any, Optional
import httpx

from config.config import settings
from schemas.content import NormalizedContent
from database.db import upsert_content, log_api_fetch
from analytics.processor import analyze_sentiment, extract_hashtags

logger = logging.getLogger("dhristi.services.youtube")

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

class YouTubeService:
    def __init__(self):
        self.api_key = settings.YOUTUBE_API_KEY
        self.is_configured = settings.is_youtube_configured
        self.headers = {
            "X-Goog-Api-Key": self.api_key
        } if self.api_key else {}
        if getattr(settings, "YOUTUBE_REFERER", None):
            self.headers["Referer"] = settings.YOUTUBE_REFERER

    def _mask_key(self, text: Optional[str]) -> str:
        """Sanitizes text strings so API keys are never exposed in logs or databases."""
        if not text:
            return ""
        if self.api_key and self.api_key in text:
            masked = f"{self.api_key[:6]}...****"
            return text.replace(self.api_key, masked)
        return text

    async def search_videos(self, query: str = "technology", limit: int = 10) -> List[NormalizedContent]:
        """
        Searches YouTube for videos matching query using official YouTube Data API v3.
        """
        start_time = time.time()
        if not self.is_configured:
            logger.info("YouTube API key not configured; returning labeled DEMO DATA.")
            return self._get_fallback_items(query=query, limit=limit)

        url = f"{YOUTUBE_API_BASE}/search"
        params = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": min(limit, 50),
            "regionCode": "IN",
            "key": self.api_key
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params, headers=self.headers)
                duration_ms = int((time.time() - start_time) * 1000)

                if res.status_code == 200:
                    data = res.json()
                    raw_items = data.get("items", [])
                    video_ids = [
                        item["id"]["videoId"]
                        for item in raw_items
                        if isinstance(item.get("id"), dict) and "videoId" in item["id"]
                    ]

                    # Hydrate with statistics (views, likes, comments)
                    stats_map = await self._fetch_video_statistics(video_ids, client) if video_ids else {}
                    normalized_items = []

                    for raw in raw_items:
                        vid = raw["id"].get("videoId") if isinstance(raw.get("id"), dict) else raw.get("id")
                        stats = stats_map.get(vid, {})
                        normalized = self._normalize_youtube_item(raw, stats, data_mode="OFFICIAL API")
                        upsert_content(normalized.model_dump())
                        normalized_items.append(normalized)

                    log_api_fetch("youtube", "/search", 200, len(normalized_items), duration_ms)
                    return normalized_items
                else:
                    raw_err = res.text
                    error_msg = f"HTTP {res.status_code}: {self._mask_key(raw_err)}"
                    logger.warning("YouTube API error: %s", error_msg)
                    log_api_fetch("youtube", "/search", res.status_code, 0, duration_ms, error_msg)
                    reason = f"Official API returned {res.status_code}"
                    if "quotaExceeded" in raw_err:
                        reason = "YouTube API daily quota exceeded"
                    elif "API_KEY_HTTP_REFERRER_BLOCKED" in raw_err:
                        reason = "YouTube API HTTP referrer restriction active"
                    return self._get_fallback_items(query=query, limit=limit, notice=reason)

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            masked_e = self._mask_key(str(e))
            logger.error("YouTube search request exception: %s", masked_e)
            log_api_fetch("youtube", "/search", 500, 0, duration_ms, masked_e)
            return self._get_fallback_items(query=query, limit=limit, notice="YouTube API connection error")

    async def get_trending(self, limit: int = 15, category_id: Optional[str] = None) -> List[NormalizedContent]:
        """
        Retrieves most popular / trending videos in India from YouTube Data API v3.
        """
        start_time = time.time()
        if not self.is_configured:
            logger.info("YouTube API key not configured; returning labeled DEMO DATA.")
            return self._get_fallback_items(query="trending", limit=limit)

        url = f"{YOUTUBE_API_BASE}/videos"
        params = {
            "part": "snippet,contentDetails,statistics",
            "chart": "mostPopular",
            "regionCode": "IN",
            "maxResults": min(limit, 50),
            "key": self.api_key
        }
        if category_id:
            params["videoCategoryId"] = category_id

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params, headers=self.headers)
                duration_ms = int((time.time() - start_time) * 1000)

                if res.status_code == 200:
                    data = res.json()
                    raw_items = data.get("items", [])
                    normalized_items = []

                    for raw in raw_items:
                        stats = raw.get("statistics", {})
                        normalized = self._normalize_youtube_item(raw, stats, data_mode="OFFICIAL API")
                        upsert_content(normalized.model_dump())
                        normalized_items.append(normalized)

                    log_api_fetch("youtube", "/videos/mostPopular", 200, len(normalized_items), duration_ms)
                    return normalized_items
                else:
                    raw_err = res.text
                    error_msg = f"HTTP {res.status_code}: {self._mask_key(raw_err)}"
                    logger.warning("YouTube API trending error: %s", error_msg)
                    log_api_fetch("youtube", "/videos/mostPopular", res.status_code, 0, duration_ms, error_msg)
                    reason = f"Official API error {res.status_code}"
                    if "quotaExceeded" in raw_err:
                        reason = "YouTube API daily quota exceeded"
                    elif "API_KEY_HTTP_REFERRER_BLOCKED" in raw_err:
                        reason = "YouTube API HTTP referrer restriction active"
                    return self._get_fallback_items(query="trending", limit=limit, notice=reason)

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            masked_e = self._mask_key(str(e))
            logger.error("YouTube trending exception: %s", masked_e)
            log_api_fetch("youtube", "/videos/mostPopular", 500, 0, duration_ms, masked_e)
            return self._get_fallback_items(query="trending", limit=limit, notice="YouTube API connection error")

    async def _fetch_video_statistics(self, video_ids: List[str], client: httpx.AsyncClient) -> Dict[str, Dict[str, Any]]:
        """Batches statistics retrieval for a list of video IDs."""
        if not video_ids:
            return {}
        try:
            url = f"{YOUTUBE_API_BASE}/videos"
            params = {
                "part": "statistics",
                "id": ",".join(video_ids[:50]),
                "key": self.api_key
            }
            res = await client.get(url, params=params, headers=self.headers)
            if res.status_code == 200:
                items = res.json().get("items", [])
                return {item["id"]: item.get("statistics", {}) for item in items}
        except Exception as e:
            logger.error("Error fetching video statistics: %s", e)
        return {}

    def _normalize_youtube_item(self, raw: Dict[str, Any], stats: Dict[str, Any], data_mode: str = "OFFICIAL API") -> NormalizedContent:
        """Adapts raw YouTube Data v3 item into NormalizedContent."""
        vid = raw.get("id")
        if isinstance(vid, dict):
            content_id = vid.get("videoId", "unknown")
        else:
            content_id = str(vid or "unknown")

        snippet = raw.get("snippet", {})
        title = snippet.get("title", "Untitled YouTube Video")
        description = snippet.get("description", "")
        author = snippet.get("channelTitle", "Unknown Channel")
        author_id = snippet.get("channelId")
        published_at = snippet.get("publishedAt", "")
        thumbnails = snippet.get("thumbnails", {})
        thumbnail_url = thumbnails.get("high", {}).get("url") or thumbnails.get("medium", {}).get("url")

        views = int(stats.get("viewCount", 0)) if "viewCount" in stats else None
        likes = int(stats.get("likeCount", 0)) if "likeCount" in stats else None
        comments = int(stats.get("commentCount", 0)) if "commentCount" in stats else None
        engagement = (likes or 0) + (comments or 0)
        engagement_rate = round((engagement / views) * 100, 2) if views and views > 0 else None

        sent_cat, sent_score = analyze_sentiment(f"{title} {description}")

        # Extract hashtags from snippet tags or description
        tags = snippet.get("tags", [])
        extracted_tags = [f"#{t.replace(' ', '')}" for t in tags[:5]]
        if not extracted_tags and description:
            found_hashtags = extract_hashtags([description], top_n=5)
            extracted_tags = [h["hashtag"] for h in found_hashtags]

        return NormalizedContent(
            platform="youtube",
            content_id=content_id,
            content_type="video",
            title=title,
            description=description,
            author=author,
            author_id=author_id,
            url=f"https://www.youtube.com/watch?v={content_id}",
            thumbnail=thumbnail_url,
            published_at=published_at,
            views=views,
            likes=likes,
            comments=comments,
            shares=None, # YouTube API v3 does not expose shares
            engagement=engagement,
            engagement_rate=engagement_rate,
            location="India (IN)",
            location_type="metadata",
            category="Technology / Public Safety",
            hashtags=extracted_tags,
            sentiment=sent_cat,
            sentiment_score=sent_score,
            data_mode=data_mode,
            raw_metadata={"channelId": author_id, "liveBroadcastContent": snippet.get("liveBroadcastContent")}
        )

    def _get_fallback_items(self, query: str = "general", limit: int = 10, notice: Optional[str] = None) -> List[NormalizedContent]:
        """Clearly labeled DEMO DATA fallback when official credentials are not yet configured."""
        fallback_data = [
            {
                "id": "yt_in_01",
                "title": "CERT-In Issues High Severity Advisory on Critical Operating System Vulnerabilities",
                "desc": "Official technical advisory and patch deployment guidance from India Computer Emergency Response Team.",
                "author": "CERT-In Cyber Broadcast",
                "views": 420500,
                "likes": 28900,
                "comments": 1420,
                "tags": ["#CERTIn", "#CyberSecurity", "#NationalSecurity"],
                "location": "New Delhi / National"
            },
            {
                "id": "yt_in_02",
                "title": "UPI Fraud Awareness: How to Protect Against 1930 Financial Phishing Schemes",
                "desc": "Ministry of Home Affairs I4C national awareness campaign on instantaneous cyber financial fraud freeze protocol.",
                "author": "CyberDost I4C",
                "views": 890400,
                "likes": 64300,
                "comments": 3100,
                "tags": ["#CyberDost", "#UPIProtection", "#1930Helpline"],
                "location": "Madhya Pradesh & Multi-State"
            },
            {
                "id": "yt_in_03",
                "title": "Semiconductor Manufacturing Hub in Gujarat & MP: Progress Update 2026",
                "desc": "Comprehensive review of fabrication plants, clean energy infrastructure, and high-tech manufacturing corridors.",
                "author": "Digital India Strategic Infra",
                "views": 612000,
                "likes": 47200,
                "comments": 1950,
                "tags": ["#Semiconductor", "#MakeInIndia", "#HighTech"],
                "location": "Gujarat / Madhya Pradesh"
            },
            {
                "id": "yt_in_04",
                "title": "AI Deepfake Detection in 2026: Watermarking and Synthetic Media Verification",
                "desc": "National forensic lab demonstrates cryptographic verification and provenance validation across video streams.",
                "author": "National Forensic Cyber Lab",
                "views": 340000,
                "likes": 21800,
                "comments": 980,
                "tags": ["#DeepfakeRadar", "#Provenance", "#DigitalSafety"],
                "location": "National"
            }
        ]

        items = []
        for d in fallback_data[:limit]:
            views = d["views"]
            likes = d["likes"]
            comments = d["comments"]
            eng = likes + comments
            sent_cat, sent_score = analyze_sentiment(f"{d['title']} {d['desc']}")

            item = NormalizedContent(
                platform="youtube",
                content_id=d["id"],
                content_type="video",
                title=d["title"],
                description=d["desc"],
                author=d["author"],
                author_id="UC_dhristi_demo_channel",
                url=f"https://www.youtube.com/watch?v={d['id']}",
                thumbnail="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
                published_at="2026-09-25T14:30:00Z",
                views=views,
                likes=likes,
                comments=comments,
                shares=None,
                engagement=eng,
                engagement_rate=round((eng / views) * 100, 2),
                location=d["location"],
                location_type="metadata",
                category="Cyber / Governance",
                hashtags=d["tags"],
                sentiment=sent_cat,
                sentiment_score=sent_score,
                data_mode="DEMO DATA",
                raw_metadata={"fallback_reason": notice or "YOUTUBE_API_KEY unconfigured in .env"}
            )
            upsert_content(item.model_dump())
            items.append(item)

        return items

youtube_service = YouTubeService()
