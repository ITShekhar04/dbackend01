"""
Dhristi AI - Production-Ready Multi-Platform Intelligence Backend Service
Built with FastAPI, Pydantic, HTTPX, and SQLite.
Aggregates official APIs: YouTube, Instagram, Facebook, X, Reddit, and News.
"""
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config.config import settings
from database.db import init_db
from routes import (
    health_router,
    platforms_router,
    platform_search_router,
    trending_router,
    content_router,
    state_pulse_router,
    narrative_intelligence_router,
    analytics_router
)
from services.youtube import youtube_service
from services.instagram import instagram_service
from services.facebook import facebook_service
from services.x import x_service
from services.telegram import telegram_service
from services.reddit import reddit_service
from services.news import news_service

# Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s"
)
# Silence verbose HTTP client wire logs to prevent query parameters or headers from leaking credentials
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger("dhristi.main")

# Background Refresh Task Handle
background_refresh_task: Optional[asyncio.Task] = None

async def periodic_data_refresh():
    """
    Scheduled background task that periodically refreshes permitted API feeds
    respecting rate limits and configured intervals.
    """
    interval_seconds = max(60, settings.REFRESH_INTERVAL_MINUTES * 60)
    logger.info("Starting background API refresh scheduler (Interval: %s minutes)...", settings.REFRESH_INTERVAL_MINUTES)
    
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            logger.info("Initiating scheduled API data refresh across connected platforms...")
            # Trigger non-blocking updates
            await asyncio.gather(
                youtube_service.get_trending(limit=5),
                instagram_service.get_recent_media(limit=5),
                facebook_service.get_page_feed(limit=5),
                x_service.search_tweets(query="cyber security India", limit=5),
                telegram_service.get_channel_broadcasts(limit=5),
                reddit_service.get_hot_submissions(subreddit="india", limit=5),
                news_service.get_top_headlines(category="technology", limit=5),
                return_exceptions=True
            )
            logger.info("Scheduled API refresh cycle successfully executed.")
        except asyncio.CancelledError:
            logger.info("Background refresh task cancelled.")
            break
        except Exception as e:
            logger.error("Error during background API refresh: %s", e)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database and Start Scheduler
    logger.info("Initializing Dhristi Multi-Platform Intelligence Backend v2.0.0")
    init_db()
    global background_refresh_task
    background_refresh_task = asyncio.create_task(periodic_data_refresh())
    yield
    # Shutdown: Cancel Background Task
    if background_refresh_task:
        background_refresh_task.cancel()
        try:
            await background_refresh_task
        except asyncio.CancelledError:
            pass
    logger.info("Backend service cleanly stopped.")

app = FastAPI(
    title="Dhristi AI Multi-Platform Intelligence API",
    description="Production-ready official API integration platform for YouTube, Instagram, Facebook, X, Reddit, and News sources.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Middleware (Frontend on port 3000, 5000, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Request Timing and Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    logger.info("%s %s -> HTTP %s (%sms)", request.method, request.url.path, response.status_code, duration_ms)
    response.headers["X-Response-Time-Ms"] = str(duration_ms)
    return response

# Global Exception Handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception processing %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "error_type": type(exc).__name__,
            "message": "Internal server processing error.",
            "path": request.url.path,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    )

# Root Service Info
@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "Dhristi AI Multi-Platform Intelligence API",
        "version": "2.0.0",
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "endpoints": [
            "/api/health",
            "/api/platforms",
            "/api/trending",
            "/api/content",
            "/api/analytics",
            "/api/state-pulse",
            "/api/narrative-intelligence",
            "/api/youtube/search",
            "/api/instagram/search",
            "/api/facebook/search",
            "/api/x/search",
            "/api/reddit/search",
            "/api/news/search"
        ]
    }

# Register Routers
app.include_router(health_router)
app.include_router(platforms_router)
app.include_router(platform_search_router)
app.include_router(trending_router)
app.include_router(content_router)
app.include_router(state_pulse_router)
app.include_router(narrative_intelligence_router)
app.include_router(analytics_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
