"""
X (Twitter) API v2 Connector.
Uses official Twitter/X API v2 endpoints:
- GET /2/tweets/search/recent (created_at, public_metrics, author_id, entities)
- User expansions for authentic display names and verification status
Normalizes into unified NormalizedContent model.
Safe labeled DEMO DATA fallback when X_BEARER_TOKEN is unconfigured.
"""
import base64
import logging
import time
from typing import List, Dict, Any, Optional
import httpx

from config.config import settings
from schemas.content import NormalizedContent
from database.db import upsert_content, log_api_fetch
from analytics.processor import analyze_sentiment, extract_hashtags

logger = logging.getLogger("dhristi.services.x")

X_API_BASE = "https://api.x.com/2"

class XService:
    def __init__(self):
        self.bearer_token = settings.X_BEARER_TOKEN
        self.api_key = settings.X_API_KEY
        self.api_secret = settings.X_API_SECRET
        self.is_configured = settings.is_x_configured

    def _mask_key(self, text: Optional[str]) -> str:
        if not text:
            return ""
        for secret in [self.bearer_token, self.api_key, self.api_secret]:
            if secret and secret in text:
                text = text.replace(secret, f"{secret[:6]}...****")
        return text

    async def _ensure_bearer_token(self) -> Optional[str]:
        """Dynamically generates Bearer Token via OAuth2 if only Consumer Key & Secret are provided."""
        if self.bearer_token:
            return self.bearer_token
        if self.api_key and self.api_secret:
            try:
                creds = base64.b64encode(f"{self.api_key}:{self.api_secret}".encode()).decode()
                headers = {
                    "Authorization": f"Basic {creds}",
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(
                        "https://api.twitter.com/oauth2/token",
                        data={"grant_type": "client_credentials"},
                        headers=headers
                    )
                    if res.status_code == 200:
                        self.bearer_token = res.json().get("access_token")
                        logger.info("Successfully minted X App-Only Bearer Token via OAuth2.")
                        return self.bearer_token
            except Exception as e:
                logger.error("Failed to generate X Bearer Token: %s", self._mask_key(str(e)))
        return None

    async def search_tweets(self, query: str = "India cyber OR tech", limit: int = 15) -> List[NormalizedContent]:
        """Searches recent public tweets (last 7 days) via official X API v2."""
        start_time = time.time()
        if not self.is_configured:
            logger.info("X credentials unconfigured; returning labeled DEMO DATA.")
            return self._get_fallback_items(query=query, limit=limit)

        token = await self._ensure_bearer_token()
        if not token:
            logger.warning("Could not obtain valid X Bearer token; returning labeled DEMO DATA.")
            return self._get_fallback_items(query=query, limit=limit, notice="X Bearer token generation failed")

        url = f"{X_API_BASE}/tweets/search/recent"
        headers = {"Authorization": f"Bearer {token}"}
        params = {
            "query": f"{query} -is:retweet lang:en",
            "max_results": max(10, min(limit, 100)),
            "tweet.fields": "created_at,public_metrics,entities,author_id,lang",
            "expansions": "author_id",
            "user.fields": "name,username,verified"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=headers, params=params)
                duration_ms = int((time.time() - start_time) * 1000)

                if res.status_code == 200:
                    data = res.json()
                    tweets = data.get("data", [])
                    includes = data.get("includes", {})
                    users = {u["id"]: u for u in includes.get("users", [])}

                    normalized_items = []
                    for tw in tweets:
                        author_info = users.get(tw.get("author_id"), {})
                        item = self._normalize_x_item(tw, author_info, data_mode="OFFICIAL API")
                        upsert_content(item.model_dump())
                        normalized_items.append(item)

                    log_api_fetch("x", "/2/tweets/search/recent", 200, len(normalized_items), duration_ms)
                    return normalized_items
                else:
                    raw_err = res.text
                    err_msg = f"HTTP {res.status_code}: {self._mask_key(raw_err)}"
                    logger.warning("X API v2 error: %s", err_msg)
                    log_api_fetch("x", "/2/tweets/search/recent", res.status_code, 0, duration_ms, err_msg)
                    reason = f"Official API status {res.status_code}"
                    if "credits depleted" in raw_err or res.status_code == 402:
                        reason = "X API credits depleted (Free tier active)"
                    elif res.status_code == 429:
                        reason = "X API rate limit reached"
                    return self._get_fallback_items(query=query, limit=limit, notice=reason)
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            masked_e = self._mask_key(str(e))
            logger.error("X API v2 request exception: %s", masked_e)
            log_api_fetch("x", "/2/tweets/search/recent", 500, 0, duration_ms, masked_e)
            return self._get_fallback_items(query=query, limit=limit, notice=str(e))

    def _normalize_x_item(self, tw: Dict[str, Any], author: Dict[str, Any], data_mode: str = "OFFICIAL API") -> NormalizedContent:
        content_id = tw.get("id", "unknown")
        text = tw.get("text", "")
        title = text.split("\n")[0][:80]
        published_at = tw.get("created_at", "")

        metrics = tw.get("public_metrics", {})
        likes = metrics.get("like_count", 0)
        retweets = metrics.get("retweet_count", 0)
        replies = metrics.get("reply_count", 0)
        quotes = metrics.get("quote_count", 0)
        views = metrics.get("impression_count")

        shares = retweets + quotes
        engagement = likes + replies + shares
        engagement_rate = round((engagement / views) * 100, 2) if views and views > 0 else None

        author_name = author.get("name") or "X Verified Authority"
        username = author.get("username", "user")

        entities = tw.get("entities", {})
        tags = [f"#{h.get('tag')}" for h in entities.get("hashtags", [])]
        if not tags:
            tags = [h["hashtag"] for h in extract_hashtags([text], top_n=5)]

        sent_cat, sent_score = analyze_sentiment(text)

        return NormalizedContent(
            platform="x",
            content_id=content_id,
            content_type="tweet",
            title=title,
            description=text,
            author=f"{author_name} (@{username})",
            author_id=tw.get("author_id"),
            url=f"https://x.com/{username}/status/{content_id}",
            thumbnail=None,
            published_at=published_at,
            views=views,
            likes=likes,
            comments=replies,
            shares=shares,
            engagement=engagement,
            engagement_rate=engagement_rate,
            location="National / Real-Time",
            location_type="metadata",
            category="Cyber Trends & Rapid Intelligence",
            hashtags=tags,
            sentiment=sent_cat,
            sentiment_score=sent_score,
            data_mode=data_mode,
            raw_metadata={"metrics": metrics, "verified": author.get("verified", False)}
        )

    def _get_fallback_items(self, query: str = "tech", limit: int = 10, notice: Optional[str] = None) -> List[NormalizedContent]:
        fallback_data = [
            {
                "id": "18392019481920182",
                "text": "🚨 Urgent Advisory: Multiple spoofed banking apps detected on third-party stores mimicking State Bank netbanking. CERT-In vulnerability bulletin CI-2026-0814 issued. Check checksums before installing. #CyberSecurity #DigitalSafety #CERTIn",
                "author": "CERT-In Official (@IndianCERT)",
                "author_id": "99281726",
                "likes": 12800,
                "retweets": 4120,
                "replies": 390,
                "impressions": 284000,
                "location": "National Feed"
            },
            {
                "id": "18392019481920183",
                "text": "Cyber Coordination Centre (I4C) successfully froze ₹14.8 Crores in fraudulent transactions across 6 states in the last 48 hours following citizen reporting on 1930. Swift reporting saves life savings. #1930CyberHelpline #I4CIndia",
                "author": "CyberDost (@CyberDost)",
                "author_id": "88172635",
                "likes": 24500,
                "retweets": 8900,
                "replies": 810,
                "impressions": 590000,
                "location": "Multi-State (MP, UP, MH, KA)"
            },
            {
                "id": "18392019481920184",
                "text": "India AI Governance Framework 2026 enters final stakeholder review. Directives mandate synthetic media disclosures and provenance watermark embedding for generative platforms. #AIGovernance #DigitalIndia",
                "author": "Ministry of Electronics & IT (@GoI_MeitY)",
                "author_id": "77182934",
                "likes": 19400,
                "retweets": 5200,
                "replies": 430,
                "impressions": 410000,
                "location": "New Delhi / National"
            }
        ]

        items = []
        for d in fallback_data[:limit]:
            likes = d["likes"]
            retweets = d["retweets"]
            replies = d["replies"]
            views = d["impressions"]
            shares = retweets
            eng = likes + replies + shares
            sent_cat, sent_score = analyze_sentiment(d["text"])
            tags = [h["hashtag"] for h in extract_hashtags([d["text"]], top_n=5)]

            item = NormalizedContent(
                platform="x",
                content_id=d["id"],
                content_type="tweet",
                title=d["text"][:75] + "...",
                description=d["text"],
                author=d["author"],
                author_id=d["author_id"],
                url=f"https://x.com/status/{d['id']}",
                thumbnail=None,
                published_at="2026-09-25T15:20:00Z",
                views=views,
                likes=likes,
                comments=replies,
                shares=shares,
                engagement=eng,
                engagement_rate=round((eng / views) * 100, 2) if views else None,
                location=d["location"],
                location_type="metadata",
                category="Real-Time Threat Feed",
                hashtags=tags,
                sentiment=sent_cat,
                sentiment_score=sent_score,
                data_mode="DEMO DATA",
                raw_metadata={"fallback_reason": notice or "X_BEARER_TOKEN unconfigured in .env"}
            )
            upsert_content(item.model_dump())
            items.append(item)
        return items

x_service = XService()
