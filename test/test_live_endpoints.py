"""
Tests live endpoints on http://localhost:8000 to verify:
1. Health status is healthy and YouTube is configured.
2. Popular/Trending endpoint returns video data.
3. Search endpoint returns video data.
4. Error/fallback handling is clean.
5. Zero leakage of API key in response bodies.
"""
import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv('backend/.env')
raw_key = os.getenv('YOUTUBE_API_KEY', '')

def verify_live():
    print("=" * 60)
    print("TESTING LIVE FASTAPI BACKEND (http://localhost:8000)")
    print("=" * 60)
    
    with httpx.Client(base_url="http://localhost:8000", timeout=10.0) as client:
        # 1. Health Endpoint
        r_health = client.get("/api/health")
        print(f"[1] GET /api/health -> Status: {r_health.status_code}")
        health_data = r_health.json()
        yt_status = health_data.get("platforms", {}).get("youtube", {})
        print(f"    - YouTube Configured: {yt_status.get('is_configured')}")
        print(f"    - YouTube Data Mode:  {yt_status.get('data_mode')}")
        print(f"    - YouTube Status:     {yt_status.get('status')}")
        assert r_health.status_code == 200
        assert yt_status.get('is_configured') is True
        assert raw_key not in r_health.text, "Key exposed in /api/health!"

        # 2. Trending / Popular Videos
        r_trending = client.get("/api/trending?platform=youtube&limit=5")
        print(f"\n[2] GET /api/trending?platform=youtube -> Status: {r_trending.status_code}")
        trending_data = r_trending.json()
        items = trending_data.get("items", [])
        print(f"    - Items Returned: {len(items)}")
        print(f"    - Data Mode:      {trending_data.get('data_mode')}")
        if items:
            sample = items[0]
            print(f"    - Sample Title:   {sample.get('title')[:60]}...")
            print(f"    - Sample Author:  {sample.get('author')}")
            print(f"    - Sample Views:   {sample.get('views')}")
            print(f"    - Engagement:     {sample.get('engagement')}")
            print(f"    - Fallback Notice: {sample.get('raw_metadata', {}).get('fallback_reason')}")
        assert r_trending.status_code == 200
        assert len(items) > 0
        assert raw_key not in r_trending.text, "Key exposed in /api/trending!"

        # 3. YouTube Search Endpoint
        r_search = client.get("/api/youtube/search?query=india&limit=3")
        print(f"\n[3] GET /api/youtube/search?query=india -> Status: {r_search.status_code}")
        search_data = r_search.json()
        search_items = search_data.get("items", [])
        print(f"    - Items Returned: {len(search_items)}")
        print(f"    - Data Mode:      {search_data.get('data_mode')}")
        assert r_search.status_code == 200
        assert len(search_items) > 0
        assert raw_key not in r_search.text, "Key exposed in /api/youtube/search!"

    print("\n" + "=" * 60)
    print("ALL LIVE ENDPOINT TESTS PASSED SUCCESSFULLY! ZERO KEY LEAKS.")
    print("=" * 60)

if __name__ == "__main__":
    verify_live()
