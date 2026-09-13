/**
 * Video Analytics Routes (/api/videos/*)
 */
const express = require('express');
const router = express.Router();
const googleAuth = require('../services/googleAuth');
const youtubeData = require('../services/youtubeData');
const youtubeAnalytics = require('../services/youtubeAnalytics');
const analyticsProcessor = require('../services/analyticsProcessor');
const sentimentService = require('../services/sentimentService');
const config = require('../config');
const MOCK_DATA = require('../utils/mockFallback');
const { formatCommaNumber, formatPercent, formatMultiplier, formatCompactNumber } = require('../utils/formatters');

/**
 * GET /api/videos
 * Returns list of videos matching data contract
 */
router.get('/', async (req, res) => {
  try {
    const auth = await googleAuth.getAuthenticatedClient();

    if (!auth) {
      if (config.useMockFallbackIfUnauthenticated) {
        return res.json({
          _source: 'demo_fallback (Authenticate via /auth/google for live data)',
          videos: MOCK_DATA.videos
        });
      }
      return res.status(401).json({ error: 'Not authenticated', authUrl: '/auth/google' });
    }

    const videos = await youtubeData.getChannelVideos(auth, 20);

    res.json({
      _source: 'live_youtube_api',
      videos
    });
  } catch (err) {
    console.error('Error in GET /api/videos:', err);
    if (config.useMockFallbackIfUnauthenticated) {
      return res.json({
        _source: 'demo_fallback_on_error',
        _error: err.message,
        videos: MOCK_DATA.videos
      });
    }
    res.status(500).json({ error: 'Failed to fetch videos', message: err.message });
  }
});

/**
 * GET /api/videos/:id
 * Full detail for one video, including retentionCurve, rewatchHotspots, comments, audienceSegments
 */
router.get('/:id', async (req, res) => {
  const videoId = req.params.id;

  try {
    const auth = await googleAuth.getAuthenticatedClient();

    // Check if client is unauthenticated or requesting a mock ID
    if (!auth || videoId.startsWith('vid-')) {
      const mockVideo = MOCK_DATA.videos.find((v) => v.id === videoId) || MOCK_DATA.videos[0];
      if (config.useMockFallbackIfUnauthenticated || videoId.startsWith('vid-')) {
        return res.json({
          _source: auth ? 'demo_video_match' : 'demo_fallback',
          ...mockVideo
        });
      }
      return res.status(401).json({ error: 'Not authenticated', authUrl: '/auth/google' });
    }

    // --- LIVE YOUTUBE API FLOW ---
    // 1. Fetch video metadata
    const videoDetail = await youtubeData.getVideoDetailsById(auth, videoId);
    if (!videoDetail) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const durationSeconds = videoDetail.durationSeconds || 300;
    const publishedAt = videoDetail.publishedAt;

    // 2. Fetch analytics summary, retention curve, relative retention, and subscription breakdown in parallel
    const [analyticsSummary, rawRetentionRows, relativeRetentionRows, subscriptionRows, commentsResult] =
      await Promise.all([
        youtubeAnalytics.getVideoAnalyticsSummary(auth, videoId, publishedAt),
        youtubeAnalytics.getVideoRetentionCurve(auth, videoId, publishedAt),
        youtubeAnalytics.getVideoRelativeRetention(auth, videoId, publishedAt),
        youtubeAnalytics.getVideoSubscriptionBreakdown(auth, videoId, publishedAt),
        youtubeData.getCommentsForVideo(auth, videoId, 100)
      ]);

    // 3. Process retention curve and detect drop anomaly
    const { curve, anomalyPoint, maxDrop } = analyticsProcessor.processRetentionCurve(
      rawRetentionRows,
      durationSeconds
    );
    const anomaly = analyticsProcessor.buildAnomalyDiagnosis(anomalyPoint, maxDrop, videoDetail.title);

    // 4. Derive rewatch hotspots from relative retention
    const rewatchHotspots = analyticsProcessor.deriveRewatchHotspots(
      relativeRetentionRows.length > 0 ? relativeRetentionRows : rawRetentionRows,
      durationSeconds
    );

    // 5. Approximate audience segments
    const audienceSegments = analyticsProcessor.approximateAudienceSegments(subscriptionRows);

    // 6. Analyze comment sentiment & topics
    const commentsIntelligence = sentimentService.analyzeComments(
      commentsResult.comments,
      videoDetail.commentsCount
    );

    // 7. Calculate metrics and satisfaction score
    const avgRetentionPct = analyticsSummary ? parseFloat(analyticsSummary.averageViewPercentage) : 62.5;
    const viewsNumeric = videoDetail.viewsNumeric;
    const estimatedMinutesWatched = analyticsSummary ? analyticsSummary.estimatedMinutesWatched : (viewsNumeric * durationSeconds * 0.5) / 60;
    const watchTimeHours = Math.round(estimatedMinutesWatched / 60);
    const engagementRatePct = viewsNumeric > 0 ? ((videoDetail.likes + videoDetail.commentsCount) / viewsNumeric) * 100 : 8.5;
    const rewatchMultiplierNum = rewatchHotspots.length > 0 ? parseFloat(rewatchHotspots[0].multiplier) : 1.8;

    const { satisfactionScore, scoreBreakdown } = analyticsProcessor.calculateSatisfactionScore(
      avgRetentionPct,
      engagementRatePct,
      rewatchMultiplierNum,
      commentsIntelligence.positive
    );

    // 8. Construct response matching EXACT data contract
    const responsePayload = {
      _source: 'live_youtube_api',
      id: videoDetail.id,
      title: videoDetail.title,
      duration: videoDetail.duration,
      views: videoDetail.views,
      viewsNumeric: videoDetail.viewsNumeric,
      watchTimeHours: formatCompactNumber(watchTimeHours),
      engagementRate: formatPercent(engagementRatePct),
      avgRetention: formatPercent(avgRetentionPct),
      completionRate: curve.length > 0 ? formatPercent(curve[curve.length - 1].percent) : '35.0%',
      rewatchRate: formatMultiplier(rewatchMultiplierNum),
      satisfactionScore,
      scoreBreakdown,
      tag: videoDetail.tag,
      badge: anomaly ? 'Drop-Off Anomaly' : 'High Retention',
      retentionCurve: curve,
      anomaly,
      rewatchHotspots,
      audienceSegments,
      comments: commentsIntelligence,
      copyrightRadar: analyticsProcessor.createCopyrightRadarPlaceholder()
    };

    res.json(responsePayload);
  } catch (err) {
    console.error(`Error in GET /api/videos/${videoId}:`, err);
    if (config.useMockFallbackIfUnauthenticated) {
      const fallback = MOCK_DATA.videos.find((v) => v.id === videoId) || MOCK_DATA.videos[0];
      return res.json({
        _source: 'demo_fallback_on_error',
        _error: err.message,
        ...fallback
      });
    }
    res.status(500).json({ error: 'Failed to fetch video detail', message: err.message });
  }
});

/**
 * GET /api/videos/:id/comments
 * Returns paginated raw comments with sentiment scoring + aggregate sentiment
 */
router.get('/:id/comments', async (req, res) => {
  const videoId = req.params.id;
  const pageToken = req.query.pageToken || null;
  const limit = parseInt(req.query.limit, 10) || 50;

  try {
    const auth = await googleAuth.getAuthenticatedClient();

    if (!auth || videoId.startsWith('vid-')) {
      // Mock / fallback comments
      const mockVideo = MOCK_DATA.videos.find((v) => v.id === videoId) || MOCK_DATA.videos[0];
      const sampleComments = [
        { id: 'c-1', author: 'DevExplorer', text: 'This was by far the best explanation of the topic! Loved it.', likeCount: 42, publishedAt: '2026-03-01T10:00:00Z', sentiment: { label: 'positive', compound: 0.85 } },
        { id: 'c-2', author: 'CodeNewbie', text: 'Can you please make a Part 2 covering advanced patterns?', likeCount: 88, publishedAt: '2026-03-02T12:30:00Z', sentiment: { label: 'positive', compound: 0.62 } },
        { id: 'c-3', author: 'AlexM', text: 'Pacing was a bit slow in the middle around 03:10, but good summary at the end.', likeCount: 15, publishedAt: '2026-03-03T15:00:00Z', sentiment: { label: 'neutral', compound: 0.02 } },
        { id: 'c-4', author: 'TechFan', text: 'Where can I find the source code link?', likeCount: 9, publishedAt: '2026-03-04T08:15:00Z', sentiment: { label: 'neutral', compound: 0.0 } },
        { id: 'c-5', author: 'ReviewerZ', text: 'Audio volume was slightly inconsistent.', likeCount: 3, publishedAt: '2026-03-05T19:00:00Z', sentiment: { label: 'negative', compound: -0.34 } }
      ];

      return res.json({
        _source: 'demo_fallback',
        videoId,
        summary: mockVideo.comments,
        comments: sampleComments,
        nextPageToken: null,
        totalCount: sampleComments.length
      });
    }

    // Live comments flow
    const commentsData = await youtubeData.getCommentsForVideo(auth, videoId, limit, pageToken);

    // Score each individual comment
    const scoredComments = commentsData.comments.map((c) => {
      const score = sentimentService.scoreComment(c.text);
      return {
        id: c.id,
        author: c.author,
        authorProfileImageUrl: c.authorProfileImageUrl,
        text: c.text,
        likeCount: c.likeCount,
        publishedAt: c.publishedAt,
        sentiment: score
      };
    });

    const summary = sentimentService.analyzeComments(commentsData.comments, commentsData.totalReplyCount);

    res.json({
      _source: 'live_youtube_api',
      videoId,
      summary,
      comments: scoredComments,
      nextPageToken: commentsData.nextPageToken,
      totalCount: commentsData.comments.length
    });
  } catch (err) {
    console.error(`Error in /api/videos/${videoId}/comments:`, err);
    res.status(500).json({ error: 'Failed to fetch comments', message: err.message });
  }
});

module.exports = router;
