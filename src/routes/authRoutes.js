/**
 * Authentication Routes (/auth/*)
 */
const express = require('express');
const router = express.Router();
const googleAuth = require('../services/googleAuth');
const config = require('../config');

/**
 * GET /auth/google
 * Initiates the Google OAuth 2.0 flow
 */
router.get('/google', (req, res) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    return res.status(400).json({
      error: 'Google OAuth credentials not configured in .env',
      notice: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env'
    });
  }

  const authUrl = googleAuth.getAuthUrl();

  // If client wants JSON (e.g. from frontend fetch)
  if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
    return res.json({ authUrl });
  }

  // Otherwise, redirect to Google consent screen
  res.redirect(authUrl);
});

/**
 * GET /auth/google/callback
 * Handles OAuth 2.0 redirect, exchanges authorization code for tokens, and stores them in SQLite
 */
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; background: #0f172a; color: #f87171; padding: 40px; text-align: center;">
          <h2>Google Authentication Error</h2>
          <p>${error}</p>
          <a href="/" style="color: #38bdf8;">Return to Dashboard</a>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code in query.' });
  }

  try {
    const tokens = await googleAuth.exchangeCodeForTokens(code);

    const returnUrl = config.frontendOrigins[0] || 'http://localhost:3000';

    res.send(`
      <html>
        <head>
          <title>SocialPulse AI - Authentication Successful</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #161f30; border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 16px; padding: 40px; max-width: 520px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
            h1 { color: #00f2fe; margin-top: 0; font-size: 1.6rem; }
            p { color: #94a3b8; line-height: 1.6; }
            .badge { background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 0.85rem; display: inline-block; margin-bottom: 20px; }
            .btn-group { display: flex; gap: 12px; justify-content: center; margin-top: 25px; flex-wrap: wrap; }
            .btn { display: inline-block; background: linear-gradient(135deg, #00f2fe, #4facfe); color: #000; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; }
            .btn-secondary { display: inline-block; background: rgba(255,255,255,0.08); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.15); font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">CONNECTED &bull; TOKENS PERSISTED</div>
            <h1>Google Account Connected!</h1>
            <p>Your YouTube Channel & YouTube Analytics authorization has been securely stored in SQLite. Live API endpoints are now active.</p>
            <div class="btn-group">
              <a href="${returnUrl}" class="btn">Return to Dashboard</a>
              <a href="/api/channel" class="btn-secondary">View Profile JSON</a>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Failed to exchange authorization code:', err);
    res.status(500).json({ error: 'Token exchange failed', message: err.message });
  }
});

/**
 * GET /auth/status
 * Returns current authentication status
 */
router.get('/status', async (req, res) => {
  try {
    const authenticated = await googleAuth.isAuthenticated();
    res.json({
      authenticated,
      mode: authenticated ? 'live_youtube_api' : (config.useMockFallbackIfUnauthenticated ? 'demo_fallback_active' : 'unauthenticated'),
      scopesConfigured: config.google.scopes,
      clientIdConfigured: !!config.google.clientId,
      youtube: {
        connected: authenticated,
        configured: !!config.google.clientId
      },
      instagram: {
        connected: !!config.instagram.accessToken,
        configured: !!(config.instagram.appId && config.instagram.appSecret)
      },
      pinterest: {
        connected: !!config.pinterest.accessToken,
        configured: !!(config.pinterest.clientId && config.pinterest.clientSecret)
      },
      x: {
        connected: !!(config.x.bearerToken || config.x.accessToken),
        configured: !!((config.x.apiKey && config.x.apiSecret) || (config.x.clientId && config.x.clientSecret) || config.x.bearerToken)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/logout
 * Revokes and deletes stored tokens
 */
router.post('/logout', async (req, res) => {
  try {
    await googleAuth.logout();
    res.json({ message: 'Successfully logged out and revoked stored tokens.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
