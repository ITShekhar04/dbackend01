/**
 * Creator Channel Profile Route (/api/channel)
 */
const express = require('express');
const router = express.Router();
const googleAuth = require('../services/googleAuth');
const youtubeData = require('../services/youtubeData');
const config = require('../config');
const MOCK_DATA = require('../utils/mockFallback');

/**
 * GET /api/channel
 * Returns creator profile matching data.js: { name, handle, subscribers, totalViews, avatarLetter }
 */
router.get('/', async (req, res) => {
  try {
    const auth = await googleAuth.getAuthenticatedClient();

    if (!auth) {
      if (config.useMockFallbackIfUnauthenticated) {
        return res.json({
          _source: 'demo_fallback (Authenticate via /auth/google for live data)',
          ...MOCK_DATA.creator
        });
      }
      return res.status(401).json({
        error: 'Not authenticated',
        authUrl: '/auth/google'
      });
    }

    const profile = await youtubeData.getChannelProfile(auth);

    // Return exact data contract
    res.json({
      _source: 'live_youtube_api',
      name: profile.name,
      handle: profile.handle,
      subscribers: profile.subscribers,
      totalViews: profile.totalViews,
      avatarLetter: profile.avatarLetter,
      avatarUrl: profile.avatarUrl
    });
  } catch (err) {
    console.error('Error in /api/channel:', err);
    if (config.useMockFallbackIfUnauthenticated) {
      return res.json({
        _source: 'demo_fallback_on_error',
        _error: err.message,
        ...MOCK_DATA.creator
      });
    }
    res.status(500).json({ error: 'Failed to fetch channel profile', message: err.message });
  }
});

module.exports = router;
