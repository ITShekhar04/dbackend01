# Dhristi AI — Creator Analytics Backend Service

A high-performance Node.js & Express backend for **Dhristi AI**. It interfaces directly with the **YouTube Data API v3** and **YouTube Analytics API v2** (with an **Instagram Graph API** stretch architecture) to fetch, normalize, and serve creator analytics in the **exact JSON data contract** expected by the frontend dashboard.

---

## Table of Contents
1. [Tech Stack & Justification](#tech-stack--justification)
2. [Honest Constraints & API Boundaries](#honest-constraints--api-boundaries)
3. [Quick Start Guide](#quick-start-guide)
4. [Google Cloud Console Setup (Step-by-Step)](#google-cloud-console-setup-step-by-step)
5. [Data Contract & Normalization](#data-contract--normalization)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [AI Insights Engine](#ai-insights-engine)
8. [Quota & Caching Strategy](#quota--caching-strategy)
9. [Instagram Graph API (Stretch Goal)](#instagram-graph-api-stretch-goal)
10. [Automated Verification](#automated-verification)

---

## Tech Stack & Justification

- **Runtime**: Node.js v20+ (CommonJS)
- **Framework**: Express.js
- **Google SDK**: `googleapis` (Official Google APIs Client Library)
- **Database**: SQLite3 (`better-sqlite3` / `sqlite3`) for persistent OAuth2 refresh tokens and query caching
- **Sentiment Analysis**: `vader-sentiment` (fast, offline, rule-based NLP tuned specifically for social media punctuation, emojis, and sentiment intensity)
- **Caching**: `node-cache` with a 15-minute standard TTL to preserve YouTube's 10,000 units/day quota

### Why Node.js + Express?
1. **Frontend Parity & Zero Formatting Divergence**: The existing frontend in `sih/js/data.js` and `sih/js/app.js` is pure JavaScript. Building the backend in Node.js guarantees 1:1 format alignment (e.g., `1,420,500`, `84.6K`, `1.9x`, `PT12M40S` &rarr; `12:40`) without cross-language formatting disparities.
2. **Official Google Client**: `googleapis` is actively maintained by Google, providing first-class token refresh handling (`oauth2Client.on('tokens', ...)`).
3. **Turnkey Setup**: Zero virtualenv or native C++ compilation hurdles on Windows.

---

## Honest Constraints & API Boundaries

The backend implements real API calls where supported and transparently handles public API limitations:

| Feature | Real Data vs. Placeholder | Implementation Detail |
| :--- | :--- | :--- |
| **Channel Profile** | **100% Real API** | `youtube.channels.list({ part: ['snippet', 'statistics'], mine: true })` |
| **Video Catalog** | **100% Real API** | Uploads playlist &rarr; `playlistItems.list` &rarr; `videos.list` batch query |
| **Retention Curves** | **100% Real API** | `youtubeAnalytics.reports.query` with `dimensions=elapsedVideoTimeRatio` & `metrics=audienceWatchRatio`. Requires channel ownership OAuth. |
| **Rewatch Hotspots** | **100% Real Algorithm** | Derived programmatically by calculating local maxima in relative retention (`relativeRetentionPerformance`) and segments where replay ratio $> 1.0$. |
| **Audience Drop Anomaly** | **100% Real Algorithm** | Calculated by finding the steepest negative delta ($> 8\%$) between adjacent retention buckets. |
| **Audience Segments** | **Documented Approximation** | The YouTube Analytics API does not categorize viewers into "loyal/casual". We query `dimensions=subscribedStatus` (`SUBSCRIBED` vs `UNSUBSCRIBED`) and approximate: Subscribed &rarr; Loyal (60%) + Returning (40%); Unsubscribed &rarr; Casual (65%) + One-Time (35%). |
| **Copyright Radar** | **Labeled Limitation** | **No public API exists.** YouTube Content ID similarity matching is proprietary to the YouTube CMS Partner Portal and is not exposed in public Data or Analytics APIs. The backend returns an explicit status object (`status: "Restricted to Content ID Partners"`, `similarityScore: null`, `riskLevel: "N/A"`). |
| **Comment Sentiment** | **100% Real NLP** | Scored using `vader-sentiment`. Trending topics are extracted via frequency analysis (with stopword filtering) and audience requests are detected via pattern matching. |
| **AI Insights** | **Grounded AI** | Generated via Google Gemini API (or OpenAI). Strictly prompted to use only real computed numbers with zero hallucination. Includes a deterministic rule-based fallback if no API key is provided. |

---

## Quick Start Guide

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Start the Server
```bash
# Production / standard mode
npm start

# Or with live auto-reload
npm run dev
```
The server will boot on `http://localhost:5000`.

> **Note on Demo Fallback**: Before you connect your Google Cloud account, `USE_MOCK_FALLBACK_IF_UNAUTHENTICATED=true` allows you to test every endpoint with `curl` or in the browser immediately. Once you authenticate via `/auth/google`, live YouTube API data takes over automatically.

---

## Google Cloud Console Setup (Step-by-Step)

To fetch live data from your real YouTube channel:

### Step 1: Create a Google Cloud Project
1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** &rarr; **New Project**.
3. Name it `SocialPulse-AI` and click **Create**.

### Step 2: Enable Required YouTube APIs
1. Go to **APIs & Services** &rarr; **Library**.
2. Search for and **Enable** each of the following:
   - **YouTube Data API v3**
   - **YouTube Analytics API**

### Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services** &rarr; **OAuth consent screen**.
2. Select **External** (or **Internal** if using Google Workspace).
3. Fill in App Name (`SocialPulse AI`) and User support email.
4. Under **Scopes**, click **Add or Remove Scopes** and add:
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/yt-analytics.readonly`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Under **Test Users**, add your Google email address (the owner of the YouTube channel you want to test).

### Step 4: Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services** &rarr; **Credentials**.
2. Click **Create Credentials** &rarr; **OAuth client ID**.
3. Application Type: **Web application**.
4. Name: `SocialPulse Backend`.
5. **Authorized redirect URIs**:
   ```
   http://localhost:5000/auth/google/callback
   ```
6. Click **Create**. Copy the **Client ID** and **Client Secret**.

### Step 5: Update `.env`
Paste the keys into `backend/.env`:
```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
```

### Step 6: Authenticate
1. Open `http://localhost:5000/auth/google` in your browser.
2. Log in with your test Google account.
3. Upon consent, Google redirects to `/auth/google/callback`.
4. Refresh tokens are saved into `backend/data/socialpulse.db` (SQLite). Live channel and video data is now unlocked!

---

## API Endpoints Reference

### Interactive Web Explorer
Visit `http://localhost:5000` in your browser to view the interactive test interface.

### Endpoints Matrix

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/auth/google` | Starts Google OAuth consent flow |
| `GET` | `/auth/google/callback` | Exchanges code for tokens and stores in SQLite |
| `GET` | `/auth/status` | Checks if creator credentials are active |
| `POST`| `/auth/logout` | Revokes and purges stored OAuth tokens |
| `GET` | `/api/channel` | Creator profile (`name`, `handle`, `subscribers`, `totalViews`) |
| `GET` | `/api/videos` | List of channel videos in SocialPulse format |
| `GET` | `/api/videos/:id` | Full video analytics (`retentionCurve`, `anomaly`, `rewatchHotspots`, `comments`) |
| `GET` | `/api/videos/:id/comments`| Paginated comments with individual VADER sentiment scores |
| `POST`| `/api/insights` | Grounded AI intelligence cards based on real video metrics |
| `GET` | `/api/instagram/overview` | Instagram cross-tab metrics & audience overview |
| `GET` | `/api/instagram/reels` | Instagram Reels catalog with hook drop & replay rates |

---

## Verification via `curl`

```bash
# 1. Check Authentication Status
curl http://localhost:5000/auth/status

# 2. Fetch Creator Channel Profile
curl http://localhost:5000/api/channel

# 3. Fetch Videos Catalog
curl http://localhost:5000/api/videos

# 4. Fetch Full Video Detail (Retention Curve, Anomaly, Hotspots)
curl http://localhost:5000/api/videos/vid-3

# 5. Fetch Comments & Sentiment Breakdown
curl http://localhost:5000/api/videos/vid-3/comments

# 6. Request Grounded AI Insights
curl -X POST -H "Content-Type: application/json" \
  -d '{"videoId":"vid-3"}' \
  http://localhost:5000/api/insights
```

---

## Quota & Caching Strategy

The YouTube Data API assigns a default quota of **10,000 units/day**:
- `channels.list`: 1 unit
- `playlistItems.list`: 1 unit
- `videos.list`: 1 unit
- `commentThreads.list`: 1 unit
- `reports.query` (Analytics API): Tracked separately with generous query quotas

### Protection Measures:
1. **15-Minute Cache**: All video lists, analytics queries, and comment threads are cached in-memory with a 900-second TTL (`node-cache`).
2. **Channel Profile Cache**: Cached for 30 minutes.
3. **Batch Video Fetching**: Videos from playlist items are requested in a single batch `videos.list?id=id1,id2,id3` to consume only 1 quota unit instead of $N$ units.

---

## Instagram Graph API (Stretch Goal)

The stretch goal endpoints `/api/instagram/*` are implemented with fallback demo capabilities.

### Production Requirements for Live Meta Data:
1. **Meta Developer App**: Create an app on [developers.facebook.com](https://developers.facebook.com).
2. **Account Linking**: The Instagram account must be an **Instagram Professional account (Creator or Business)** and connected to a **Facebook Page**.
3. **Permissions Needed**:
   - `instagram_basic`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`
4. **Meta App Review**: For production access with accounts other than registered Test Users/Administrators, Meta App Review is mandatory.

---

## Automated Verification

Run the built-in contract compliance test suite:
```bash
npm test
```
This runs 71 assertions against the running API ensuring:
- 100% key and type match against `sih/js/data.js`
- Valid retention curve bucket serialization
- Accurate satisfaction score computation
- VADER sentiment scoring and AI insight structure
"# dbackend01" 
