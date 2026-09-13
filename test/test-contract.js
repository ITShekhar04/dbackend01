/**
 * SocialPulse AI Contract & Endpoint Validation Test
 * Validates backend endpoints and checks 100% compliance with data.js data contracts
 */
const http = require('http');
const app = require('../src/server');

let server;
const PORT = 5099;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:${PORT}${path}`,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = body ? JSON.parse(body) : null;
            resolve({ status: res.statusCode, headers: res.headers, data });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, raw: body });
          }
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING SOCIALPULSE AI CONTRACT COMPLIANCE TESTS');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Test /auth/status
    const authStatus = await request('/auth/status');
    assert(authStatus.status === 200, 'GET /auth/status returns 200');
    assert(typeof authStatus.data.authenticated === 'boolean', 'authStatus.authenticated is boolean');
    assert(authStatus.data.mode !== undefined, 'authStatus.mode is defined');

    // 2. Test /api/channel
    const channel = await request('/api/channel');
    assert(channel.status === 200, 'GET /api/channel returns 200');
    assert(typeof channel.data.name === 'string', 'channel.name is string');
    assert(typeof channel.data.handle === 'string', 'channel.handle is string');
    assert(typeof channel.data.subscribers === 'string', 'channel.subscribers is formatted string');
    assert(typeof channel.data.totalViews === 'string', 'channel.totalViews is formatted string');
    assert(typeof channel.data.avatarLetter === 'string', 'channel.avatarLetter is 2-character string');

    // 3. Test /api/videos
    const videosRes = await request('/api/videos');
    assert(videosRes.status === 200, 'GET /api/videos returns 200');
    assert(Array.isArray(videosRes.data.videos), 'videosRes.data.videos is an array');
    assert(videosRes.data.videos.length > 0, 'videosRes has at least 1 video');

    // 4. Test /api/videos/:id (Full Data Contract)
    const videoDetail = await request('/api/videos/vid-3');
    assert(videoDetail.status === 200, 'GET /api/videos/vid-3 returns 200');
    const v = videoDetail.data;

    assert(typeof v.id === 'string', 'video.id is string');
    assert(typeof v.title === 'string', 'video.title is string');
    assert(typeof v.duration === 'string', 'video.duration is string');
    assert(typeof v.views === 'string', 'video.views is formatted string');
    assert(typeof v.viewsNumeric === 'number', 'video.viewsNumeric is number');
    assert(typeof v.watchTimeHours === 'string', 'video.watchTimeHours is formatted string');
    assert(typeof v.engagementRate === 'string', 'video.engagementRate is percentage string');
    assert(typeof v.avgRetention === 'string', 'video.avgRetention is percentage string');
    assert(typeof v.completionRate === 'string', 'video.completionRate is percentage string');
    assert(typeof v.rewatchRate === 'string', 'video.rewatchRate is multiplier string');
    assert(typeof v.satisfactionScore === 'number', 'video.satisfactionScore is number');

    // Score Breakdown
    assert(typeof v.scoreBreakdown === 'object' && v.scoreBreakdown !== null, 'video.scoreBreakdown is object');
    assert(typeof v.scoreBreakdown.retention === 'number', 'scoreBreakdown.retention is number');
    assert(typeof v.scoreBreakdown.engagement === 'number', 'scoreBreakdown.engagement is number');
    assert(typeof v.scoreBreakdown.rewatch === 'number', 'scoreBreakdown.rewatch is number');
    assert(typeof v.scoreBreakdown.sentiment === 'number', 'scoreBreakdown.sentiment is number');

    // Retention Curve
    assert(Array.isArray(v.retentionCurve), 'video.retentionCurve is array');
    assert(v.retentionCurve.length > 0, 'video.retentionCurve has points');
    const firstPoint = v.retentionCurve[0];
    assert(typeof firstPoint.time === 'string', 'retention point time is string');
    assert(typeof firstPoint.seconds === 'number', 'retention point seconds is number');
    assert(typeof firstPoint.percent === 'number', 'retention point percent is number');

    // Anomaly Diagnosis
    if (v.anomaly) {
      assert(typeof v.anomaly.timestamp === 'string', 'anomaly.timestamp is string');
      assert(typeof v.anomaly.dropPercent === 'number', 'anomaly.dropPercent is number');
      assert(typeof v.anomaly.label === 'string', 'anomaly.label is string');
      assert(typeof v.anomaly.hypothesis === 'string', 'anomaly.hypothesis is string');
      assert(typeof v.anomaly.recommendedAction === 'string', 'anomaly.recommendedAction is string');
    }

    // Rewatch Hotspots
    assert(Array.isArray(v.rewatchHotspots), 'video.rewatchHotspots is array');
    if (v.rewatchHotspots.length > 0) {
      const h = v.rewatchHotspots[0];
      assert(typeof h.timestamp === 'string', 'rewatch hotspot timestamp is range string');
      assert(typeof h.multiplier === 'string', 'rewatch hotspot multiplier is multiplier string');
    }

    // Audience Segments
    assert(typeof v.audienceSegments === 'object', 'video.audienceSegments is object');
    assert(typeof v.audienceSegments.loyal === 'number', 'audienceSegments.loyal is number');
    assert(typeof v.audienceSegments.returning === 'number', 'audienceSegments.returning is number');
    assert(typeof v.audienceSegments.casual === 'number', 'audienceSegments.casual is number');
    assert(typeof v.audienceSegments.oneTime === 'number', 'audienceSegments.oneTime is number');

    // Comments Intelligence
    assert(typeof v.comments === 'object', 'video.comments is object');
    assert(typeof v.comments.positive === 'number', 'comments.positive is number');
    assert(typeof v.comments.neutral === 'number', 'comments.neutral is number');
    assert(typeof v.comments.negative === 'number', 'comments.negative is number');
    assert(typeof v.comments.totalCount === 'string', 'comments.totalCount is formatted string');
    assert(Array.isArray(v.comments.trendingTopics), 'comments.trendingTopics is array');
    assert(typeof v.comments.topAudienceRequest === 'string', 'comments.topAudienceRequest is string');

    // Copyright Radar
    assert(typeof v.copyrightRadar === 'object', 'video.copyrightRadar is object');
    assert(typeof v.copyrightRadar.status === 'string', 'copyrightRadar.status is string');
    assert(v.copyrightRadar.riskLevel !== undefined, 'copyrightRadar.riskLevel is present');

    // 5. Test /api/videos/:id/comments
    const commentsRes = await request('/api/videos/vid-3/comments');
    assert(commentsRes.status === 200, 'GET /api/videos/vid-3/comments returns 200');
    assert(Array.isArray(commentsRes.data.comments), 'comments list is array');

    // 6. Test POST /api/insights
    const insightsRes = await request('/api/insights', {
      method: 'POST',
      body: { videoId: 'vid-3' }
    });
    assert(insightsRes.status === 200, 'POST /api/insights returns 200');
    assert(Array.isArray(insightsRes.data.insights), 'insightsRes.data.insights is array');
    assert(insightsRes.data.insights.length >= 4, 'insights has at least 4 intelligence cards');
    const firstCard = insightsRes.data.insights[0];
    assert(typeof firstCard.icon === 'string', 'insight card icon is string');
    assert(typeof firstCard.title === 'string', 'insight card title is string');
    assert(typeof firstCard.whatHappened === 'string', 'insight card whatHappened is string');
    assert(typeof firstCard.whyItMatters === 'string', 'insight card whyItMatters is string');
    assert(typeof firstCard.recommendedAction === 'string', 'insight card recommendedAction is string');

    // 7. Test Instagram Stretch Endpoints
    const igOverview = await request('/api/instagram/overview');
    assert(igOverview.status === 200, 'GET /api/instagram/overview returns 200');
    assert(igOverview.data.overview !== undefined, 'igOverview.data.overview exists');

    const igReels = await request('/api/instagram/reels');
    assert(igReels.status === 200, 'GET /api/instagram/reels returns 200');
    assert(Array.isArray(igReels.data.reels), 'igReels.data.reels is array');

    console.log('\n============================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    if (server) server.close();
    process.exit(1);
  }
}

// Start test server on port 5099
server = app.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}...`);
  await runTests();
});
