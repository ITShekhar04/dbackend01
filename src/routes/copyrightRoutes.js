/**
 * SocialPulse AI - Copyright Radar API Routes
 * Endpoints:
 *   GET  /api/copyright/radar?platform=:platform&itemId=:itemId&mode=:mode
 *   POST /api/copyright/scan
 */
const express = require('express');
const router = express.Router();
const { getCopyrightRadar } = require('../services/copyrightService');
const { getOAuthClient } = require('../services/googleAuth');

/**
 * Helper to resolve auth client if tokens exist in session or query
 */
function resolveAuth(req) {
  try {
    if (req.session && req.session.tokens) {
      const auth = getOAuthClient();
      auth.setCredentials(req.session.tokens);
      return auth;
    }
  } catch (err) {
    // Auth not available
  }
  return null;
}

/**
 * GET /api/copyright/radar
 * Fetches current copyright radar indicators for platform & item
 */
router.get('/radar', async (req, res) => {
  try {
    const platform = req.query.platform || 'youtube';
    const itemId = req.query.itemId || req.query.videoId;
    const mode = req.query.mode || 'demo';
    const auth = resolveAuth(req);

    const radarData = await getCopyrightRadar({ platform, itemId, auth, mode });
    return res.json(radarData);
  } catch (error) {
    console.error('[CopyrightRoute] Error resolving copyright radar:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process copyright radar analysis',
      error: error.message
    });
  }
});

/**
 * POST /api/copyright/scan
 * Initiates an active scan of content telemetry & returns evaluated signals
 */
router.post('/scan', async (req, res) => {
  try {
    const { platform = 'youtube', itemId, mode = 'demo' } = req.body;
    const auth = resolveAuth(req);

    const radarData = await getCopyrightRadar({ platform, itemId, auth, mode });
    return res.json({
      ...radarData,
      scanStatus: 'completed',
      scannedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CopyrightRoute] Error executing copyright scan:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to complete copyright scan',
      error: error.message
    });
  }
});

/**
 * POST /api/copyright/provenance/register
 * Section 12 & 13: Multi-modal content fingerprint registration into blockchain ledger
 */
const {
  generateMultiModalFingerprints,
  registerContentProvenance,
  evaluateContentSimilarity,
  getProvenanceChain
} = require('../services/provenanceService');

router.post('/provenance/register', async (req, res) => {
  try {
    const { content } = req.body;
    const result = await registerContentProvenance(content || {
      id: req.body.id || 'vid-3',
      title: req.body.title || '5 Productivity Hacks',
      duration: req.body.duration || '05:00',
      creatorId: req.body.creatorId || 'alexvance_tech'
    });
    return res.json(result);
  } catch (error) {
    console.error('[CopyrightRoute] Error registering provenance:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/copyright/provenance/chain
 * Section 13: View tamper-evident blockchain ledger
 */
router.get('/provenance/chain', async (req, res) => {
  try {
    const contentId = req.query.contentId;
    const chain = await getProvenanceChain(contentId);
    return res.json({
      status: 'success',
      totalBlocks: chain.length,
      ledgerNotice: 'Blockchain stores tamper-evident ownership & registration history. It is NOT an automatic copyright detector.',
      chain
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/copyright/provenance/similarity/:id
 * Section 12: View potential matches breakdown (High, Medium, Low)
 */
router.get('/provenance/similarity/:id', async (req, res) => {
  try {
    const similarityReport = evaluateContentSimilarity({ id: req.params.id });
    return res.json(similarityReport);
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;

