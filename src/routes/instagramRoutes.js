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

module.exports = router;
