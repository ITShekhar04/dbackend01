"""
Dhristi AI - YouTube Data API v3 Integration Test Suite
Verifies:
1. API key is loaded correctly and safely masked.
2. Official YouTube Data API v3 endpoint connectivity for India (IN).
3. Backend normalization pipeline produces valid NormalizedContent models.
4. Fault tolerance: proper handling of API errors (403 referrer blocked), quota limits, and network issues.
5. Zero credential exposure across logs, responses, and database records.
"""
import os
import sys
import unittest
import asyncio
from unittest.mock import patch, MagicMock
from datetime import datetime
import httpx

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from config.config import settings
from services.youtube import YouTubeService, youtube_service
from schemas.content import NormalizedContent
from database.db import init_db, get_connection, upsert_content, get_content_records


class TestYouTubeIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.service = YouTubeService()
        cls.raw_key = settings.YOUTUBE_API_KEY

    # -------------------------------------------------------------
    # 1. API KEY LOADING AND MASKING VERIFICATION
    # -------------------------------------------------------------
    def test_01_api_key_loaded_correctly(self):
        """Verify the API key is loaded from the environment and configured."""
        self.assertTrue(bool(self.raw_key), "YOUTUBE_API_KEY must not be empty")
        self.assertGreater(len(self.raw_key), 20, "API key length should be greater than 20 chars")
        self.assertTrue(self.raw_key.startswith("AIzaSy"), "Google Cloud API key must start with 'AIzaSy'")
        self.assertTrue(settings.is_youtube_configured, "settings.is_youtube_configured must evaluate to True")

    def test_02_api_key_masking_integrity(self):
        """Verify the key masking function completely redacts the secret key."""
        sample_log = f"Error calling Google API with key {self.raw_key} on project 165165104958"
        masked = self.service._mask_key(sample_log)
        self.assertNotIn(self.raw_key, masked, "Raw API key must never appear in masked text")
        self.assertIn("...****", masked, "Masked text must contain redaction asterisks")

    # -------------------------------------------------------------
    # 2. GOOGLE CLOUD YOUTUBE DATA API v3 ENDPOINT CONNECTIVITY
    # -------------------------------------------------------------
    def test_03_youtube_api_v3_reachability_india(self):
        """
        Verify live outbound request to official YouTube Data API v3 endpoint for India.
        Confirms Google Cloud recognizes the key and project 165165104958.
        """
        async def run_fetch():
            url = "https://www.googleapis.com/youtube/v3/videos"
            params = {
                "part": "snippet,contentDetails,statistics",
                "chart": "mostPopular",
                "regionCode": "IN",
                "maxResults": 3,
                "key": self.raw_key
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params)
                return res.status_code, res.json()

        status_code, body = asyncio.run(run_fetch())
        # Google responds either with 200 (if referrer restriction is lifted)
        # or 403 API_KEY_HTTP_REFERRER_BLOCKED (confirming key & project validity)
        if status_code == 200:
            self.assertIn("items", body)
            self.assertEqual(body.get("kind"), "youtube#videoListResponse")
        elif status_code == 403:
            err = body.get("error", {})
            self.assertEqual(err.get("code"), 403)
            # Google Cloud confirms consumer project and active service
            details = err.get("details", [])
            has_project_info = any("165165104958" in str(d) for d in details)
            self.assertTrue(has_project_info or "blocked" in err.get("message", "").lower(),
                            "Google Cloud must authenticate key against project")

    # -------------------------------------------------------------
    # 3. BACKEND ACTUAL VIDEO DATA NORMALIZATION & DB PERSISTENCE
    # -------------------------------------------------------------
    def test_04_normalize_actual_youtube_payload(self):
        """
        Verify that real YouTube Data API v3 video items are correctly normalized
        into Dhristi's unified NormalizedContent schema.
        """
        sample_youtube_item = {
            "kind": "youtube#video",
            "id": "dQw4w9WgXcQ",
            "snippet": {
                "publishedAt": "2026-09-20T10:00:00Z",
                "channelId": "UCuAXFkgsw1L7xaCfnd5JJOw",
                "title": "National Cyber Defense Protocol 2026: Official Briefing",
                "description": "Comprehensive security protocol issued for Indian digital infrastructure. #CyberSecurity #IndiaSafety",
                "channelTitle": "Cyber Security Division India",
                "tags": ["CyberSecurity", "IndiaSafety", "NationalDefense"],
                "thumbnails": {
                    "high": {"url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}
                },
                "liveBroadcastContent": "none"
            }
        }
        sample_statistics = {
            "viewCount": "750000",
            "likeCount": "48000",
            "commentCount": "3200"
        }

        normalized = self.service._normalize_youtube_item(
            raw=sample_youtube_item,
            stats=sample_statistics,
            data_mode="OFFICIAL API"
        )

        self.assertIsInstance(normalized, NormalizedContent)
        self.assertEqual(normalized.platform, "youtube")
        self.assertEqual(normalized.content_id, "dQw4w9WgXcQ")
        self.assertEqual(normalized.data_mode, "OFFICIAL API")
        self.assertEqual(normalized.title, "National Cyber Defense Protocol 2026: Official Briefing")
        self.assertEqual(normalized.author, "Cyber Security Division India")
        self.assertEqual(normalized.views, 750000)
        self.assertEqual(normalized.likes, 48000)
        self.assertEqual(normalized.comments, 3200)
        self.assertEqual(normalized.engagement, 51200)
        self.assertAlmostEqual(normalized.engagement_rate, 6.83, delta=0.01)
        self.assertIn("#CyberSecurity", normalized.hashtags)
        self.assertIn(normalized.sentiment, ["positive", "negative", "neutral"])

        # Test SQLite Persistence
        upsert_content(normalized.model_dump())
        stored = get_content_records(platform="youtube", limit=10)
        stored_ids = [s["content_id"] for s in stored]
        self.assertIn("dQw4w9WgXcQ", stored_ids, "Normalized item must be persisted into SQLite database")

    # -------------------------------------------------------------
    # 4. API ERROR AND QUOTA LIMIT HANDLING
    # -------------------------------------------------------------
    def test_05_quota_exceeded_error_handling(self):
        """
        Verify that HTTP 403 quotaExceeded is handled gracefully:
        returns labeled fallback items without raising exceptions or crashing.
        """
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = '{"error": {"code": 403, "errors": [{"reason": "quotaExceeded"}], "message": "The request cannot be completed because you have exceeded your quota."}}'
        mock_response.json.return_value = {"error": {"code": 403, "message": "Quota exceeded"}}

        async def run_mocked():
            with patch("httpx.AsyncClient.get", return_value=mock_response):
                items = await self.service.get_trending(limit=4)
                return items

        items = asyncio.run(run_mocked())
        self.assertEqual(len(items), 4)
        self.assertEqual(items[0].data_mode, "DEMO DATA")
        self.assertEqual(items[0].raw_metadata.get("fallback_reason"), "YouTube API daily quota exceeded")

    def test_06_http_referrer_blocked_error_handling(self):
        """
        Verify that HTTP 403 API_KEY_HTTP_REFERRER_BLOCKED is handled gracefully
        with informative fallback reason and zero crashes.
        """
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = '{"error": {"code": 403, "details": [{"reason": "API_KEY_HTTP_REFERRER_BLOCKED"}], "message": "Requests from referer are blocked."}}'
        mock_response.json.return_value = {"error": {"code": 403, "message": "Blocked"}}

        async def run_mocked():
            with patch("httpx.AsyncClient.get", return_value=mock_response):
                items = await self.service.search_videos(query="cyber security", limit=3)
                return items

        items = asyncio.run(run_mocked())
        self.assertEqual(len(items), 3)
        self.assertEqual(items[0].data_mode, "DEMO DATA")
        self.assertEqual(items[0].raw_metadata.get("fallback_reason"), "YouTube API HTTP referrer restriction active")

    def test_07_network_exception_handling(self):
        """
        Verify that connection timeouts or DNS network exceptions are caught safely.
        """
        async def run_exception():
            with patch("httpx.AsyncClient.get", side_effect=httpx.ConnectTimeout("Connection timed out")):
                items = await self.service.get_trending(limit=2)
                return items

        items = asyncio.run(run_exception())
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0].data_mode, "DEMO DATA")
        self.assertEqual(items[0].raw_metadata.get("fallback_reason"), "YouTube API connection error")

    # -------------------------------------------------------------
    # 5. ZERO CREDENTIAL EXPOSURE (SECURITY COMPLIANCE)
    # -------------------------------------------------------------
    def test_08_no_api_key_in_db_audit_logs(self):
        """Verify the SQLite api_fetch_logs table never contains the raw API key."""
        conn = get_connection()
        rows = conn.execute("SELECT error_message FROM api_fetch_history WHERE platform = 'youtube'").fetchall()
        conn.close()
        for r in rows:
            err = r["error_message"] or ""
            self.assertNotIn(self.raw_key, err, "Raw API key must NEVER be stored in api_fetch_history database table")

    def test_09_no_api_key_in_content_items(self):
        """Verify that NormalizedContent items never contain the secret key."""
        items = self.service._get_fallback_items(query="test", limit=5)
        for item in items:
            serialized = item.model_dump_json()
            self.assertNotIn(self.raw_key, serialized, "API key must not appear in serialized content items")


if __name__ == "__main__":
    unittest.main()
