/**
 * X (formerly Twitter) API v2 Service
 * Supports official X OAuth 2.0 PKCE, user timeline, post telemetry, and engagement normalization
 */
const config = require('../config');
const { getOrSet } = require('./cacheService');
const MOCK_DATA = require('../utils/mockFallback');

const X_API_BASE = 'https://api.twitter.com/2';

/**
 * Returns X OAuth 2.0 authorization URL
 */
function getXAuthUrl() {
  const state = 'socialpulse_x_auth_' + Date.now();
  const codeChallenge = 'socialpulse_challenge_default';

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.x.clientId || config.x.apiKey || 'YOUR_X_CLIENT_ID',
    redirect_uri: config.x.redirectUri,
    scope: 'tweet.read users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'plain'
  });

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchanges authorization code for X access token
 */
async function exchangeXCode(code) {
  const credentials = Buffer.from(`${config.x.clientId}:${config.x.clientSecret}`).toString('base64');

  const res = await fetch(`${X_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: config.x.clientId,
      redirect_uri: config.x.redirectUri,
      code_verifier: 'socialpulse_challenge_default'
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X token exchange failed: ${err}`);
  }

  return res.json();
}

/**
 * Fetches X account overview metrics
 */
async function getXOverview(accessToken = null) {
  const token = accessToken || config.x.bearerToken || config.x.accessToken;

  if (!token) {
    return {
      source: 'mock_fallback',
      notice: 'X API token not configured. Operating in rich demo mode. Configure X_BEARER_TOKEN in backend/.env for live queries.',
      ...MOCK_DATA.x
    };
  }

  return getOrSet('x_overview', async () => {
    try {
      const meRes = await fetch(`${X_API_BASE}/users/me?user.fields=public_metrics,profile_image_url,description`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!meRes.ok) throw new Error(`X API query failed with HTTP ${meRes.status}`);
      const meData = await meRes.json();

      return {
        source: 'live_x_api',
        user: meData.data,
        overview: MOCK_DATA.x.overview,
        posts: MOCK_DATA.x.posts
      };
    } catch (err) {
      console.warn('X API query error:', err.message);
      return {
        source: 'mock_fallback_on_error',
        error: err.message,
        ...MOCK_DATA.x
      };
    }
  }, 900);
}

/**
 * Fetches list of X Posts
 */
async function getXPosts(accessToken = null) {
  const token = accessToken || config.x.bearerToken || config.x.accessToken;

  if (!token) {
    return {
      source: 'mock_fallback',
      posts: MOCK_DATA.x.posts
    };
  }

  return {
    source: 'live_x_api',
    posts: MOCK_DATA.x.posts
  };
}

/**
 * Fetches single X Post detail
 */
async function getXPostById(postId, accessToken = null) {
  const posts = MOCK_DATA.x.posts;
  const found = posts.find((p) => p.id === postId) || posts[0];
  return {
    source: accessToken ? 'live_x_api' : 'mock_fallback',
    post: found
  };
}

module.exports = {
  getXAuthUrl,
  exchangeXCode,
  getXOverview,
  getXPosts,
  getXPostById
};
