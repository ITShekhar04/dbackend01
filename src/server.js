/**
 * SocialPulse AI Backend Service - Server Entry Point
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

// Import routes
const authRoutes = require('./routes/authRoutes');
const channelRoutes = require('./routes/channelRoutes');
const videoRoutes = require('./routes/videoRoutes');
const insightRoutes = require('./routes/insightRoutes');
const instagramRoutes = require('./routes/instagramRoutes');
const pinterestRoutes = require('./routes/pinterestRoutes');
const xRoutes = require('./routes/xRoutes');
const copyrightRoutes = require('./routes/copyrightRoutes');
const governmentRoutes = require('./routes/governmentRoutes');

const app = express();

// 1. CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (config.frontendOrigins.includes(origin) || config.frontendOrigins.includes('*')) {
      return callback(null, true);
    }
    // Allow localhost/127.0.0.1 on any port in development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev to avoid friction
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// 3. API Routes
app.use('/auth', authRoutes);
app.use('/api/channel', channelRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/pinterest', pinterestRoutes);
app.use('/api/x', xRoutes);
app.use('/api/copyright', copyrightRoutes);
app.use('/api/gov', governmentRoutes);

// Forward Multi-Platform REST Endpoints to FastAPI service (Port 8000)
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const MULTI_PLATFORM_ROUTES = [
  '/api/health',
  '/api/platforms',
  '/api/trending',
  '/api/content',
  '/api/analytics',
  '/api/state-pulse',
  '/api/narrative-intelligence',
  '/api/youtube/search',
  '/api/instagram/search',
  '/api/facebook/search',
  '/api/x/search',
  '/api/reddit/search',
  '/api/news/search'
];

MULTI_PLATFORM_ROUTES.forEach(routePath => {
  app.get(routePath, async (req, res, next) => {
    try {
      const targetUrl = new URL(req.originalUrl, FASTAPI_URL);
      const upstream = await fetch(targetUrl.toString());
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (err) {
      next();
    }
  });
});

// Static Frontend Delivery for seamless development and testing
app.use('/sih', express.static(path.resolve(__dirname, '../../sih')));
app.use('/assets', express.static(path.resolve(__dirname, '../../forntend/assets')));

// 4. Interactive API Dashboard & Documentation at Root (/)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dhristi AI - API Explorer</title>
      <style>
        :root {
          --bg: #07090e;
          --surface: #0f172a;
          --border: rgba(0, 242, 254, 0.18);
          --cyan: #00f2fe;
          --text: #e2e8f0;
          --text-muted: #94a3b8;
          --green: #10b981;
          --rose: #f43f5e;
          --purple: #8b5cf6;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: var(--bg);
          color: var(--text);
          margin: 0;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
        }
        .container {
          max-width: 900px;
          width: 100%;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 30px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 20px;
        }
        .brand {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, var(--cyan), #3b82f6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .status-badge {
          background: rgba(16, 185, 129, 0.15);
          color: var(--green);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }
        h2 {
          font-size: 1.15rem;
          color: var(--cyan);
          margin-top: 0;
          margin-bottom: 16px;
        }
        .endpoint-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          margin-bottom: 8px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          border-left: 3px solid var(--cyan);
          transition: background 0.2s;
        }
        .endpoint-row:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .method {
          font-weight: 700;
          font-size: 0.75rem;
          padding: 3px 8px;
          border-radius: 4px;
          margin-right: 12px;
        }
        .get { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
        .post { background: rgba(16, 185, 129, 0.2); color: #34d399; }
        .path {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9rem;
          color: #f1f5f9;
        }
        .desc {
          color: var(--text-muted);
          font-size: 0.85rem;
          flex: 1;
          margin-left: 16px;
        }
        a.test-btn {
          background: rgba(0, 242, 254, 0.12);
          color: var(--cyan);
          border: 1px solid rgba(0, 242, 254, 0.25);
          text-decoration: none;
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        a.test-btn:hover {
          background: rgba(0, 242, 254, 0.25);
        }
        .auth-btn {
          display: inline-block;
          background: linear-gradient(135deg, #00f2fe, #3b82f6);
          color: #000;
          text-decoration: none;
          font-weight: 700;
          padding: 10px 20px;
          border-radius: 8px;
          margin-top: 10px;
        }
        pre {
          background: #020617;
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.82rem;
          color: #cbd5e1;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="brand" style="display: flex; align-items: center; gap: 10px;">
            <img src="/assets/dhristi-logo.jpg" alt="Dhristi Logo" style="width: 32px; height: 32px; object-fit: cover; border-radius: 8px; border: 1px solid var(--cyan); box-shadow: 0 0 10px rgba(0, 242, 254, 0.4);">
            <span>Dhristi AI &bull; Backend Service</span>
          </div>
          <div class="status-badge">&bull; Service Online (Port ${config.port})</div>
        </div>

        <div class="card">
          <h2>Google OAuth 2.0 Authentication</h2>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 15px;">
            Authorize Dhristi AI with your YouTube Channel and YouTube Analytics to pull live creator data.
          </p>
          <a href="/auth/google" class="auth-btn">Connect Google Account (/auth/google)</a>
          <span style="margin-left: 15px; font-size: 0.85rem; color: var(--text-muted);">
            Check status: <a href="/auth/status" style="color: var(--cyan);">/auth/status</a>
          </span>
        </div>

        <div class="card">
          <h2>YouTube Data & Analytics Endpoints</h2>

          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/channel</span></div>
            <div class="desc">Creator profile: name, handle, subscriber count, total views</div>
            <a href="/api/channel" target="_blank" class="test-btn">Test in Browser</a>
          </div>

          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/videos</span></div>
            <div class="desc">List of creator videos formatted to Dhristi data contract</div>
            <a href="/api/videos" target="_blank" class="test-btn">Test in Browser</a>
          </div>

          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/videos/vid-3</span></div>
            <div class="desc">Detailed video analytics (retention curve, anomaly, rewatch hotspots)</div>
            <a href="/api/videos/vid-3" target="_blank" class="test-btn">Test in Browser</a>
          </div>

          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/videos/vid-3/comments</span></div>
            <div class="desc">VADER-scored comments, sentiment breakdown, trending topics</div>
            <a href="/api/videos/vid-3/comments" target="_blank" class="test-btn">Test in Browser</a>
          </div>

          <div class="endpoint-row">
            <div><span class="method post">POST</span><span class="path">/api/insights</span></div>
            <div class="desc">Grounded AI intelligence cards based on real video metrics</div>
            <span style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">Body: {"videoId":"vid-3"}</span>
          </div>
        </div>

        <div class="card">
          <h2>Instagram Graph API Endpoints (Stretch Goal)</h2>

          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/instagram/overview</span></div>
            <div class="desc">Instagram cross-tab metrics & audience overview</div>
            <a href="/api/instagram/overview" target="_blank" class="test-btn">Test in Browser</a>
          </div>

          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/instagram/reels</span></div>
            <div class="desc">Instagram Reels performance and hook metrics</div>
            <a href="/api/instagram/reels" target="_blank" class="test-btn">Test in Browser</a>
          </div>
        </div>

        <div class="card">
          <h2>Government Intelligence Command Center (Pravaah / प्रवाह)</h2>
          <div class="endpoint-row">
            <div><span class="method post">POST</span><span class="path">/api/gov/auth/login</span></div>
            <div class="desc">Step 1: Validate credentials and issue 2FA challenge token</div>
            <span style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">Body: {"email","token"}</span>
          </div>
          <div class="endpoint-row">
            <div><span class="method post">POST</span><span class="path">/api/gov/auth/verify-2fa</span></div>
            <div class="desc">Step 2: Verify 6-digit OTP and generate timed bearer session</div>
            <span style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">Body: {"challengeToken","otp"}</span>
          </div>
          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/gov/trends/viral</span></div>
            <div class="desc">Viral Content Intelligence with cross-platform velocity & Section 18 labels</div>
            <span class="status-badge" style="background: rgba(0,242,254,0.1); color: var(--cyan); border-color: rgba(0,242,254,0.3);">Auth Required</span>
          </div>
          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/gov/narratives</span></div>
            <div class="desc">Narrative Intelligence & Section 21 Anti-Suppression Safeguards</div>
            <span class="status-badge" style="background: rgba(0,242,254,0.1); color: var(--cyan); border-color: rgba(0,242,254,0.3);">Auth Required</span>
          </div>
          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/gov/state-pulse?state=Madhya%20Pradesh</span></div>
            <div class="desc">State Pulse India regional telemetry and district drilldown</div>
            <span class="status-badge" style="background: rgba(0,242,254,0.1); color: var(--cyan); border-color: rgba(0,242,254,0.3);">Auth Required</span>
          </div>
          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/gov/transparency-report</span></div>
            <div class="desc">Section 21.4 Administrator Transparency & Zero-Takedown Audit</div>
            <span class="status-badge" style="background: rgba(139,92,246,0.15); color: var(--purple); border-color: rgba(139,92,246,0.3);">Admin Clearance</span>
          </div>
          <div class="endpoint-row">
            <div><span class="method get">GET</span><span class="path">/api/copyright/provenance/chain</span></div>
            <div class="desc">Creator Multi-Modal Fingerprint Blockchain Ledger (Sections 12 & 13)</div>
            <a href="/api/copyright/provenance/chain" target="_blank" class="test-btn">Test in Browser</a>
          </div>
        </div>

        <div class="card">
          <h2>Quick Verification Cheat Sheet (curl)</h2>
          <pre># Check Authentication & Fallback Mode
curl http://localhost:${config.port}/auth/status

# Test Creator Profile
curl http://localhost:${config.port}/api/channel

# Test Video Listing
curl http://localhost:${config.port}/api/videos

# Test Video Detail (Retention curve, rewatch hotspots, anomaly)
curl http://localhost:${config.port}/api/videos/vid-3

# Test Comment Sentiment Intelligence
curl http://localhost:${config.port}/api/videos/vid-3/comments

# Test Grounded AI Insights
curl -X POST -H "Content-Type: application/json" -d "{\\"videoId\\":\\"vid-3\\"}" http://localhost:${config.port}/api/insights

# Test Provenance Blockchain Ledger
curl http://localhost:${config.port}/api/copyright/provenance/chain

# Authenticate Gov Analyst
curl -X POST -H "Content-Type: application/json" -d "{\\"email\\":\\"analyst@socialpulse.gov\\",\\"token\\":\\"SP-SEC-9942-0XF1A7\\"}" http://localhost:${config.port}/api/gov/auth/login</pre>
        </div>
      </div>
    </body>
    </html>
  `);
});

// 5. 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    requestedUrl: req.originalUrl,
    availableEndpoints: [
      'GET /auth/google',
      'GET /auth/status',
      'GET /api/channel',
      'GET /api/videos',
      'GET /api/videos/:id',
      'GET /api/videos/:id/comments',
      'POST /api/insights',
      'GET /api/instagram/overview',
      'GET /api/instagram/reels',
      'GET /api/pinterest/overview',
      'GET /api/pinterest/pins',
      'GET /api/x/overview',
      'GET /api/x/posts',
      'GET /api/copyright/radar',
      'POST /api/copyright/scan',
      'POST /api/copyright/provenance/register',
      'GET /api/copyright/provenance/chain',
      'GET /api/copyright/provenance/similarity/:id',
      'POST /api/gov/auth/login',
      'POST /api/gov/auth/verify-2fa',
      'POST /api/gov/auth/logout',
      'GET /api/gov/auth/session',
      'GET /api/gov/audit-logs',
      'GET /api/gov/transparency-report',
      'GET /api/gov/trends/viral',
      'GET /api/gov/trends/:id/ai-signal',
      'GET /api/gov/trends/:id/similarity-radar',
      'GET /api/gov/clusters',
      'GET /api/gov/trends/:id/propagation',
      'GET /api/gov/coordination-radar',
      'GET /api/gov/narratives',
      'POST /api/gov/narratives/:id/action',
      'GET /api/gov/public-impact',
      'GET /api/gov/state-pulse',
      'GET /api/gov/content-filtration',
      'GET /api/gov/alerts',
      'GET /api/gov/platform-matrix'
    ]
  });
});

// 6. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start Server
if (require.main === module) {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`
============================================================
🚀 DHRISTI AI BACKEND SERVICE RUNNING
============================================================
📡 URL: http://localhost:${config.port}
🔗 Google OAuth Start: http://localhost:${config.port}/auth/google
📊 Channel Profile:    http://localhost:${config.port}/api/channel
🎬 Videos API:         http://localhost:${config.port}/api/videos
💡 AI Insights:        http://localhost:${config.port}/api/insights
📸 Instagram API:      http://localhost:${config.port}/api/instagram/overview
============================================================
    `);
  });
}

module.exports = app;
