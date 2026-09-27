"""
Reddit Data API Connector.
Uses official Reddit OAuth2 / Public endpoints:
- GET /r/{subreddit}/hot.json (id, title, selftext, author, score, num_comments, permalink, created_utc)
Normalizes into unified NormalizedContent model.
Supports authenticated OAuth2 client credentials flow or safe DEMO DATA fallback.
"""
import logging
import time
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import httpx

from config.config import settings
from schemas.content import NormalizedContent
from database.db import upsert_content, log_api_fetch
from analytics.processor import analyze_sentiment, extract_hashtags

logger = logging.getLogger("dhristi.services.reddit")

REDDIT_BASE = "https://www.reddit.com"
REDDIT_OAUTH_BASE = "https://oauth.reddit.com"

class RedditService:
    def __init__(self):
        self.client_id = settings.REDDIT_CLIENT_ID
        self.client_secret = settings.REDDIT_CLIENT_SECRET
        self.user_agent = settings.REDDIT_USER_AGENT
        self.is_configured = settings.is_reddit_configured
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    async def _get_oauth_token(self) -> Optional[str]:
        if not self.is_configured:
            return None
        if self._access_token and time.time() < self._token_expires_at - 60:
            return self._access_token

        try:
            auth = httpx.BasicAuth(self.client_id, self.client_secret)
            data = {"grant_type": "client_credentials"}
            headers = {"User-Agent": self.user_agent}
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post("https://www.reddit.com/api/v1/access_token", auth=auth, data=data, headers=headers)
                if res.status_code == 200:
                    token_data = res.json()
                    self._access_token = token_data.get("access_token")
                    self._token_expires_at = time.time() + token_data.get("expires_in", 3600)
                    return self._access_token
        except Exception as e:
            logger.error("Reddit OAuth token request failed: %s", e)
        return None

    async def get_hot_submissions(self, subreddit: str = "india", limit: int = 15) -> List[NormalizedContent]:
        """Retrieves hot submissions from specified subreddit."""
        start_time = time.time()
        token = await self._get_oauth_token()

        if token:
            url = f"{REDDIT_OAUTH_BASE}/r/{subreddit}/hot.json"
            headers = {"Authorization": f"Bearer {token}", "User-Agent": self.user_agent}
        else:
            # Fallback or unauthenticated public endpoint with rate-limit care
            if not self.is_configured:
                logger.info("Reddit credentials unconfigured; returning labeled DEMO DATA.")
                return self._get_fallback_items(limit=limit)
            url = f"{REDDIT_BASE}/r/{subreddit}/hot.json"
            headers = {"User-Agent": self.user_agent}

        params = {"limit": min(limit, 50)}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=headers, params=params)
                duration_ms = int((time.time() - start_time) * 1000)

                if res.status_code == 200:
                    data = res.json()
                    children = data.get("data", {}).get("children", [])
                    normalized_items = []
                    for child in children:
                        raw = child.get("data", {})
                        item = self._normalize_reddit_item(raw, subreddit, data_mode="OFFICIAL API")
                        upsert_content(item.model_dump())
                        normalized_items.append(item)

                    log_api_fetch("reddit", f"/r/{subreddit}/hot", 200, len(normalized_items), duration_ms)
                    return normalized_items
                else:
                    err_msg = f"HTTP {res.status_code}: {res.text}"
                    logger.warning("Reddit API error: %s", err_msg)
                    log_api_fetch("reddit", f"/r/{subreddit}/hot", res.status_code, 0, duration_ms, err_msg)
                    return self._get_fallback_items(limit=limit, notice=f"Official API status {res.status_code}")
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error("Reddit request exception: %s", e)
            log_api_fetch("reddit", f"/r/{subreddit}/hot", 500, 0, duration_ms, str(e))
            return self._get_fallback_items(limit=limit, notice=str(e))

    async def search_submissions(self, query: str = "technology", limit: int = 10) -> List[NormalizedContent]:
        """Searches submissions matching query across Indian subreddits."""
        items = await self.get_hot_submissions(subreddit="india", limit=limit * 2)
        if not query:
            return items[:limit]
        q_lower = query.lower()
        filtered = [
            it for it in items 
            if q_lower in (it.title or "").lower() or q_lower in (it.description or "").lower()
        ]
        return filtered[:limit] if filtered else items[:limit]

    def _normalize_reddit_item(self, raw: Dict[str, Any], subreddit: str, data_mode: str = "OFFICIAL API") -> NormalizedContent:
        content_id = raw.get("id", "unknown")
        title = raw.get("title", "Reddit Discussion")
        selftext = raw.get("selftext", "")
        author = raw.get("author", "[deleted]")
        score = raw.get("score", 0)
        num_comments = raw.get("num_comments", 0)
        permalink = f"https://www.reddit.com{raw.get('permalink', '')}"
        thumbnail = raw.get("thumbnail") if raw.get("thumbnail", "").startswith("http") else None

        created_utc = raw.get("created_utc")
        if created_utc:
            published_at = datetime.fromtimestamp(created_utc, tz=timezone.utc).isoformat()
        else:
            published_at = datetime.now(timezone.utc).isoformat()

        engagement = score + num_comments
        sent_cat, sent_score = analyze_sentiment(f"{title} {selftext}")
        tags = [h["hashtag"] for h in extract_hashtags([f"{title} {selftext}"], top_n=4)]
        tags.insert(0, f"#r/{subreddit}")

        return NormalizedContent(
            platform="reddit",
            content_id=content_id,
            content_type="submission",
            title=title,
            description=selftext[:300] if selftext else None,
            author=f"u/{author}",
            author_id=author,
            url=permalink,
            thumbnail=thumbnail,
            published_at=published_at,
            views=None,
            likes=score,
            comments=num_comments,
            shares=None,
            engagement=engagement,
            location="Community / Reddit India",
            location_type="metadata",
            category="Community Sentiment & Tech Discussion",
            hashtags=tags,
            sentiment=sent_cat,
            sentiment_score=sent_score,
            data_mode=data_mode,
            raw_metadata={"subreddit": subreddit, "upvote_ratio": raw.get("upvote_ratio")}
        )

    def _get_fallback_items(self, limit: int = 10, notice: Optional[str] = None) -> List[NormalizedContent]:
        fallback_data = [
            {
                "id": "reddit_t3_01",
                "title": "Comprehensive Guide: How the 1930 Cyber Fraud Helpline Actually Operates Behind the Scenes",
                "text": "Detailed breakdown of the Indian Cyber Crime Coordination Centre (I4C) API integration with 250+ banks to immediately put holds on compromised transactions within the golden hour.",
                "author": "tech_governance_in",
                "score": 3840,
                "comments": 412,
                "subreddit": "india"
            },
            {
                "id": "reddit_t3_02",
                "title": "PSA: Fake e-challan SMS scam is spreading across Bhopal and Indore. Do NOT click the link.",
                "text": "They send an SMS saying your vehicle has an unpaid traffic challan and link to an APK containing malware that reads OTPs. Here is what the genuine Parivahan portal URL looks like.",
                "author": "bhopal_commuter",
                "score": 2190,
                "comments": 184,
                "subreddit": "Bhopal"
            }
        ]

        items = []
        for d in fallback_data[:limit]:
            score = d["score"]
            comms = d["comments"]
            eng = score + comms
            sent_cat, sent_score = analyze_sentiment(f"{d['title']} {d['text']}")
            tags = [f"#r/{d['subreddit']}", "#CyberSecurity", "#PSA"]

            item = NormalizedContent(
                platform="reddit",
                content_id=d["id"],
                content_type="submission",
                title=d["title"],
                description=d["text"],
                author=f"u/{d['author']}",
                author_id=d["author"],
                url=f"https://www.reddit.com/r/{d['subreddit']}/comments/{d['id']}",
                thumbnail=None,
                published_at="2026-09-25T12:00:00Z",
                views=None,
                likes=score,
                comments=comms,
                shares=None,
                engagement=eng,
                location="Madhya Pradesh / National",
                location_type="metadata",
                category="Grassroots Cyber Awareness",
                hashtags=tags,
                sentiment=sent_cat,
                sentiment_score=sent_score,
                data_mode="DEMO DATA",
                raw_metadata={"fallback_reason": notice or "REDDIT_CLIENT_ID unconfigured in .env"}
            )
            upsert_content(item.model_dump())
            items.append(item)
        return items

reddit_service = RedditService()
