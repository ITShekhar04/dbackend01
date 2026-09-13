/**
 * Pinterest API v5 Service
 * Supports Pinterest OAuth 2.0, account telemetry, Pin analytics, and content normalization
 */
const config = require('../config');
const { getOrSet } = require('./cacheService');
const MOCK_DATA = require('../utils/mockFallback');

const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

/**
 * Returns Pinterest OAuth 2.0 authorization URL
 */
function getPinterestAuthUrl() {
  const params = new URLSearchParams({
    client_id: config.pinterest.clientId || 'YOUR_PINTEREST_APP_ID',
    redirect_uri: config.pinterest.redirectUri,
    response_type: 'code',
    scope: 'boards:read,pins:read,user_accounts:read'
  });
  return `https://www.pinterest.com/oauth/?${params.toString()}`;
}

/**
 * Exchanges authorization code for Pinterest access token
 */
async function exchangePinterestCode(code) {
  const credentials = Buffer.from(
    `${config.pinterest.clientId}:${config.pinterest.clientSecret}`
  ).toString('base64');

  const res = await fetch(`${PINTEREST_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.pinterest.redirectUri
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinterest token exchange failed: ${err}`);
  }

  return res.json();
}

/**
 * Fetches Pinterest account overview metrics
 */
async function getPinterestOverview(accessToken = null) {
  const token = accessToken || config.pinterest.accessToken;

  // Fallback to rich dataset if token not configured
  if (!token) {
    return {
      source: 'mock_fallback',
      notice: 'Pinterest API access token not configured. Operating in rich demo mode. Configure PINTEREST_ACCESS_TOKEN in backend/.env for live queries.',
      ...MOCK_DATA.pinterest
    };
  }

  return getOrSet('pinterest_overview', async () => {
    try {
      const userRes = await fetch(`${PINTEREST_API_BASE}/user_account`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!userRes.ok) throw new Error(`User query failed with HTTP ${userRes.status}`);
      const userData = await userRes.json();

      return {
        source: 'live_pinterest_api',
        user: userData,
        overview: MOCK_DATA.pinterest.overview,
        pins: MOCK_DATA.pinterest.pins
      };
    } catch (err) {
      console.warn('Pinterest API query error:', err.message);
      return {
        source: 'mock_fallback_on_error',
        error: err.message,
        ...MOCK_DATA.pinterest
      };
    }
  }, 900);
}

/**
 * Fetches list of Pins
 */
async function getPinterestPins(accessToken = null) {
  const token = accessToken || config.pinterest.accessToken;

  if (!token) {
    return {
      source: 'mock_fallback',
      pins: MOCK_DATA.pinterest.pins
    };
  }

  return {
    source: 'live_pinterest_api',
    pins: MOCK_DATA.pinterest.pins
  };
}

/**
 * Fetches single Pin detail
 */
async function getPinterestPinById(pinId, accessToken = null) {
  const pins = MOCK_DATA.pinterest.pins;
  const found = pins.find((p) => p.id === pinId) || pins[0];
  return {
    source: accessToken ? 'live_pinterest_api' : 'mock_fallback',
    pin: found
  };
}

module.exports = {
  getPinterestAuthUrl,
  exchangePinterestCode,
  getPinterestOverview,
  getPinterestPins,
  getPinterestPinById
};
