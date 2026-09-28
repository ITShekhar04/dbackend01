"""
Database layer for Dhristi Multi-Platform Intelligence.
Implements robust SQLite database with tables for platforms, content, authors,
engagement, hashtags, locations, API fetch history, and analytics results.
Ensures deduplication using unique (platform, content_id) constraint.
"""
import sqlite3
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

from config.config import settings

logger = logging.getLogger("dhristi.database")

# Ensure data directory exists
settings.DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(settings.DATABASE_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes schema and tables for production-grade deduplication and storage."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Platforms Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS platforms (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            is_configured INTEGER NOT NULL DEFAULT 0,
            data_mode TEXT NOT NULL DEFAULT 'DEMO DATA',
            rate_limit_remaining INTEGER,
            last_synced_at TEXT
        );
    """)

    # 2. Authors Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS authors (
            id TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            author_id TEXT,
            author_name TEXT NOT NULL,
            followers_subscribers INTEGER DEFAULT 0,
            verified INTEGER DEFAULT 0,
            last_seen_at TEXT
        );
    """)

    # 3. Content Table (Deduplicated on platform + content_id)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS content (
            id TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            content_id TEXT NOT NULL,
            content_type TEXT NOT NULL,
            title TEXT,
            description TEXT,
            author_id TEXT,
            author_name TEXT,
            url TEXT,
            thumbnail TEXT,
            published_at TEXT,
            views INTEGER,
            likes INTEGER,
            comments INTEGER,
            shares INTEGER,
            engagement INTEGER DEFAULT 0,
            engagement_rate REAL,
            location TEXT,
            location_type TEXT,
            category TEXT,
            sentiment TEXT,
            sentiment_score REAL,
            data_mode TEXT NOT NULL,
            raw_metadata TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(platform, content_id)
        );
    """)

    # 4. Hashtags & Topics Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hashtags_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            tag_or_topic TEXT NOT NULL,
            tag_type TEXT NOT NULL, -- 'hashtag' or 'topic'
            created_at TEXT NOT NULL
        );
    """)

    # 5. Locations Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            state_name TEXT UNIQUE NOT NULL,
            mention_count INTEGER DEFAULT 1,
            sentiment_score REAL DEFAULT 0.0,
            last_updated TEXT NOT NULL
        );
    """)

    # 6. API Fetch History
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS api_fetch_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            status_code INTEGER NOT NULL,
            items_fetched INTEGER NOT NULL DEFAULT 0,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            timestamp TEXT NOT NULL
        );
    """)

    # 7. Analytics Results Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analytics_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            computed_at TEXT NOT NULL
        );
    """)

    # Indices for performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_content_platform ON content(platform);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_content_published ON content(published_at);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_content_location ON content(location);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);")

    conn.commit()
    conn.close()
    logger.info("Database schema initialized at %s", settings.DATABASE_PATH)

def upsert_content(item_dict: Dict[str, Any]) -> str:
    """Inserts or updates content with deduplication on (platform, content_id)."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"
    uid = f"{item_dict.get('platform')}_{item_dict.get('content_id')}"

    raw_meta = json.dumps(item_dict.get("raw_metadata", {}))

    cursor.execute("""
        INSERT INTO content (
            id, platform, content_id, content_type, title, description,
            author_id, author_name, url, thumbnail, published_at,
            views, likes, comments, shares, engagement, engagement_rate,
            location, location_type, category, sentiment, sentiment_score,
            data_mode, raw_metadata, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?
        )
        ON CONFLICT(platform, content_id) DO UPDATE SET
            title=excluded.title,
            description=excluded.description,
            views=excluded.views,
            likes=excluded.likes,
            comments=excluded.comments,
            shares=excluded.shares,
            engagement=excluded.engagement,
            engagement_rate=excluded.engagement_rate,
            sentiment=excluded.sentiment,
            sentiment_score=excluded.sentiment_score,
            data_mode=excluded.data_mode,
            raw_metadata=excluded.raw_metadata,
            updated_at=excluded.updated_at;
    """, (
        uid,
        item_dict.get("platform"),
        item_dict.get("content_id"),
        item_dict.get("content_type", "post"),
        item_dict.get("title", ""),
        item_dict.get("description"),
        item_dict.get("author_id"),
        item_dict.get("author", "Unknown Author"),
        item_dict.get("url", ""),
        item_dict.get("thumbnail"),
        item_dict.get("published_at", now),
        item_dict.get("views"),
        item_dict.get("likes"),
        item_dict.get("comments"),
        item_dict.get("shares"),
        item_dict.get("engagement", 0),
        item_dict.get("engagement_rate"),
        item_dict.get("location"),
        item_dict.get("location_type"),
        item_dict.get("category"),
        item_dict.get("sentiment"),
        item_dict.get("sentiment_score"),
        item_dict.get("data_mode", "OFFICIAL API"),
        raw_meta,
        now,
        now
    ))

    # Save hashtags if present
    hashtags = item_dict.get("hashtags", [])
    for tag in hashtags:
        cursor.execute("""
            INSERT INTO hashtags_topics (content_id, platform, tag_or_topic, tag_type, created_at)
            VALUES (?, ?, ?, 'hashtag', ?)
        """, (item_dict.get("content_id"), item_dict.get("platform"), tag, now))

    conn.commit()
    conn.close()
    return uid

def log_api_fetch(platform: str, endpoint: str, status_code: int, items_fetched: int, duration_ms: int, error_message: Optional[str] = None):
    """Records an external API call for compliance and audit trail."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO api_fetch_history (platform, endpoint, status_code, items_fetched, duration_ms, error_message, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            platform, endpoint, status_code, items_fetched, duration_ms, error_message,
            datetime.utcnow().isoformat() + "Z"
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Failed to log API fetch history: %s", e)

def get_content_records(
    platform: Optional[str] = None,
    category: Optional[str] = None,
    location: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """Retrieves content records matching given filters."""
    conn = get_connection()
    cursor = conn.cursor()

    query_parts = ["1=1"]
    params = []

    if platform:
        query_parts.append("platform = ?")
        params.append(platform)
    if category:
        query_parts.append("(category LIKE ? OR title LIKE ?)")
        params.extend([f"%{category}%", f"%{category}%"])
    if location:
        query_parts.append("(location LIKE ? OR title LIKE ? OR description LIKE ?)")
        params.extend([f"%{location}%", f"%{location}%", f"%{location}%"])
    if query:
        query_parts.append("(title LIKE ? OR description LIKE ? OR author_name LIKE ?)")
        params.extend([f"%{query}%", f"%{query}%", f"%{query}%"])

    sql = f"""
        SELECT * FROM content
        WHERE {' AND '.join(query_parts)}
        ORDER BY engagement DESC, published_at DESC
        LIMIT ? OFFSET ?
    """
    params.extend([limit, offset])

    cursor.execute(sql, params)
    rows = cursor.fetchall()
    results = [dict(row) for row in rows]
    conn.close()
    return results

def get_content_count() -> int:
    """Returns total records stored in the content table."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM content")
        count = cursor.fetchone()[0]
        conn.close()
        return count
    except Exception:
        return 0

def get_platform_hashtag_trends(platform: str = "instagram", limit: int = 15) -> List[Dict[str, Any]]:
    """Analyzes and ranks hashtag trends from collected platform content in the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT h.tag_or_topic as hashtag,
                   COUNT(h.id) as post_count,
                   COALESCE(SUM(c.engagement), 0) as total_engagement,
                   COALESCE(AVG(c.sentiment_score), 0.0) as avg_sentiment
            FROM hashtags_topics h
            LEFT JOIN content c ON h.content_id = c.content_id AND h.platform = c.platform
            WHERE h.platform = ?
            GROUP BY h.tag_or_topic
            ORDER BY total_engagement DESC, post_count DESC
            LIMIT ?;
        """, (platform, limit))
        rows = cursor.fetchall()
        results = [dict(row) for row in rows]
        conn.close()
        return results
    except Exception as e:
        logger.error("Failed to query platform hashtag trends: %s", e)
        return []

# Auto-initialize database on import
init_db()
