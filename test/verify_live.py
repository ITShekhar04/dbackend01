import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv('backend/.env')
key = os.getenv('YOUTUBE_API_KEY', '')

async def test():
    masked_key = f"{key[:6]}...****" if key else "None"
    print(f"Loaded API Key: {masked_key} (Length: {len(key)})")
    
    url = 'https://www.googleapis.com/youtube/v3/videos'
    params = {
        'part': 'snippet,statistics',
        'chart': 'mostPopular',
        'regionCode': 'IN',
        'maxResults': 3,
        'key': key
    }
    headers = {'Referer': os.getenv('YOUTUBE_REFERER', '')} if os.getenv('YOUTUBE_REFERER') else {}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url, params=params, headers=headers)
        print(f"Google Response Status: {r.status_code}")
        if r.status_code == 200:
            print(">>> LIVE POPULAR VIDEOS IN INDIA FETCHED SUCCESSFULLY! <<<")
            data = r.json()
            items = data.get('items', [])
            print(f"Total Videos Received: {len(items)}")
            for idx, it in enumerate(items, 1):
                snippet = it.get('snippet', {})
                stats = it.get('statistics', {})
                print(f"[{idx}] Title: {snippet.get('title')}")
                print(f"    Channel: {snippet.get('channelTitle')}")
                print(f"    Published: {snippet.get('publishedAt')}")
                print(f"    Views: {stats.get('viewCount')}, Likes: {stats.get('likeCount')}")
        else:
            print(f"Google Error Response: {r.text[:300]}")

if __name__ == "__main__":
    asyncio.run(test())
