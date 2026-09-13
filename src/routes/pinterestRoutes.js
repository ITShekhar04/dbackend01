/**
 * Pinterest API Routes (/api/pinterest/*)
 */
const express = require('express');
const router = express.Router();
const pinterestService = require('../services/pinterestService');
const MOCK_DATA = require('../utils/mockFallback');

/**
 * GET /api/pinterest/auth
 * Initiates Pinterest OAuth v5 flow
 */
router.get('/auth', (req, res) => {
  const url = pinterestService.getPinterestAuthUrl();
  if (req.query.format === 'json') {
    return res.json({ authUrl: url });
  }
  res.redirect(url);
});

/**
 * GET /api/pinterest/auth/callback
 * Handles Pinterest OAuth redirect
 */
router.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.status(400).json({ error: error || 'Missing authorization code' });
  }

  try {
    const tokenData = await pinterestService.exchangePinterestCode(code);
    res.json({
      message: 'Pinterest token received successfully.',
      tokenData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pinterest/overview
 * Returns Pinterest profile & board metrics
 */
router.get('/overview', async (req, res) => {
  try {
    const data = await pinterestService.getPinterestOverview();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: MOCK_DATA.pinterest.overview });
  }
});

/**
 * GET /api/pinterest/pins
 * Returns list of Pins
 */
router.get('/pins', async (req, res) => {
  try {
    const data = await pinterestService.getPinterestPins();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pinterest/pins/:id
 * Returns single Pin detail
 */
router.get('/pins/:id', async (req, res) => {
  try {
    const data = await pinterestService.getPinterestPinById(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
