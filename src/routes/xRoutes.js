/**
 * X (formerly Twitter) API Routes (/api/x/*)
 */
const express = require('express');
const router = express.Router();
const xService = require('../services/xService');
const MOCK_DATA = require('../utils/mockFallback');

/**
 * GET /api/x/auth
 * Initiates X OAuth 2.0 PKCE flow
 */
router.get('/auth', (req, res) => {
  const url = xService.getXAuthUrl();
  if (req.query.format === 'json') {
    return res.json({ authUrl: url });
  }
  res.redirect(url);
});

/**
 * GET /api/x/auth/callback
 * Handles X OAuth redirect
 */
router.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.status(400).json({ error: error || 'Missing authorization code' });
  }

  try {
    const tokenData = await xService.exchangeXCode(code);
    res.json({
      message: 'X token received successfully.',
      tokenData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/x/overview
 * Returns X profile & tweet metrics
 */
router.get('/overview', async (req, res) => {
  try {
    const data = await xService.getXOverview();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: MOCK_DATA.x.overview });
  }
});

/**
 * GET /api/x/posts
 * Returns list of X Posts / Tweets
 */
router.get('/posts', async (req, res) => {
  try {
    const data = await xService.getXPosts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/x/posts/:id
 * Returns single X Post detail
 */
router.get('/posts/:id', async (req, res) => {
  try {
    const data = await xService.getXPostById(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
