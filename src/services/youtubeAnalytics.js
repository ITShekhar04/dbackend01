/**
 * YouTube Analytics API v2 Service
 * Queries owner-authenticated analytics reports (retention curves, watch time, subscribers)
 */
const { google } = require('googleapis');
const { getOrSet } = require('./cacheService');

function getAnalyticsClient(auth) {
  return google.youtubeAnalytics({ version: 'v2', auth });
}

function getSafeStartDate(publishedAt) {
  const today = getSafeEndDate();
  if (publishedAt) {
    const d = new Date(publishedAt);
    if (!isNaN(d.getTime())) {
      const pubDate = d.toISOString().split('T')[0];
      if (pubDate <= today) {
        return pubDate;
      }
    }
  }
  // Default to 2 years ago if publish date not available
  const fallback = new Date();
  fallback.setFullYear(fallback.getFullYear() - 2);
  return fallback.toISOString().split('T')[0];
}

function getSafeEndDate() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

/**
 * Fetches high-level metrics for a video (views, watch time, avg retention percentage)
 */
async function getVideoAnalyticsSummary(auth, videoId, publishedAt) {
  const cacheKey = `yt_analytics_summary_${videoId}`;

  return getOrSet(cacheKey, async () => {
    const analytics = getAnalyticsClient(auth);
    const startDate = getSafeStartDate(publishedAt);
    const endDate = getSafeEndDate();

    try {
      const res = await analytics.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained',
        filters: `video==${videoId}`
      });

      const rows = res.data.rows;
      if (!rows || rows.length === 0) {
        return null;
      }

      const row = rows[0];
      const headers = (res.data.columnHeaders || []).map((h) => h.name);
      const getVal = (name, fallback = 0) => {
        const idx = headers.indexOf(name);
        return idx !== -1 && row[idx] !== undefined ? row[idx] : fallback;
      };

      return {
        views: getVal('views'),
        estimatedMinutesWatched: getVal('estimatedMinutesWatched'),
        averageViewDuration: getVal('averageViewDuration'),
        averageViewPercentage: getVal('averageViewPercentage'),
        subscribersGained: getVal('subscribersGained')
      };
    } catch (err) {
      console.warn(`Analytics summary query error for video ${videoId}:`, err.message);
      return null;
    }
  }, 900); // 15 min cache
}

/**
 * Fetches granular retention curve for a video
 * Returns 100 buckets: [elapsedVideoTimeRatio, audienceWatchRatio]
 */
async function getVideoRetentionCurve(auth, videoId, publishedAt) {
  const cacheKey = `yt_analytics_retention_${videoId}`;

  return getOrSet(cacheKey, async () => {
    const analytics = getAnalyticsClient(auth);
    const startDate = getSafeStartDate(publishedAt);
    const endDate = getSafeEndDate();

    try {
      const res = await analytics.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        dimensions: 'elapsedVideoTimeRatio',
        metrics: 'audienceWatchRatio',
        filters: `video==${videoId}`
      });

      return res.data.rows || [];
    } catch (err) {
      console.warn(`Retention curve query error for video ${videoId}:`, err.message);
      return [];
    }
  }, 900);
}

/**
 * Fetches relative retention performance (performance relative to videos of same length)
 * Used to derive rewatch spikes and local maxima
 */
async function getVideoRelativeRetention(auth, videoId, publishedAt) {
  const cacheKey = `yt_analytics_rel_retention_${videoId}`;

  return getOrSet(cacheKey, async () => {
    const analytics = getAnalyticsClient(auth);
    const startDate = getSafeStartDate(publishedAt);
    const endDate = getSafeEndDate();

    try {
      const res = await analytics.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        dimensions: 'elapsedVideoTimeRatio',
        metrics: 'relativeRetentionPerformance',
        filters: `video==${videoId}`
      });

      return res.data.rows || [];
    } catch (err) {
      console.warn(`Relative retention query error for video ${videoId}:`, err.message);
      return [];
    }
  }, 900);
}

/**
 * Fetches views segmented by subscribed vs unsubscribed status
 */
async function getVideoSubscriptionBreakdown(auth, videoId, publishedAt) {
  const cacheKey = `yt_analytics_sub_breakdown_${videoId}`;

  return getOrSet(cacheKey, async () => {
    const analytics = getAnalyticsClient(auth);
    const startDate = getSafeStartDate(publishedAt);
    const endDate = getSafeEndDate();

    try {
      const res = await analytics.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        dimensions: 'subscribedStatus',
        metrics: 'views',
        filters: `video==${videoId}`
      });

      return res.data.rows || [];
    } catch (err) {
      console.warn(`Subscription breakdown query error for video ${videoId}:`, err.message);
      return [];
    }
  }, 900);
}

module.exports = {
  getVideoAnalyticsSummary,
  getVideoRetentionCurve,
  getVideoRelativeRetention,
  getVideoSubscriptionBreakdown
};
