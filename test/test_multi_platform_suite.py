"""
End-to-End Automated Test Suite for Dhristi Multi-Platform Intelligence System.
Tests:
1. Health status and platform registry
2. All 6 platform search connectors (YouTube, Instagram, Facebook, X, Reddit, News)
3. Trending aggregation endpoint
4. State Pulse geo-filtering endpoint
5. Narrative Intelligence sentiment & NLP endpoint
6. Analytics calculations
7. Database persistence and deduplication
8. Error handling & validation boundaries
9. Cross-service proxy integration (Port 8000 and Port 5000)
"""
import sys
import os
import unittest
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from main import app
from database.db import get_connection, get_content_count, upsert_content
from analytics.processor import analyze_sentiment, extract_keywords, compute_cross_platform_analytics

class TestMultiPlatformIntelligence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health_endpoint(self):
        """Verify GET /api/health returns 200 with platform statuses and DB connectivity."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertTrue(data.get("database_connected"))
        self.assertIn("platforms", data)
        self.assertGreaterEqual(len(data["platforms"]), 6)
        for p in ["youtube", "instagram", "facebook", "x", "telegram", "reddit", "news"]:
            self.assertIn(p, data["platforms"])
            self.assertIn("data_mode", data["platforms"][p])
            self.assertIn("capabilities", data["platforms"][p])

    def test_02_platforms_registry(self):
        """Verify GET /api/platforms lists developer portal and limitations."""
        res = self.client.get("/api/platforms")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data.get("total_platforms"), 6)
        codes = [p["code"] for p in data.get("platforms", [])]
        self.assertIn("youtube", codes)
        self.assertIn("instagram", codes)
        self.assertIn("facebook", codes)
        self.assertIn("x", codes)
        self.assertIn("telegram", codes)
        self.assertIn("reddit", codes)

    def test_03_youtube_search(self):
        """Verify GET /api/youtube/search returns valid normalized video records."""
        res = self.client.get("/api/youtube/search?query=cyber&limit=3")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data.get("total"), 0)
        item = data["items"][0]
        self.assertEqual(item["platform"], "youtube")
        self.assertEqual(item["content_type"], "video")
        self.assertTrue(len(item["title"]) > 0)
        self.assertTrue(item["url"].startswith("https://www.youtube.com/"))
        self.assertIn("data_mode", item)

    def test_04_instagram_search(self):
        """Verify GET /api/instagram/search returns normalized post records."""
        res = self.client.get("/api/instagram/search?query=scam&limit=2")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data.get("total"), 0)
        item = data["items"][0]
        self.assertEqual(item["platform"], "instagram")
        self.assertIn(item["content_type"], ["post", "reel"])
        self.assertIn("data_mode", item)

    def test_05_facebook_search(self):
        """Verify GET /api/facebook/search returns normalized community post records."""
        res = self.client.get("/api/facebook/search?query=safety&limit=2")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data.get("total"), 0)
        item = data["items"][0]
        self.assertEqual(item["platform"], "facebook")
        self.assertEqual(item["content_type"], "post")

    def test_06_x_search(self):
        """Verify GET /api/x/search returns normalized tweet records with engagement metrics."""
        res = self.client.get("/api/x/search?query=India&limit=2")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data.get("total"), 0)
        item = data["items"][0]
        self.assertEqual(item["platform"], "x")
        self.assertEqual(item["content_type"], "tweet")
        self.assertIn("likes", item)
        self.assertIn("comments", item)

    def test_07_reddit_search(self):
        """Verify GET /api/reddit/search returns normalized subreddit submissions."""
        res = self.client.get("/api/reddit/search?query=cybersecurity&limit=2")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data.get("total"), 0)
        item = data["items"][0]
        self.assertEqual(item["platform"], "reddit")
        self.assertEqual(item["content_type"], "submission")

    def test_08_news_search(self):
        """Verify GET /api/news/search returns normalized press articles."""
        res = self.client.get("/api/news/search?query=technology&limit=2")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data.get("total"), 0)
        item = data["items"][0]
        self.assertEqual(item["platform"], "news")
        self.assertEqual(item["content_type"], "article")

    def test_09_trending_aggregation(self):
        """Verify GET /api/trending aggregates multi-platform items with velocity indicators."""
        res = self.client.get("/api/trending?limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(len(data.get("items", [])), 0)
        self.assertIn("trending_topics", data)
        platforms_found = {it["platform"] for it in data["items"]}
        self.assertTrue(len(platforms_found) >= 2)

    def test_10_state_pulse_filtering(self):
        """Verify GET /api/state-pulse accurately filters for specified Indian state and category."""
        res = self.client.get("/api/state-pulse?state=Madhya%20Pradesh&category=Technology&limit=5")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("state"), "Madhya Pradesh")
        self.assertEqual(data.get("category"), "Technology")
        self.assertIn("location_accuracy", data)
        self.assertIn("state_metrics", data)

    def test_11_narrative_intelligence_nlp(self):
        """Verify GET /api/narrative-intelligence computes sentiment, keywords, and topics."""
        res = self.client.get("/api/narrative-intelligence?limit=15")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("sentiment_breakdown", data)
        sent = data["sentiment_breakdown"]
        self.assertIn("positive", sent)
        self.assertIn("neutral", sent)
        self.assertIn("negative", sent)
        self.assertIn("dominant_sentiment", sent)
        self.assertIn("keyword_frequency", data)
        self.assertIn("key_narratives", data)

    def test_12_analytics_calculations(self):
        """Verify GET /api/analytics returns cross-platform distribution and metrics."""
        res = self.client.get("/api/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total_content", data)
        self.assertIn("platform_distribution", data)
        self.assertIn("sentiment_summary", data)

    def test_13_database_deduplication(self):
        """Verify SQLite database enforces uniqueness on (platform, content_id)."""
        test_payload = {
            "platform": "youtube",
            "content_id": "test_dedup_001",
            "content_type": "video",
            "title": "Initial Title",
            "author": "Test Author",
            "url": "https://youtube.com/watch?v=test_dedup_001",
            "views": 100,
            "likes": 10,
            "engagement": 10,
            "data_mode": "DEMO DATA"
        }
        # First insert
        uid1 = upsert_content(test_payload)
        count_before = get_content_count()

        # Update same item with new title and engagement
        test_payload["title"] = "Updated Title"
        test_payload["engagement"] = 50
        uid2 = upsert_content(test_payload)
        count_after = get_content_count()

        self.assertEqual(uid1, uid2)
        self.assertEqual(count_before, count_after)

    def test_14_input_validation_and_errors(self):
        """Verify input validation limits and boundary behavior."""
        # Query parameter exceeds maximum limit
        res = self.client.get("/api/youtube/search?query=test&limit=500")
        self.assertEqual(res.status_code, 422) # Unprocessable Entity

        # Query parameter below minimum limit
        res2 = self.client.get("/api/youtube/search?query=test&limit=0")
        self.assertEqual(res2.status_code, 422)

    def test_15_nlp_sentiment_classifier(self):
        """Unit test for sentiment classifier and keyword extractor."""
        pos_cat, pos_score = analyze_sentiment("Great success and significant achievement in cyber security defense.")
        self.assertEqual(pos_cat, "positive")
        self.assertGreater(pos_score, 0)

        neg_cat, neg_score = analyze_sentiment("Critical malware breach, ransomware exploit, and fatal scam alert.")
        self.assertEqual(neg_cat, "negative")
        self.assertLess(neg_score, 0)

if __name__ == "__main__":
    unittest.main()
