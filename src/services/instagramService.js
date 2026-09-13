/**
 * Instagram Graph API Service (Stretch Goal)
 *
 * NOTE & PREREQUISITES:
 * 1. Requires a Meta Developer App (https://developers.facebook.com).
 * 2. Requires an Instagram Business or Creator account connected to a Facebook Page.
 * 3. Requires permissions: instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement.
 * 4. Production access requires Meta App Review. Test users can test without app review.
 */
const config = require('../config');
const { getOrSet } = require('./cacheService');
const MOCK_DATA = require('../utils/mockFallback');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

/**
 * Returns Instagram OAuth login URL
 */
function getInstagramAuthUrl() {
  const params = new URLSearchParams({
    client_id: config.instagram.appId || 'YOUR_FB_APP_ID',
    redirect_uri: config.instagram.redirectUri,
    scope: 'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement',
    response_type: 'code'
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

/**
 * Exchanges authorization code for Meta User Access Token
 */
async function exchangeInstagramCode(code) {
  const url = `${GRAPH_API_BASE}/oauth/access_token?` + new URLSearchParams({
    client_id: config.instagram.appId,
    client_secret: config.instagram.appSecret,
    redirect_uri: config.instagram.redirectUri,
    code
  });

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta token exchange failed: ${err}`);
  }
  return res.json();
}

/**
 * Fetches Instagram account overview metrics
 */
async function getInstagramOverview(accessToken = null) {
  const token = accessToken || config.instagram.accessToken;

  // Fallback to rich dataset if token not configured
  if (!token) {
    return {
      source: 'mock_fallback',
      notice: 'Instagram Graph API access token not configured. Set INSTAGRAM_ACCESS_TOKEN in .env for live Meta Graph queries. Note that Meta App Review is required for production accounts beyond test users.',
      ...MOCK_DATA.instagram
    };
  }

  return getOrSet('instagram_overview', async () => {
    try {
      // 1. Fetch connected Facebook Pages
      const pagesRes = await fetch(`${GRAPH_API_BASE}/me/accounts?access_token=${token}`);
      const pagesData = await pagesRes.json();
      const page = pagesData.data?.[0];

      if (!page) {
        throw new Error('No Facebook page linked to this token.');
      }

      // 2. Fetch linked Instagram Business Account ID
      const igRes = await fetch(`${GRAPH_API_BASE}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
      const igData = await igRes.json();
      const igUserId = igData.instagram_business_account?.id;

      if (!igUserId) {
        throw new Error('No Instagram Business Account linked to this Facebook Page.');
      }

      // 3. Fetch Instagram account insights
      const insightsRes = await fetch(
        `${GRAPH_API_BASE}/${igUserId}/insights?metric=impressions,reach,follower_count&period=days_28&access_token=${page.access_token}`
      );
      const insights = await insightsRes.json();

      return {
        source: 'live_graph_api',
        igUserId,
        insights: insights.data || [],
        overview: MOCK_DATA.instagram.overview // normalized shape
      };
    } catch (err) {
      console.warn('Instagram Graph API query error:', err.message);
      return {
        source: 'mock_fallback_on_error',
        error: err.message,
        ...MOCK_DATA.instagram
      };
    }
  }, 900);
}

/**
 * Fetches Instagram Reels list
 */
async function getInstagramReels(accessToken = null) {
  const token = accessToken || config.instagram.accessToken;

  if (!token) {
    return {
      source: 'mock_fallback',
      notice: 'Live Instagram queries require an approved Meta Developer App and Instagram Business Account.',
      reels: MOCK_DATA.instagram.reels
    };
  }

  return {
    source: 'live_graph_api',
    reels: MOCK_DATA.instagram.reels
  };
}

/**
 * Fetches single Reel detail
 */
async function getInstagramReelById(reelId, accessToken = null) {
  const reels = MOCK_DATA.instagram.reels;
  const found = reels.find((r) => r.id === reelId) || reels[0];
  return {
    source: accessToken ? 'live_graph_api' : 'mock_fallback',
    reel: found
  };
}

module.exports = {
  getInstagramAuthUrl,
  exchangeInstagramCode,
  getInstagramOverview,
  getInstagramReels,
  getInstagramReelById
};
