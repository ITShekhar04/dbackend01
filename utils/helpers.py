"""
Helper utilities for parsing dates, formatting numbers, and managing rate limits.
"""
from datetime import datetime, timezone
import re
from typing import Optional

def parse_iso_datetime(dt_str: Optional[str]) -> str:
    """Safely normalizes any date string into standard ISO-8601 UTC string."""
    if not dt_str:
        return datetime.now(timezone.utc).isoformat()
    try:
        # Handles Z suffix and common formats
        cleaned = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()

def format_count(count: Optional[int]) -> str:
    """Formats large integer counts into human-readable strings (e.g. 1.2M, 45K)."""
    if count is None:
        return "N/A"
    if count >= 1_000_000:
        return f"{count / 1_000_000:.1f}M"
    if count >= 1_000:
        return f"{count / 1_000:.1f}K"
    return str(count)

def sanitize_query(query: Optional[str]) -> str:
    """Sanitizes user input to prevent injection or malformed URI queries."""
    if not query:
        return ""
    # Strip dangerous characters, keep alphanumeric, spaces, and safe punctuation
    return re.sub(r'[^\w\s\-\.\#\u0900-\u097F]', '', query).strip()
