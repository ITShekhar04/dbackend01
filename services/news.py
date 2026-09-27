"""
News Sources Connector (NewsAPI / GNews).
Uses official NewsAPI and GNews REST endpoints:
- GET /v2/top-headlines?country=in
- GET /v2/everything?q={query}
Normalizes into unified NormalizedContent model.
Safe labeled DEMO DATA fallback when NEWS_API_KEY is unconfigured.
"""
import logging
import time
from typing import List, Dict, Any, Optional
import httpx

from config.config import settings
from schemas.content import NormalizedContent
from database.db import upsert_content, log_api_fetch
from analytics.processor import analyze_sentiment, extract_hashtags

logger = logging.getLogger("dhristi.services.news")

NEWS_API_BASE = "https://newsapi.org/v2"
GNEWS_API_BASE = "https://gnews.io/api/v4"

class NewsService:
    def __init__(self):
        self.news_api_key = settings.NEWS_API_KEY
        self.gnews_api_key = settings.GNEWS_API_KEY
        self.is_configured = settings.is_news_configured

    async def get_top_headlines(self, query: str = "", category: str = "technology", limit: int = 15) -> List[NormalizedContent]:
        """Fetches top headlines in India from official NewsAPI or GNews."""
        start_time = time.time()
        if not self.is_configured:
            logger.info("News API key unconfigured; returning labeled DEMO DATA.")
            return self._get_fallback_items(query=query, limit=limit)

        if self.news_api_key:
            return await self._fetch_newsapi(query, category, limit, start_time)
        elif self.gnews_api_key:
            return await self._fetch_gnews(query, category, limit, start_time)

        return self._get_fallback_items(query=query, limit=limit)

    async def _fetch_newsapi(self, query: str, category: str, limit: int, start_time: float) -> List[NormalizedContent]:
        endpoint = "/top-headlines" if not query else "/everything"
        url = f"{NEWS_API_BASE}{endpoint}"
        params = {"apiKey": self.news_api_key, "pageSize": min(limit, 50)}

        if endpoint == "/top-headlines":
            params["country"] = "in"
            if category:
                params["category"] = category
        else:
            params["q"] = query or "India"
            params["sortBy"] = "publishedAt"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params)
                duration_ms = int((time.time() - start_time) * 1000)

                if res.status_code == 200:
                    articles = res.json().get("articles", [])
                    normalized_items = []
                    for art in articles:
                        item = self._normalize_news_item(art, source_provider="NewsAPI", data_mode="OFFICIAL API")
                        upsert_content(item.model_dump())
                        normalized_items.append(item)

                    log_api_fetch("news", endpoint, 200, len(normalized_items), duration_ms)
                    return normalized_items
                else:
                    err_msg = f"HTTP {res.status_code}: {res.text}"
                    logger.warning("NewsAPI error: %s", err_msg)
                    log_api_fetch("news", endpoint, res.status_code, 0, duration_ms, err_msg)
                    return self._get_fallback_items(query=query, limit=limit, notice=f"Official API status {res.status_code}")
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error("NewsAPI request exception: %s", e)
            log_api_fetch("news", endpoint, 500, 0, duration_ms, str(e))
            return self._get_fallback_items(query=query, limit=limit, notice=str(e))

    async def _fetch_gnews(self, query: str, category: str, limit: int, start_time: float) -> List[NormalizedContent]:
        url = f"{GNEWS_API_BASE}/top-headlines"
        params = {
            "token": self.gnews_api_key,
            "lang": "en",
            "country": "in",
            "max": min(limit, 20)
        }
        if query:
            url = f"{GNEWS_API_BASE}/search"
            params["q"] = query

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params)
                duration_ms = int((time.time() - start_time) * 1000)

                if res.status_code == 200:
                    articles = res.json().get("articles", [])
                    normalized_items = []
                    for art in articles:
                        item = self._normalize_news_item(art, source_provider="GNews", data_mode="OFFICIAL API")
                        upsert_content(item.model_dump())
                        normalized_items.append(item)

                    log_api_fetch("news", "/top-headlines", 200, len(normalized_items), duration_ms)
                    return normalized_items
        except Exception as e:
            logger.error("GNews request exception: %s", e)
        return self._get_fallback_items(query=query, limit=limit)

    def _normalize_news_item(self, raw: Dict[str, Any], source_provider: str = "NewsAPI", data_mode: str = "OFFICIAL API") -> NormalizedContent:
        url = raw.get("url", "")
        # Use URL hash as content_id
        content_id = str(abs(hash(url))) if url else "news_unknown"
        title = raw.get("title", "News Article")
        description = raw.get("description", "")
        published_at = raw.get("publishedAt", "")
        author = raw.get("source", {}).get("name") or raw.get("author") or "Official News Desk"
        thumbnail = raw.get("urlToImage") or raw.get("image")

        sent_cat, sent_score = analyze_sentiment(f"{title} {description}")
        tags = [h["hashtag"] for h in extract_hashtags([f"{title} {description}"], top_n=5)]
        tags.insert(0, "#NationalNews")

        return NormalizedContent(
            platform="news",
            content_id=content_id,
            content_type="article",
            title=title,
            description=description,
            author=author,
            author_id=source_provider,
            url=url,
            thumbnail=thumbnail,
            published_at=published_at,
            views=None,
            likes=None,
            comments=None,
            shares=None,
            engagement=1000, # Base credibility engagement
            location="National / India",
            location_type="reported",
            category="National Policy & Technology",
            hashtags=tags,
            sentiment=sent_cat,
            sentiment_score=sent_score,
            data_mode=data_mode,
            raw_metadata={"source": raw.get("source"), "provider": source_provider}
        )

    def _get_fallback_items(self, query: str = "", limit: int = 10, notice: Optional[str] = None) -> List[NormalizedContent]:
        fallback_data = [
            {
                "id": "news_in_01",
                "title": "Government Approves ₹1.25 Lakh Crore Digital Public Infrastructure Expansion Across Tier-2 & Tier-3 Cities",
                "desc": "Cabinet committee clears strategic funding for state data centres, optical fiber connectivity, and high-security state cyber operational nodes across Madhya Pradesh, Rajasthan, and Odisha.",
                "author": "Press Information Bureau (PIB)",
                "url": "https://pib.gov.in/PressReleaseIframePage.aspx?PRID=20260901",
                "location": "National / Multi-State"
            },
            {
                "id": "news_in_02",
                "title": "Madhya Pradesh Police Launches Cyber Command Center in Bhopal with Real-Time Threat Intelligence",
                "desc": "The new facility integrates 1930 distress feeds with AI automated threat clustering to mitigate cyber financial fraud and impersonation syndicates within 15 minutes of occurrence.",
                "author": "The Hindu Tech Desk",
                "url": "https://www.thehindu.com/news/national/other-states/mp-cyber-command-centre/article2026.ece",
                "location": "Madhya Pradesh"
            },
            {
                "id": "news_in_03",
                "title": "Telecom Regulatory Authority Mandates AI Calling Line Identification to Combat Financial Spoofing",
                "desc": "New telecommunication directives enforce cryptographic origin headers to verify genuine institutional calls and eliminate illegal spoofed VoIP gateways targeting banking users.",
                "author": "Economic Times Telecom",
                "url": "https://economictimes.indiatimes.com/tech/telecom/trai-ai-cli-verification/articleshow/2026.cms",
                "location": "National"
            }
        ]

        items = []
        for d in fallback_data[:limit]:
            sent_cat, sent_score = analyze_sentiment(f"{d['title']} {d['desc']}")
            tags = ["#NationalNews", "#DigitalIndia", "#CyberSecurity"]

            item = NormalizedContent(
                platform="news",
                content_id=d["id"],
                content_type="article",
                title=d["title"],
                description=d["desc"],
                author=d["author"],
                author_id="pib_news",
                url=d["url"],
                thumbnail="https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&auto=format&fit=crop&q=80",
                published_at="2026-09-25T16:00:00Z",
                views=None,
                likes=None,
                comments=None,
                shares=None,
                engagement=4500,
                location=d["location"],
                location_type="reported",
                category="National Governance & Policy",
                hashtags=tags,
                sentiment=sent_cat,
                sentiment_score=sent_score,
                data_mode="DEMO DATA",
                raw_metadata={"fallback_reason": notice or "NEWS_API_KEY unconfigured in .env"}
            )
            upsert_content(item.model_dump())
            items.append(item)
        return items

news_service = NewsService()
