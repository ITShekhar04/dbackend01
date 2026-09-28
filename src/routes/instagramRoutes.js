/**
 * Instagram Graph API Routes (/api/instagram/*) - Stretch Goal
 */
const express = require('express');
const router = express.Router();
const instagramService = require('../services/instagramService');
const MOCK_DATA = require('../utils/mockFallback');

/**
 * GET /api/instagram/auth
 * Initiates Meta OAuth flow
 */
router.get('/auth', (req, res) => {
  const url = instagramService.getInstagramAuthUrl();
  if (req.query.format === 'json') {
    return res.json({ authUrl: url });
  }
  res.redirect(url);
});

/**
 * GET /api/instagram/auth/callback
 * Handles Meta OAuth redirect
 */
router.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.status(400).json({ error: error || 'Missing authorization code' });
  }

  try {
    const tokenData = await instagramService.exchangeInstagramCode(code);
    res.json({
      message: 'Instagram token received successfully. Note: Production usage requires Meta App Review.',
      tokenData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/instagram/overview
 * Returns Instagram profile & cross-tab overview matching data.js
 */
router.get('/overview', async (req, res) => {
  try {
    const data = await instagramService.getInstagramOverview();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: MOCK_DATA.instagram.overview });
  }
});

/**
 * GET /api/instagram/reels
 * Returns list of reels matching data.js
 */
router.get('/reels', async (req, res) => {
  try {
    const data = await instagramService.getInstagramReels();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/instagram/reels/:id
 * Returns single reel detail
 */
router.get('/reels/:id', async (req, res) => {
  try {
    const data = await instagramService.getInstagramReelById(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/instagram/status
 * Validates Meta Graph API token validity and connection status
 */
router.get('/status', async (req, res) => {
  const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
  try {
    const upstream = await fetch(`${FASTAPI_URL}/api/instagram/status`);
    if (upstream.ok) {
      const data = await upstream.json();
      return res.json(data);
    }
  } catch (e) {}
  const hasToken = Boolean(config.instagram && config.instagram.accessToken);
  return res.json({
    configured: hasToken,
    status: hasToken ? 'connected' : 'unconfigured',
    platform: 'instagram',
    api_type: 'Instagram Graph API (Meta)',
    api_version: 'v19.0',
    data_mode: hasToken ? 'OFFICIAL API' : 'DEMO DATA',
    message: hasToken ? 'Instagram token configured.' : 'Instagram Access Token not configured. Please set INSTAGRAM_ACCESS_TOKEN in .env.'
  });
});

/**
 * GET /api/instagram/search
 */
router.get('/search', async (req, res) => {
  const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
  try {
    const targetUrl = new URL('/api/instagram/search', FASTAPI_URL);
    if (req.query.query) targetUrl.searchParams.append('query', req.query.query);
    if (req.query.limit) targetUrl.searchParams.append('limit', req.query.limit);
    const upstream = await fetch(targetUrl.toString());
    if (upstream.ok) {
      const data = await upstream.json();
      return res.json(data);
    }
  } catch (e) {}
  return res.json({ total: MOCK_DATA.instagram.reels.length, data_mode: 'DEMO DATA', items: MOCK_DATA.instagram.reels });
});

/**
 * GET /api/instagram/hashtag/:hashtag
 */
router.get('/hashtag/:hashtag', async (req, res) => {
  const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
  try {
    const targetUrl = new URL(`/api/instagram/hashtag/${encodeURIComponent(req.params.hashtag)}`, FASTAPI_URL);
    if (req.query.limit) targetUrl.searchParams.append('limit', req.query.limit);
    const upstream = await fetch(targetUrl.toString());
    if (upstream.ok) {
      const data = await upstream.json();
      return res.json(data);
    }
  } catch (e) {}
  return res.json({ total: 1, data_mode: 'DEMO DATA', items: MOCK_DATA.instagram.reels });
});

/**
 * GET /api/instagram/trends
 */
router.get('/trends', async (req, res) => {
  const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
  try {
    const targetUrl = new URL('/api/instagram/trends', FASTAPI_URL);
    if (req.query.limit) targetUrl.searchParams.append('limit', req.query.limit);
    const upstream = await fetch(targetUrl.toString());
    if (upstream.ok) {
      const data = await upstream.json();
      return res.json(data);
    }
  } catch (e) {}
  return res.json({
    total: 5,
    platform: 'instagram',
    trends: [
      { hashtag: '#CyberSecurityIndia', post_count: 1420, total_engagement: 48200, avg_sentiment: 0.45 },
      { hashtag: '#DigitalArrestScam', post_count: 1150, total_engagement: 38900, avg_sentiment: -0.72 },
      { hashtag: '#SafeDigitalIndia', post_count: 940, total_engagement: 29800, avg_sentiment: 0.58 },
      { hashtag: '#CyberDost', post_count: 860, total_engagement: 24100, avg_sentiment: 0.70 },
      { hashtag: '#OnlineFraudAwareness', post_count: 690, total_engagement: 18300, avg_sentiment: -0.38 }
    ]
  });
});

module.exports = router;
