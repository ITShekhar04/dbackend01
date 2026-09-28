"""
Facebook Meta Graph API Connector.
Uses official Meta Graph API endpoints for Facebook Pages and User Accounts:
- GET /me (id, name)
- GET /me/accounts (id, name, category, tasks, access_token, instagram_business_account)
- GET /{page-id}/feed (id, message, created_time, permalink_url, full_picture, shares)
Normalizes into unified NormalizedContent model with deduplication in SQLite.
Safe labeled DEMO DATA fallback when FACEBOOK_ACCESS_TOKEN is unconfigured or expired.
"""
import logging
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx

from config.config import settings
from schemas.content import NormalizedContent
from database.db import upsert_content, log_api_fetch, get_content_records
from analytics.processor import analyze_sentiment, extract_hashtags

logger = logging.getLogger("dhristi.services.facebook")

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"

class FacebookService:
    def __init__(self):
        self._refresh_config()

    def _refresh_config(self):
        self.access_token = settings.FACEBOOK_ACCESS_TOKEN
        self.page_id = settings.FACEBOOK_PAGE_ID or "1494611052689083"
        self.is_configured = settings.is_facebook_configured

    def _mask_key(self, text: Optional[str]) -> str:
        if not text:
            return ""
        if self.access_token and self.access_token in text:
            return text.replace(self.access_token, f"{self.access_token[:6]}...****")
        return text

    async def get_facebook_status(self) -> Dict[str, Any]:
        """
        Validates token health against official Meta Graph API.
        Returns live connectivity status, token expiry state, user identity, and accessible pages.
        """
        self._refresh_config()
        if not self.is_configured:
            return {
                "configured": False,
                "status": "unconfigured",
                "platform": "facebook",
                "api_type": "Facebook Graph API (Meta)",
                "api_version": "v19.0",
                "page_id": self.page_id,
                "message": "Facebook Access Token not configured. Please set FACEBOOK_ACCESS_TOKEN in backend/.env.",
                "data_mode": "DEMO DATA"
            }

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(
                    f"{GRAPH_API_BASE}/me",
                    params={
                        "fields": "id,name",
                        "access_token": self.access_token
                    }
                )
                duration_ms = int((time.time() - start_time) * 1000)

                if res.status_code == 200:
                    user_data = res.json()
                    user_id = user_data.get("id")
                    user_name = user_data.get("name")

                    # Retrieve accessible pages
                    pages_res = await client.get(
                        f"{GRAPH_API_BASE}/me/accounts",
                        params={
                            "fields": "id,name,category,tasks,access_token,instagram_business_account{id,username}",
                            "access_token": self.access_token
                        }
                    )
                    pages = []
                    if pages_res.status_code == 200:
                        pages = pages_res.json().get("data", [])

                    log_api_fetch("facebook", "/me", 200, len(pages) or 1, duration_ms)
                    return {
                        "configured": True,
                        "status": "connected",
                        "platform": "facebook",
                        "api_type": "Facebook Graph API (Meta)",
                        "api_version": "v19.0",
                        "user_id": user_id,
                        "user_name": user_name,
                        "accessible_pages": pages,
                        "page_count": len(pages),
                        "primary_page_id": pages[0]["id"] if pages else self.page_id,
                        "data_mode": "OFFICIAL API",
                        "message": f"Connected to Meta Graph API for user: {user_name} ({len(pages)} managed page(s) found)."
                    }
                else:
                    err_json = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                    err_msg = err_json.get("error", {}).get("message", res.text)
                    err_code = err_json.get("error", {}).get("code")
                    is_expired = err_code == 190 or "expired" in err_msg.lower()

                    log_api_fetch("facebook", "/me", res.status_code, 0, duration_ms, err_msg)
                    return {
                        "configured": False,
                        "status": "expired" if is_expired else "error",
                        "platform": "facebook",
                        "api_type": "Facebook Graph API (Meta)",
                        "api_version": "v19.0",
                        "http_status": res.status_code,
                        "error_code": err_code,
                        "message": f"Facebook token validation failed: {err_msg}",
                        "data_mode": "DEMO DATA"
                    }
        except Exception as e:
            masked_err = self._mask_key(str(e))
            return {
                "configured": False,
                "status": "error",
                "platform": "facebook",
                "message": f"Network exception reaching Meta API: {masked_err}",
                "data_mode": "DEMO DATA"
            }

    async def get_accessible_pages(self) -> List[Dict[str, Any]]:
        """Retrieves list of Facebook Pages managed by the authenticated user."""
        self._refresh_config()
        if not self.is_configured:
            return []

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(
                    f"{GRAPH_API_BASE}/me/accounts",
                    params={
                        "fields": "id,name,category,tasks,access_token,instagram_business_account{id,username}",
                        "access_token": self.access_token
                    }
                )
                if res.status_code == 200:
                    return res.json().get("data", [])
        except Exception as e:
            logger.warning("Failed to retrieve accessible Facebook pages: %s", self._mask_key(str(e)))
        return []

    async def get_page_feed(self, limit: int = 15) -> List[NormalizedContent]:
        """Retrieves public posts from configured Facebook Page/User via official Graph API."""
        self._refresh_config()
        start_time = time.time()
        if not self.is_configured:
            logger.info("Facebook token unconfigured; returning labeled DEMO DATA.")
            return self._get_fallback_items(limit=limit)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # 1. First get /me to verify identity
                me_res = await client.get(
                    f"{GRAPH_API_BASE}/me",
                    params={"fields": "id,name", "access_token": self.access_token}
                )
                if me_res.status_code != 200:
                    err_msg = f"HTTP {me_res.status_code}: {self._mask_key(me_res.text)}"
                    log_api_fetch("facebook", "/me", me_res.status_code, 0, int((time.time() - start_time) * 1000), err_msg)
                    return self._get_fallback_items(limit=limit, notice=err_msg)

                user_info = me_res.json()
                user_id = user_info.get("id", self.page_id)
                user_name = user_info.get("name", "Meta User")

                # 2. Check for managed pages
                pages_res = await client.get(
                    f"{GRAPH_API_BASE}/me/accounts",
                    params={"fields": "id,name,access_token", "access_token": self.access_token}
                )
                pages = pages_res.json().get("data", []) if pages_res.status_code == 200 else []

                normalized_items = []

                # If pages exist, query page feed
                if pages:
                    target_page = pages[0]
                    page_token = target_page.get("access_token", self.access_token)
                    target_id = target_page["id"]

                    feed_res = await client.get(
                        f"{GRAPH_API_BASE}/{target_id}/feed",
                        params={
                            "fields": "id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true),comments.summary(true)",
                            "limit": min(limit, 50),
                            "access_token": page_token
                        }
                    )
                    if feed_res.status_code == 200:
                        raw_items = feed_res.json().get("data", [])
                        for raw in raw_items:
                            item = self._normalize_facebook_item(raw, data_mode="OFFICIAL API")
                            upsert_content(item.model_dump())
                            normalized_items.append(item)

                if not normalized_items:
                    # Official authenticated status card
                    official_card = NormalizedContent(
                        platform="facebook",
                        content_id=f"fb_user_{user_id}",
                        content_type="post",
                        title=f"Facebook Official API: {user_name}",
                        description=f"Official Meta Graph API authenticated for {user_name} (ID: {user_id}). Token validated successfully. Publish posts on a Facebook Page managed by this account to stream live public posts into Dhristi Intelligence.",
                        author=user_name,
                        author_id=user_id,
                        url=f"https://www.facebook.com/{user_id}",
                        thumbnail="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
                        published_at=datetime.utcnow().isoformat() + "Z",
                        views=1,
                        likes=0,
                        comments=0,
                        shares=0,
                        engagement=0,
                        location="India",
                        location_type="metadata",
                        category="Connected Account",
                        hashtags=["#Facebook", "#OfficialAPI", "#LiveConnection", "#Verified"],
                        sentiment="positive",
                        sentiment_score=1.0,
                        data_mode="OFFICIAL API",
                        raw_metadata={
                            "user_name": user_name,
                            "user_id": user_id,
                            "pages_count": len(pages),
                            "status": "authenticated_active"
                        }
                    )
                    upsert_content(official_card.model_dump())
                    normalized_items.append(official_card)

                    # Supplement with fallback items so feeds and charts are populated
                    fallback_extras = self._get_fallback_items(limit=limit - 1)
                    normalized_items.extend(fallback_extras)

                duration_ms = int((time.time() - start_time) * 1000)
                log_api_fetch("facebook", "/feed", 200, len(normalized_items), duration_ms)
                return normalized_items

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            masked_e = self._mask_key(str(e))
            logger.error("Facebook request exception: %s", masked_e)
            log_api_fetch("facebook", "/feed", 500, 0, duration_ms, masked_e)
            return self._get_fallback_items(limit=limit, notice=str(e))

    async def search_posts(self, query: str = "", limit: int = 10) -> List[NormalizedContent]:
        """Search page feed items matching query."""
        items = await self.get_page_feed(limit=limit * 2)
        if not query:
            return items[:limit]
        q_lower = query.lower()
        filtered = [
            it for it in items 
            if q_lower in (it.title or "").lower() or q_lower in (it.description or "").lower()
        ]
        if filtered:
            return filtered[:limit]

        # Check local DB for cached matches
        db_items = get_content_records(platform="facebook", query=query, limit=limit)
        if db_items:
            return [self._db_row_to_normalized(r) for r in db_items]

        return items[:limit]

    def _normalize_facebook_item(self, raw: Dict[str, Any], data_mode: str = "OFFICIAL API") -> NormalizedContent:
        content_id = raw.get("id", "unknown")
        message = raw.get("message", "")
        title = message.split("\n")[0][:80] if message else "Facebook Community Post"
        published_at = raw.get("created_time", "")
        thumbnail = raw.get("full_picture")
        permalink = raw.get("permalink_url", f"https://www.facebook.com/{content_id}")

        reactions = raw.get("reactions", {}).get("summary", {}).get("total_count", 0)
        comments = raw.get("comments", {}).get("summary", {}).get("total_count", 0)
        shares = raw.get("shares", {}).get("count") if isinstance(raw.get("shares"), dict) else None
        engagement = reactions + comments + (shares or 0)

        sent_cat, sent_score = analyze_sentiment(message)
        tags = [h["hashtag"] for h in extract_hashtags([message], top_n=5)]

        return NormalizedContent(
            platform="facebook",
            content_id=content_id,
            content_type="post",
            title=title,
            description=message,
            author="Public Safety Information Page",
            author_id=raw.get("from", {}).get("id") or self.page_id,
            url=permalink,
            thumbnail=thumbnail,
            published_at=published_at,
            views=None,
            likes=reactions,
            comments=comments,
            shares=shares,
            engagement=engagement,
            location="National / State",
            location_type="metadata",
            category="Citizen Welfare & Advisory",
            hashtags=tags,
            sentiment=sent_cat,
            sentiment_score=sent_score,
            data_mode=data_mode,
            raw_metadata={"raw_reactions": reactions}
        )

    def _db_row_to_normalized(self, row: Dict[str, Any]) -> NormalizedContent:
        return NormalizedContent(
            platform="facebook",
            content_id=row.get("content_id", ""),
            content_type=row.get("content_type", "post"),
            title=row.get("title", ""),
            description=row.get("description", ""),
            author=row.get("author_name", "Facebook Authority"),
            author_id=row.get("author_id"),
            url=row.get("url", ""),
            thumbnail=row.get("thumbnail"),
            published_at=row.get("published_at", ""),
            views=row.get("views"),
            likes=row.get("likes"),
            comments=row.get("comments"),
            shares=row.get("shares"),
            engagement=row.get("engagement", 0),
            location=row.get("location", "India"),
            location_type=row.get("location_type", "metadata"),
            category=row.get("category", "General"),
            hashtags=[],
            sentiment=row.get("sentiment", "neutral"),
            sentiment_score=row.get("sentiment_score", 0.0),
            data_mode=row.get("data_mode", "DEMO DATA")
        )

    def _get_fallback_items(self, limit: int = 10, notice: Optional[str] = None) -> List[NormalizedContent]:
        fallback_data = [
            {
                "id": "fb_post_201",
                "message": "National Critical Information Infrastructure Protection Centre (NCIIPC) has released updated cybersecurity guidelines for power grids and transportation systems. Read full directive at nciipc.gov.in. #CriticalInfra #CyberDefense #NationalSecurity",
                "author": "NCIIPC Strategic Desk",
                "likes": 14200,
                "comments": 410,
                "shares": 1950,
                "location": "New Delhi / Multi-State"
            },
            {
                "id": "fb_post_202",
                "message": "Important Public Notice: Beware of fraudulent SMS claiming electricity connections will be disconnected tonight due to unpaid bills. Never download APK files or call phone numbers mentioned in such texts. #CyberAware #ElectricityBillScam",
                "author": "State DISCOM Security Wing",
                "likes": 28900,
                "comments": 1140,
                "shares": 6700,
                "location": "Madhya Pradesh / Uttar Pradesh"
            }
        ]

        items = []
        for d in fallback_data[:limit]:
            likes = d["likes"]
            comments = d["comments"]
            shares = d["shares"]
            eng = likes + comments + shares
            sent_cat, sent_score = analyze_sentiment(d["message"])
            tags = [h["hashtag"] for h in extract_hashtags([d["message"]], top_n=5)]

            item = NormalizedContent(
                platform="facebook",
                content_id=d["id"],
                content_type="post",
                title=d["message"][:70] + "...",
                description=d["message"],
                author=d["author"],
                author_id="fb_demo_page",
                url=f"https://www.facebook.com/{d['id']}",
                thumbnail="https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80",
                published_at="2026-09-25T11:45:00Z",
                views=None,
                likes=likes,
                comments=comments,
                shares=shares,
                engagement=eng,
                location=d["location"],
                location_type="metadata",
                category="Critical Infrastructure Protection",
                hashtags=tags,
                sentiment=sent_cat,
                sentiment_score=sent_score,
                data_mode="DEMO DATA",
                raw_metadata={"fallback_reason": notice or "FACEBOOK_ACCESS_TOKEN unconfigured in .env"}
            )
            upsert_content(item.model_dump())
            items.append(item)
        return items

facebook_service = FacebookService()
