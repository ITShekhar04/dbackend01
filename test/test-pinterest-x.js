/**
 * Test Pinterest & X (Twitter) integration, normalization, and endpoints
 */
const http = require('http');
const app = require('../src/server');
const normalizationService = require('../src/services/normalizationService');

let server;
const PORT = 5098;

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
  console.log('🧪 RUNNING PINTEREST & X INTEGRATION & NORMALIZATION TESTS');
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
    // 1. Auth Status check - Pinterest & X present
    const authRes = await request('/auth/status');
    assert(authRes.status === 200, 'GET /auth/status returns 200');
    assert(authRes.data.pinterest !== undefined, 'Pinterest is present in auth status');
    assert(authRes.data.x !== undefined, 'X is present in auth status');

    // 2. Pinterest Overview
    const pinOverview = await request('/api/pinterest/overview');
    assert(pinOverview.status === 200, 'GET /api/pinterest/overview returns 200');
    assert(pinOverview.data.overview !== undefined, 'Pinterest overview object exists');
    assert(pinOverview.data.overview.totalImpressions === '2.4M', 'Pinterest totalImpressions matches mockFallback');

    // 3. Pinterest Pins
    const pinList = await request('/api/pinterest/pins');
    assert(pinList.status === 200, 'GET /api/pinterest/pins returns 200');
    assert(Array.isArray(pinList.data.pins), 'Pinterest pins is an array');
    assert(pinList.data.pins.length >= 3, 'Pinterest has at least 3 pins');

    // 4. Pinterest Pin Detail
    const pinId = pinList.data.pins[0].id;
    const pinDetail = await request(`/api/pinterest/pins/${pinId}`);
    assert(pinDetail.status === 200, `GET /api/pinterest/pins/${pinId} returns 200`);
    assert(pinDetail.data.pin.pinClicks !== undefined, 'Pin has pinClicks metric');
    assert(pinDetail.data.pin.copyrightRadar !== undefined, 'Pin has copyrightRadar transparency object');

    // 5. X Overview
    const xOverview = await request('/api/x/overview');
    assert(xOverview.status === 200, 'GET /api/x/overview returns 200');
    assert(xOverview.data.overview !== undefined, 'X overview object exists');
    assert(xOverview.data.overview.totalImpressions === '3.8M', 'X totalImpressions matches mockFallback');

    // 6. X Posts
    const xPosts = await request('/api/x/posts');
    assert(xPosts.status === 200, 'GET /api/x/posts returns 200');
    assert(Array.isArray(xPosts.data.posts), 'X posts is an array');
    assert(xPosts.data.posts.length >= 3, 'X has at least 3 posts');

    // 7. X Post Detail
    const postId = xPosts.data.posts[0].id;
    const postDetail = await request(`/api/x/posts/${postId}`);
    assert(postDetail.status === 200, `GET /api/x/posts/${postId} returns 200`);
    assert(postDetail.data.post.reposts !== undefined, 'Post has reposts metric');
    assert(postDetail.data.post.copyrightRadar !== undefined, 'Post has copyrightRadar transparency object');

    // 8. Normalization Service Direct Unit Tests
    const normalizedPin = normalizationService.normalizePinterestPin(pinList.data.pins[0]);
    assert(normalizedPin.platform === 'pinterest', 'Normalization sets platform to pinterest');
    assert(normalizedPin.retentionCurve === 'Not available', 'Normalization marks video retention as Not available for pin');
    assert(normalizedPin.duration === 'Not available (Static / Image Pin)', 'Normalization handles pin duration honesty');

    const normalizedPost = normalizationService.normalizeXPost(xPosts.data.posts[0]);
    assert(normalizedPost.platform === 'x', 'Normalization sets platform to x');
    assert(normalizedPost.retentionCurve === 'Not available', 'Normalization marks video retention as Not available for post');

    // 9. Multi-Platform AI Insights endpoint
    const pinInsights = await request('/api/insights', {
      method: 'POST',
      body: { platform: 'pinterest', itemId: pinId }
    });
    assert(pinInsights.status === 200, 'POST /api/insights for Pinterest returns 200');
    assert(Array.isArray(pinInsights.data.insights), 'Pinterest insights returns array');
    assert(pinInsights.data.insights.length >= 3, 'Pinterest has at least 3 intelligence cards');

    const xInsights = await request('/api/insights', {
      method: 'POST',
      body: { platform: 'x', itemId: postId }
    });
    assert(xInsights.status === 200, 'POST /api/insights for X returns 200');
    assert(Array.isArray(xInsights.data.insights), 'X insights returns array');
    assert(xInsights.data.insights.length >= 3, 'X has at least 3 intelligence cards');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log('\n============================================================');
    console.log(`📊 PINTEREST & X TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');
    if (server) server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

server = app.listen(PORT, () => {
  runTests();
});
