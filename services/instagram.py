"""
Instagram Meta Graph API Connector.
Uses official Meta Graph API endpoints for Instagram Professional accounts:
- GET /{ig-user-id}/media (id, caption, media_type, media_url, permalink, timestamp, like_count, comments_count)
- GET /ig_hashtag_search
Normalizes into unified NormalizedContent model.
Safe labeled DEMO DATA fallback when INSTAGRAM_ACCESS_TOKEN is unconfigured.
"""
import logging
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx

from config.config import settings
from schemas.content import NormalizedContent
from database.db import upsert_content, log_api_fetch
from analytics.processor import analyze_sentiment, extract_hashtags

logger = logging.getLogger("dhristi.services.instagram")

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"

class InstagramService:
    def __init__(self):
        self._refresh_config()

    def _refresh_config(self):
        self.access_token = settings.INSTAGRAM_ACCESS_TOKEN
        self.account_id = settings.INSTAGRAM_ACCOUNT_ID or "1494611052689083"
        self.is_configured = settings.is_instagram_configured

    def _mask_key(self, text: Optional[str]) -> str:
        if not text:
            return ""
        if self.access_token and self.access_token in text:
            return text.replace(self.access_token, f"{self.access_token[:6]}...****")
        return text

    async def get_recent_media(self, limit: int = 15) -> List[NormalizedContent]:
        """Retrieves recent media published by connected Instagram account."""
        self._refresh_config()
        start_time = time.time()
        if not self.is_configured:
            logger.info("Instagram token unconfigured; returning labeled DEMO DATA.")
            return self._get_fallback_items(limit=limit)

        # Distinguish Instagram Basic Display API (IGAA...) from Meta Graph Business API
        if self.access_token.startswith("IG"):
            url = "https://graph.instagram.com/me/media"
            params = {
                "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
                "limit": min(limit, 50),
                "access_token": self.access_token
            }
            endpoint = "/me/media"
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.get(url, params=params)
                    duration_ms = int((time.time() - start_time) * 1000)

                    if res.status_code == 200:
                        data = res.json()
                        raw_items = data.get("data", [])
                        normalized_items = []
                        
                        if raw_items:
                            for raw in raw_items:
                                item = self._normalize_instagram_item(raw, data_mode="OFFICIAL API")
                                upsert_content(item.model_dump())
                                normalized_items.append(item)
                        else:
                            # Connected account is authenticated and verified (0 public media published yet)
                            item = NormalizedContent(
                                platform="instagram",
                                content_id=f"ig_{self.account_id}",
                                content_type="post",
                                title="Instagram Connected: @simplee.guyzz",
                                description="Official Meta Graph API connected for @simplee.guyzz. New reels and posts will sync automatically into Dhristi Intelligence.",
                                author="@simplee.guyzz",
                                author_id=self.account_id,
                                url="https://www.instagram.com/simplee.guyzz/",
                                thumbnail="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
                                published_at=datetime.utcnow().isoformat() + "Z",
                                views=1,
                                likes=0,
                                comments=0,
                                engagement=0,
                                location="India",
                                location_type="metadata",
                                category="Connected Account",
                                hashtags=["#Instagram", "#OfficialAPI", "#LiveConnection"],
                                sentiment="positive",
                                sentiment_score=1.0,
                                data_mode="OFFICIAL API",
                                raw_metadata={"username": "simplee.guyzz", "account_id": self.account_id, "status": "connected"}
                            )
                            upsert_content(item.model_dump())
                            normalized_items.append(item)

                        log_api_fetch("instagram", endpoint, 200, len(normalized_items), duration_ms)
                        return normalized_items
                    else:
                        err_msg = f"HTTP {res.status_code}: {self._mask_key(res.text)}"
                        logger.warning("Instagram Graph API error: %s", err_msg)
                        log_api_fetch("instagram", endpoint, res.status_code, 0, duration_ms, err_msg)
                        return self._get_fallback_items(limit=limit, notice=f"Official API status {res.status_code}")
            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                masked_e = self._mask_key(str(e))
                logger.error("Instagram request exception: %s", masked_e)
                log_api_fetch("instagram", endpoint, 500, 0, duration_ms, masked_e)
                return self._get_fallback_items(limit=limit, notice=str(e))
        else:
            # Meta Graph API Token (starts with EAAP... or EAA...)
            endpoint = "/me"
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    me_url = f"{GRAPH_API_BASE}/me"
                    res = await client.get(
                        me_url, 
                        params={
                            "fields": "id,name,accounts{id,name,instagram_business_account{id,username,name,profile_picture_url}}",
                            "access_token": self.access_token
                        }
                    )
                    duration_ms = int((time.time() - start_time) * 1000)

                    if res.status_code == 200:
                        user_data = res.json()
                        user_id = user_data.get("id", self.account_id)
                        user_name = user_data.get("name", "Meta User")

                        # Check if an Instagram Business Account is attached to any Facebook page
                        ig_account = None
                        for page in user_data.get("accounts", {}).get("data", []):
                            if page.get("instagram_business_account"):
                                ig_account = page["instagram_business_account"]
                                break

                        normalized_items = []
                        if ig_account and ig_account.get("id"):
                            ig_id = ig_account["id"]
                            ig_username = ig_account.get("username", "instagram_user")
                            media_res = await client.get(
                                f"{GRAPH_API_BASE}/{ig_id}/media",
                                params={
                                    "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
                                    "limit": min(limit, 50),
                                    "access_token": self.access_token
                                }
                            )
                            if media_res.status_code == 200:
                                raw_items = media_res.json().get("data", [])
                                for raw in raw_items:
                                    item = self._normalize_instagram_item(raw, data_mode="OFFICIAL API")
                                    upsert_content(item.model_dump())
                                    normalized_items.append(item)

                        if not normalized_items:
                            # Fetch App details for rich official metadata
                            app_name = "Dhristi"
                            try:
                                app_res = await client.get(
                                    f"{GRAPH_API_BASE}/app",
                                    params={"fields": "id,name", "access_token": self.access_token}
                                )
                                if app_res.status_code == 200:
                                    app_name = app_res.json().get("name", "Dhristi")
                            except Exception:
                                pass

                            # Official connected account status card
                            official_card = NormalizedContent(
                                platform="instagram",
                                content_id=f"ig_meta_{user_id}",
                                content_type="post",
                                title=f"Instagram Meta Graph API: {user_name} (App: {app_name})",
                                description=f"Official Meta Graph API authenticated for {user_name} (App: {app_name}). Live API token validated successfully. Connect an Instagram Professional/Creator account to your Facebook Page in Meta Business Suite to stream published posts.",
                                author=f"{user_name} ({app_name})",
                                author_id=user_id,
                                url="https://business.facebook.com/",
                                thumbnail="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
                                published_at=datetime.utcnow().isoformat() + "Z",
                                views=1,
                                likes=0,
                                comments=0,
                                engagement=0,
                                location="India",
                                location_type="metadata",
                                category="Connected Account",
                                hashtags=["#Instagram", "#MetaGraphAPI", "#OfficialAPI", "#Verified"],
                                sentiment="positive",
                                sentiment_score=1.0,
                                data_mode="OFFICIAL API",
                                raw_metadata={
                                    "user": user_name,
                                    "account_id": user_id,
                                    "app": app_name,
                                    "token_type": "Meta Graph API User Token",
                                    "status": "authenticated_active"
                                }
                            )
                            upsert_content(official_card.model_dump())
                            normalized_items.append(official_card)

                            # Supplement with fallback items so feeds and charts are populated
                            fallback_extras = self._get_fallback_items(limit=limit - 1)
                            normalized_items.extend(fallback_extras)

                        log_api_fetch("instagram", "/me", 200, len(normalized_items), duration_ms)
                        return normalized_items
                    else:
                        err_msg = f"HTTP {res.status_code}: {self._mask_key(res.text)}"
                        logger.warning("Meta Graph API error: %s", err_msg)
                        log_api_fetch("instagram", endpoint, res.status_code, 0, duration_ms, err_msg)
                        return self._get_fallback_items(limit=limit, notice=f"Official API status {res.status_code}")
            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                masked_e = self._mask_key(str(e))
                logger.error("Meta Graph API request exception: %s", masked_e)
                log_api_fetch("instagram", endpoint, 500, 0, duration_ms, masked_e)
                return self._get_fallback_items(limit=limit, notice=str(e))

    async def search_media(self, query: str = "", limit: int = 10) -> List[NormalizedContent]:
        """Instagram search: pulls recent media and filters by query/hashtag."""
        items = await self.get_recent_media(limit=limit * 2)
        if not query:
            return items[:limit]
        q_lower = query.lower()
        filtered = [
            it for it in items 
            if q_lower in (it.title or "").lower() or q_lower in (it.description or "").lower()
        ]
        return filtered[:limit] if filtered else items[:limit]

    def _normalize_instagram_item(self, raw: Dict[str, Any], data_mode: str = "OFFICIAL API") -> NormalizedContent:
        content_id = raw.get("id", "unknown")
        caption = raw.get("caption", "")
        # First sentence or 60 chars as title
        title = caption.split("\n")[0][:80] if caption else "Instagram Post"
        published_at = raw.get("timestamp", "")
        media_type = raw.get("media_type", "IMAGE").lower()
        thumbnail = raw.get("thumbnail_url") or raw.get("media_url")
        permalink = raw.get("permalink", f"https://www.instagram.com/p/{content_id}")

        likes = raw.get("like_count")
        comments = raw.get("comments_count")
        engagement = (likes or 0) + (comments or 0)

        sent_cat, sent_score = analyze_sentiment(caption)
        tags = [h["hashtag"] for h in extract_hashtags([caption], top_n=5)]

        return NormalizedContent(
            platform="instagram",
            content_id=content_id,
            content_type="reel" if media_type == "video" else "post",
            title=title,
            description=caption,
            author="Instagram Verified Authority",
            author_id=raw.get("owner", {}).get("id"),
            url=permalink,
            thumbnail=thumbnail,
            published_at=published_at,
            views=None,
            likes=likes,
            comments=comments,
            shares=None,
            engagement=engagement,
            location="National / Social",
            location_type="metadata",
            category="Public Awareness / Security",
            hashtags=tags,
            sentiment=sent_cat,
            sentiment_score=sent_score,
            data_mode=data_mode,
            raw_metadata={"media_type": media_type}
        )

    def _get_fallback_items(self, limit: int = 10, notice: Optional[str] = None) -> List[NormalizedContent]:
        fallback_data = [
            {
                "id": "ig_post_101",
                "caption": "⚠️ Beware of investment scams promising guaranteed 500% returns in 24 hours. Report fraudulent handles immediately to @cyberdost_i4c. #CyberDost #SafeDigitalIndia #ScamAlert",
                "author": "CyberDost Official",
                "likes": 48200,
                "comments": 1280,
                "media_type": "post",
                "location": "National Awareness"
            },
            {
                "id": "ig_post_102",
                "caption": "Digital arrest scams are rising across urban hubs. Law enforcement agencies NEVER make arrests via WhatsApp or Skype video calls. Spread the word! #DigitalSafety #CyberAware #1930Helpline",
                "author": "National Police Cyber Desk",
                "likes": 92300,
                "comments": 3410,
                "media_type": "reel",
                "location": "Maharashtra / Delhi / MP"
            },
            {
                "id": "ig_post_103",
                "caption": "New Aadhaar-linked verification rules for instant messaging group admins announced. Learn what this means for digital community managers. #DigitalIndia #GovernanceUpdate",
                "author": "MeitY Infographics",
                "likes": 31500,
                "comments": 890,
                "media_type": "post",
                "location": "National"
            }
        ]

        items = []
        for d in fallback_data[:limit]:
            likes = d["likes"]
            comments = d["comments"]
            eng = likes + comments
            sent_cat, sent_score = analyze_sentiment(d["caption"])
            tags = [h["hashtag"] for h in extract_hashtags([d["caption"]], top_n=5)]

            item = NormalizedContent(
                platform="instagram",
                content_id=d["id"],
                content_type=d["media_type"],
                title=d["caption"][:65] + "...",
                description=d["caption"],
                author=d["author"],
                author_id="ig_demo_auth",
                url=f"https://www.instagram.com/p/{d['id']}",
                thumbnail="https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80",
                published_at="2026-09-25T13:10:00Z",
                views=None,
                likes=likes,
                comments=comments,
                shares=None,
                engagement=eng,
                location=d["location"],
                location_type="metadata",
                category="Cyber Crime Prevention",
                hashtags=tags,
                sentiment=sent_cat,
                sentiment_score=sent_score,
                data_mode="DEMO DATA",
                raw_metadata={"fallback_reason": notice or "INSTAGRAM_ACCESS_TOKEN unconfigured in .env"}
            )
            upsert_content(item.model_dump())
            items.append(item)
        return items

instagram_service = InstagramService()
