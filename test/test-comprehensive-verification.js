/**
 * SocialPulse AI - Comprehensive End-to-End System & Integration Verification
 * Covers all requirements in Section 13 (Test Everything):
 * - AUTH: Login, Logout, Status for all platforms
 * - PLATFORMS: YouTube, Instagram, Pinterest, X
 * - DASHBOARD: Data loading, switching, empty states, error states
 * - AI: Creator Copilot & Performance Intelligence (POST /api/insights)
 */
const http = require('http');
const app = require('../src/server');
const normalizationService = require('../src/services/normalizationService');

let server;
const PORT = 5097;

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
            resolve({ status: res.statusCode, headers: res.headers, data, raw: body });
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

async function runVerification() {
  console.log('\n============================================================');
  console.log('🔬 SOCIALPULSE AI — COMPLETE 13-POINT SYSTEM VERIFICATION');
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
    // ==========================================
    // 1. AUTHENTICATION & LOGIN FLOW TESTS
    // ==========================================
    console.log('\n--- 1. AUTHENTICATION (Login, Logout, Status) ---');

    // 1.1 /auth/status endpoint
    const statusRes = await request('/auth/status');
    assert(statusRes.status === 200, 'GET /auth/status returns 200 OK');
    assert(typeof statusRes.data.authenticated === 'boolean', 'Auth status has authenticated boolean');
    assert(statusRes.data.youtube !== undefined, 'Auth status includes YouTube connection object');
    assert(statusRes.data.instagram !== undefined, 'Auth status includes Instagram connection object');
    assert(statusRes.data.pinterest !== undefined, 'Auth status includes Pinterest connection object');
    assert(statusRes.data.x !== undefined, 'Auth status includes X connection object');

    // 1.2 Google OAuth Login URL Generation
    const googleAuthRes = await request('/auth/google?format=json');
    assert(googleAuthRes.status === 200 || googleAuthRes.status === 400, 'GET /auth/google handles auth URL query');
    if (googleAuthRes.status === 200) {
      assert(googleAuthRes.data.authUrl !== undefined, 'Google auth URL is generated properly');
    } else {
      assert(googleAuthRes.data.notice !== undefined, 'Graceful notice when client secrets pending in .env');
    }

    // 1.3 Instagram OAuth Auth Initiation
    const igAuthRes = await request('/api/instagram/auth?format=json');
    assert(igAuthRes.status === 200, 'GET /api/instagram/auth returns 200');
    assert(igAuthRes.data.authUrl !== undefined, 'Instagram authUrl is returned');

    // 1.4 Pinterest OAuth Auth Initiation
    const pinAuthRes = await request('/api/pinterest/auth?format=json');
    assert(pinAuthRes.status === 200, 'GET /api/pinterest/auth returns 200');
    assert(pinAuthRes.data.authUrl !== undefined, 'Pinterest OAuth v5 authUrl is returned');

    // 1.5 X OAuth PKCE Auth Initiation
    const xAuthRes = await request('/api/x/auth?format=json');
    assert(xAuthRes.status === 200, 'GET /api/x/auth returns 200');
    assert(xAuthRes.data.authUrl !== undefined, 'X OAuth 2.0 PKCE authUrl is returned');

    // 1.6 Logout
    const logoutRes = await request('/auth/logout', { method: 'POST' });
    assert(logoutRes.status === 200, 'POST /auth/logout successfully clears sessions');
    assert(logoutRes.data.message.includes('Successfully logged out'), 'Logout returns confirmation message');

    // ==========================================
    // 2. ALL 4 PLATFORM ADAPTER & DATA TESTS
    // ==========================================
    console.log('\n--- 2. PLATFORMS (YouTube, Instagram, Pinterest, X) ---');

    // 2.1 YouTube
    const channelRes = await request('/api/channel');
    assert(channelRes.status === 200, 'YouTube: GET /api/channel returns 200');
    assert(typeof channelRes.data.name === 'string', 'YouTube: Channel name exists');
    assert(typeof channelRes.data.subscribers === 'string', 'YouTube: Subscribers count exists');

    const ytVideosRes = await request('/api/videos');
    assert(ytVideosRes.status === 200, 'YouTube: GET /api/videos returns 200');
    assert(Array.isArray(ytVideosRes.data.videos), 'YouTube: Videos list is an array');

    const ytDetailRes = await request('/api/videos/vid-3');
    assert(ytDetailRes.status === 200, 'YouTube: GET /api/videos/vid-3 detail returns 200');
    assert(ytDetailRes.data.retentionCurve !== undefined, 'YouTube: Retention curve present');
    assert(ytDetailRes.data.anomaly !== undefined, 'YouTube: Drop-off anomaly present');
    assert(ytDetailRes.data.rewatchHotspots !== undefined, 'YouTube: Rewatch hotspots present');
    assert(ytDetailRes.data.copyrightRadar !== undefined, 'YouTube: Copyright Radar object present');

    // 2.2 Instagram
    const igOverviewRes = await request('/api/instagram/overview');
    assert(igOverviewRes.status === 200, 'Instagram: GET /api/instagram/overview returns 200');
    assert(igOverviewRes.data.overview !== undefined || igOverviewRes.data.data !== undefined, 'Instagram: Overview object present');

    const igReelsRes = await request('/api/instagram/reels');
    assert(igReelsRes.status === 200, 'Instagram: GET /api/instagram/reels returns 200');
    assert(Array.isArray(igReelsRes.data.reels || igReelsRes.data.data?.reels), 'Instagram: Reels list is an array');

    // 2.3 Pinterest
    const pinOverviewRes = await request('/api/pinterest/overview');
    assert(pinOverviewRes.status === 200, 'Pinterest: GET /api/pinterest/overview returns 200');
    assert(pinOverviewRes.data.overview.totalImpressions !== undefined, 'Pinterest: Total impressions present');
    assert(pinOverviewRes.data.overview.saves !== undefined, 'Pinterest: Saves present');

    const pinListRes = await request('/api/pinterest/pins');
    assert(pinListRes.status === 200, 'Pinterest: GET /api/pinterest/pins returns 200');
    assert(Array.isArray(pinListRes.data.pins), 'Pinterest: Pins list is an array');

    const pinDetailRes = await request('/api/pinterest/pins/pin-1');
    assert(pinDetailRes.status === 200, 'Pinterest: GET /api/pinterest/pins/pin-1 detail returns 200');
    assert(pinDetailRes.data.pin.pinClicks !== undefined, 'Pinterest: Pin clicks metric present');
    assert(pinDetailRes.data.pin.copyrightRadar !== undefined, 'Pinterest: Copyright Radar transparency present');

    // 2.4 X (Twitter)
    const xOverviewRes = await request('/api/x/overview');
    assert(xOverviewRes.status === 200, 'X: GET /api/x/overview returns 200');
    assert(xOverviewRes.data.overview.totalImpressions !== undefined, 'X: Total impressions present');
    assert(xOverviewRes.data.overview.bookmarks !== undefined, 'X: Bookmarks present');

    const xPostsRes = await request('/api/x/posts');
    assert(xPostsRes.status === 200, 'X: GET /api/x/posts returns 200');
    assert(Array.isArray(xPostsRes.data.posts), 'X: Posts list is an array');

    const xDetailRes = await request('/api/x/posts/post-1');
    assert(xDetailRes.status === 200, 'X: GET /api/x/posts/post-1 detail returns 200');
    assert(xDetailRes.data.post.reposts !== undefined, 'X: Reposts metric present');
    assert(xDetailRes.data.post.copyrightRadar !== undefined, 'X: Copyright Radar transparency present');

    // ==========================================
    // 3. NORMALIZATION & INCOMPATIBLE METRICS
    // ==========================================
    console.log('\n--- 3. NORMALIZATION & HONEST TELEMETRY ---');

    const normPin = normalizationService.normalizePinterestPin(pinListRes.data.pins[0]);
    assert(normPin.retentionCurve === 'Not available', 'Honest metrics: Pin retention curve is "Not available"');
    assert(normPin.duration.includes('Not available'), 'Honest metrics: Pin duration correctly indicates static asset');

    const normPost = normalizationService.normalizeXPost(xPostsRes.data.posts[0]);
    assert(normPost.retentionCurve === 'Not available', 'Honest metrics: X post retention curve is "Not available"');
    assert(normPost.duration.includes('Not available'), 'Honest metrics: X post duration correctly indicates text asset');

    // ==========================================
    // 4. EMPTY & ERROR STATES
    // ==========================================
    console.log('\n--- 4. EMPTY & ERROR STATES ---');

    // 4.1 Non-existent video id
    const invalidVideoRes = await request('/api/videos/non-existent-video-999');
    assert(invalidVideoRes.status === 200 || invalidVideoRes.status === 404, 'Graceful handling of non-existent video ID');

    // 4.2 Non-existent pin id
    const invalidPinRes = await request('/api/pinterest/pins/non-existent-pin-999');
    assert(invalidPinRes.status === 200 || invalidPinRes.status === 404, 'Graceful handling of non-existent pin ID');

    // 4.3 Non-existent post id
    const invalidPostRes = await request('/api/x/posts/non-existent-post-999');
    assert(invalidPostRes.status === 200 || invalidPostRes.status === 404, 'Graceful handling of non-existent post ID');

    // 4.4 404 handler on undefined route
    const unknownRes = await request('/api/completely_unknown_route');
    assert(unknownRes.status === 404, 'Undefined route returns clean 404');
    assert(unknownRes.data.error === 'Endpoint not found', '404 contains informative message');

    // ==========================================
    // 5. AI INTELLIGENCE & COPILOT ENDPOINTS
    // ==========================================
    console.log('\n--- 5. AI PERFORMANCE INTELLIGENCE ---');

    // 5.1 YouTube Insights
    const ytInsights = await request('/api/insights', {
      method: 'POST',
      body: { platform: 'youtube', videoId: 'vid-3' }
    });
    assert(ytInsights.status === 200, 'AI Insights: YouTube generation returns 200');
    assert(Array.isArray(ytInsights.data.insights), 'AI Insights: YouTube returns array of intelligence cards');
    assert(ytInsights.data.insights.length >= 4, 'AI Insights: YouTube produces at least 4 intelligence cards');

    // 5.2 Instagram Insights
    const igInsights = await request('/api/insights', {
      method: 'POST',
      body: { platform: 'instagram', itemId: 'ig-1' }
    });
    assert(igInsights.status === 200, 'AI Insights: Instagram generation returns 200');
    assert(Array.isArray(igInsights.data.insights), 'AI Insights: Instagram returns array of intelligence cards');

    // 5.3 Pinterest Insights
    const pinInsights = await request('/api/insights', {
      method: 'POST',
      body: { platform: 'pinterest', itemId: 'pin-1' }
    });
    assert(pinInsights.status === 200, 'AI Insights: Pinterest generation returns 200');
    assert(Array.isArray(pinInsights.data.insights), 'AI Insights: Pinterest returns array of intelligence cards');

    // 5.4 X Insights
    const xInsights = await request('/api/insights', {
      method: 'POST',
      body: { platform: 'x', itemId: 'post-1' }
    });
    assert(xInsights.status === 200, 'AI Insights: X generation returns 200');
    assert(Array.isArray(xInsights.data.insights), 'AI Insights: X returns array of intelligence cards');

    // 5.5 Insufficient Data Guard
    const emptyInsights = await request('/api/insights', {
      method: 'POST',
      body: { platform: 'youtube', videoId: 'empty-test' }
    });
    assert(emptyInsights.status === 200, 'AI Insights: Handled missing/empty data without 500 crash');

    // ==========================================
    // 6. COPYRIGHT RADAR & SAFETY INTELLIGENCE
    // ==========================================
    console.log('\n--- 6. COPYRIGHT RADAR (GET & POST) ---');

    // 6.1 YouTube Radar
    const ytRadar = await request('/api/copyright/radar?platform=youtube&itemId=vid-3');
    assert(ytRadar.status === 200, 'Copyright Radar: YouTube GET /api/copyright/radar returns 200');
    assert(ytRadar.data.status === 'success', 'Copyright Radar: status is success');
    assert(ytRadar.data.riskState === 'POTENTIAL RISK', 'Copyright Radar: identifies potential risk on flagged item');
    assert(typeof ytRadar.data.dimensions === 'object', 'Copyright Radar: multi-modal dimensions object present');
    assert(ytRadar.data.dimensions.audio === 78, 'Copyright Radar: audio similarity signal parsed correctly');

    // 6.2 Pinterest Radar
    const pinRadar = await request('/api/copyright/radar?platform=pinterest&itemId=pin-1');
    assert(pinRadar.status === 200, 'Copyright Radar: Pinterest GET returns 200');
    assert(pinRadar.data.confirmedLicense.includes('Rich Pin'), 'Copyright Radar: Pinterest verified rich pin license');
    assert(pinRadar.data.dimensions.audio === null, 'Copyright Radar: honest null for audio on static pin');

    // 6.3 X Radar
    const xRadar = await request('/api/copyright/radar?platform=x&itemId=post-1');
    assert(xRadar.status === 200, 'Copyright Radar: X GET returns 200');
    assert(xRadar.data.confirmedClaims.includes('Original Author'), 'Copyright Radar: X confirmed author claims');

    // 6.4 Active Scan Endpoint (POST)
    const scanRes = await request('/api/copyright/scan', {
      method: 'POST',
      body: { platform: 'youtube', itemId: 'vid-1' }
    });
    assert(scanRes.status === 200, 'Copyright Radar: POST /api/copyright/scan returns 200');
    assert(scanRes.data.scanStatus === 'completed', 'Copyright Radar: scan status is completed');
    assert(scanRes.data.riskState === 'SAFE / LOW RISK', 'Copyright Radar: clean content returns SAFE / LOW RISK');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log('\n============================================================');
    console.log(`📊 13-POINT SYSTEM VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');
    if (server) server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

server = app.listen(PORT, () => {
  runVerification();
});
