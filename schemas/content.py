"""
Pydantic schemas for normalized multi-platform data models, API responses, and filters.
"""
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field

class PlatformEnum(str, Enum):
    YOUTUBE = "youtube"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    X = "x"
    REDDIT = "reddit"
    NEWS = "news"

class ContentTypeEnum(str, Enum):
    VIDEO = "video"
    POST = "post"
    TWEET = "tweet"
    ARTICLE = "article"
    SUBMISSION = "submission"
    REEL = "reel"
    UNKNOWN = "unknown"

class NormalizedContent(BaseModel):
    """
    Unified cross-platform normalized content model.
    Platform-specific connectors adapt raw responses to this structure.
    """
    platform: str = Field(..., description="Platform identifier (youtube, instagram, facebook, x, reddit, news)")
    content_id: str = Field(..., description="Unique platform item ID")
    content_type: str = Field(default="post", description="Type of media (video, post, tweet, article, submission)")
    title: str = Field(default="", description="Title or headline")
    description: Optional[str] = Field(default=None, description="Body text or video description")
    author: str = Field(default="Unknown Author", description="Creator, publisher, or channel name")
    author_id: Optional[str] = Field(default=None, description="Author identifier or handle")
    url: str = Field(default="", description="Canonical web URL to the content item")
    thumbnail: Optional[str] = Field(default=None, description="Cover image or thumbnail URL")
    published_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z", description="ISO 8601 publication timestamp")
    views: Optional[int] = Field(default=None, description="View count if available")
    likes: Optional[int] = Field(default=None, description="Like or upvote count if available")
    comments: Optional[int] = Field(default=None, description="Comment or reply count if available")
    shares: Optional[int] = Field(default=None, description="Share or retweet count if available")
    engagement: int = Field(default=0, description="Computed total engagement metric")
    engagement_rate: Optional[float] = Field(default=None, description="Calculated engagement rate percentage if denominator exists")
    location: Optional[str] = Field(default=None, description="Directly reported or metadata-derived state/location")
    location_type: Optional[str] = Field(default=None, description="'reported', 'metadata', or 'inferred'")
    category: Optional[str] = Field(default=None, description="Topic category (Technology, Governance, Cyber, Public Safety, etc.)")
    hashtags: List[str] = Field(default_factory=list, description="Extracted or declared hashtags")
    sentiment: Optional[str] = Field(default=None, description="positive, negative, or neutral")
    sentiment_score: Optional[float] = Field(default=None, description="Normalized score between -1.0 and +1.0")
    data_mode: str = Field(default="OFFICIAL API", description="'OFFICIAL API' or 'DEMO DATA'")
    fetched_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    raw_metadata: Dict[str, Any] = Field(default_factory=dict, description="Platform-specific raw payload fields")

class PlatformStatus(BaseModel):
    name: str
    code: str
    is_configured: bool
    data_mode: str
    status: str
    rate_limit_remaining: Optional[int] = None
    rate_limit_reset: Optional[str] = None
    description: str
    capabilities: List[str]

class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str = "2.0.0"
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    environment: str = "development"
    database_connected: bool = True
    database_records_count: int = 0
    platforms: Dict[str, PlatformStatus]

class ContentListResponse(BaseModel):
    total: int
    page: int = 1
    limit: int = 20
    data_mode: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    items: List[NormalizedContent]

class TrendingResponse(BaseModel):
    platform: Optional[str] = None
    category: Optional[str] = None
    total: int
    data_mode: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    items: List[NormalizedContent]
    trending_topics: List[Dict[str, Any]] = Field(default_factory=list)

class StatePulseResponse(BaseModel):
    state: str
    category: Optional[str] = None
    total_items: int
    data_mode: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    location_accuracy: str = Field(default="metadata/query", description="Directly reported, platform metadata, or topic filtered")
    items: List[NormalizedContent]
    state_metrics: Dict[str, Any] = Field(default_factory=dict)
    top_topics: List[Dict[str, Any]] = Field(default_factory=list)

class SentimentBreakdown(BaseModel):
    positive: float = 0.0
    neutral: float = 0.0
    negative: float = 0.0
    dominant_sentiment: str = "neutral"

class NarrativeIntelligenceResponse(BaseModel):
    total_analyzed: int
    data_mode: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    sentiment_breakdown: SentimentBreakdown
    keyword_frequency: List[Dict[str, Any]] = Field(default_factory=list)
    hashtag_frequency: List[Dict[str, Any]] = Field(default_factory=list)
    topic_distribution: List[Dict[str, Any]] = Field(default_factory=list)
    platform_comparison: Dict[str, Any] = Field(default_factory=dict)
    key_narratives: List[Dict[str, Any]] = Field(default_factory=list)

class AnalyticsResponse(BaseModel):
    total_content: int
    total_engagement: int
    total_views: int
    platform_distribution: Dict[str, int]
    sentiment_summary: Dict[str, float]
    top_hashtags: List[Dict[str, Any]]
    top_topics: List[Dict[str, Any]]
    data_mode: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
