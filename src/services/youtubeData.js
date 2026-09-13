/**
 * YouTube Data API v3 Service
 * Interacts with channels, playlists, videos, and comments endpoints
 */
const { google } = require('googleapis');
const {
  formatCommaNumber,
  formatCompactNumber,
  formatIsoDuration,
  parseIsoDurationToSeconds,
  getAvatarLetters
} = require('../utils/formatters');
const { getOrSet } = require('./cacheService');

function getYoutubeClient(auth) {
  return google.youtube({ version: 'v3', auth });
}

/**
 * Fetches authenticated creator's channel profile
 */
async function getChannelProfile(auth) {
  const cacheKey = 'youtube_channel_profile';

  return getOrSet(cacheKey, async () => {
    const youtube = getYoutubeClient(auth);
    const res = await youtube.channels.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      mine: true
    });

    if (!res.data.items || res.data.items.length === 0) {
      throw new Error('No YouTube channel found for the authenticated user.');
    }

    const channel = res.data.items[0];
    const snippet = channel.snippet || {};
    const stats = channel.statistics || {};
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

    const subCount = parseInt(stats.subscriberCount, 10) || 0;
    const viewCount = parseInt(stats.viewCount, 10) || 0;

    return {
      id: channel.id,
      name: snippet.title || 'Creator',
      handle: snippet.customUrl || `@${(snippet.title || 'creator').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}`,
      subscribers: formatCommaNumber(subCount),
      subscribersNumeric: subCount,
      totalViews: formatCompactNumber(viewCount),
      totalViewsNumeric: viewCount,
      avatarLetter: getAvatarLetters(snippet.title),
      avatarUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
      uploadsPlaylistId
    };
  }, 1800); // 30 min cache for channel profile
}

/**
 * Fetches the list of uploaded videos for the channel
 */
async function getChannelVideos(auth, maxResults = 15) {
  const cacheKey = `youtube_videos_list_${maxResults}`;

  return getOrSet(cacheKey, async () => {
    const channelProfile = await getChannelProfile(auth);
    const uploadsPlaylistId = channelProfile.uploadsPlaylistId;

    if (!uploadsPlaylistId) {
      throw new Error('Uploads playlist not found for channel.');
    }

    const youtube = getYoutubeClient(auth);

    // Step 1: Fetch items from uploads playlist
    const playlistRes = await youtube.playlistItems.list({
      playlistId: uploadsPlaylistId,
      part: ['snippet', 'contentDetails'],
      maxResults
    });

    const items = playlistRes.data.items || [];
    if (items.length === 0) {
      return [];
    }

    const videoIds = items
      .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
      .filter(Boolean);

    // Step 2: Fetch detailed video statistics & durations in batch
    const videoRes = await youtube.videos.list({
      id: videoIds.join(','),
      part: ['snippet', 'contentDetails', 'statistics']
    });

    const videoDetails = videoRes.data.items || [];

    return videoDetails.map((v) => {
      const stats = v.statistics || {};
      const viewsNumeric = parseInt(stats.viewCount, 10) || 0;
      const likeCount = parseInt(stats.likeCount, 10) || 0;
      const commentCount = parseInt(stats.commentCount, 10) || 0;
      const durationSeconds = parseIsoDurationToSeconds(v.contentDetails?.duration);

      // Estimate initial engagement rate: (likes + comments) / views
      const engRateNum = viewsNumeric > 0 ? ((likeCount + commentCount) / viewsNumeric) * 100 : 0;

      return {
        id: v.id,
        title: v.snippet?.title || 'Untitled Video',
        description: v.snippet?.description || '',
        publishedAt: v.snippet?.publishedAt,
        duration: formatIsoDuration(v.contentDetails?.duration),
        durationSeconds,
        views: formatCommaNumber(viewsNumeric),
        viewsNumeric,
        watchTimeHours: formatCompactNumber(Math.round((viewsNumeric * durationSeconds * 0.5) / 3600)),
        engagementRate: `${engRateNum.toFixed(1)}%`,
        avgRetention: '60.0%', // default placeholder until /api/videos/:id is requested
        completionRate: '35.0%',
        rewatchRate: '1.8x',
        satisfactionScore: 80,
        scoreBreakdown: { retention: 80, engagement: 78, rewatch: 82, sentiment: 80 },
        tag: v.snippet?.tags?.[0] || 'YouTube',
        badge: 'Recent Upload',
        thumbnailUrl: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.default?.url
      };
    });
  }, 900); // 15 min cache
}

/**
 * Fetches a single video by ID with full details
 */
async function getVideoDetailsById(auth, videoId) {
  const cacheKey = `youtube_video_detail_${videoId}`;

  return getOrSet(cacheKey, async () => {
    const youtube = getYoutubeClient(auth);
    const res = await youtube.videos.list({
      id: videoId,
      part: ['snippet', 'contentDetails', 'statistics']
    });

    if (!res.data.items || res.data.items.length === 0) {
      return null;
    }

    const v = res.data.items[0];
    const stats = v.statistics || {};
    const viewsNumeric = parseInt(stats.viewCount, 10) || 0;
    const durationSeconds = parseIsoDurationToSeconds(v.contentDetails?.duration);

    return {
      id: v.id,
      title: v.snippet?.title || 'Untitled',
      description: v.snippet?.description || '',
      publishedAt: v.snippet?.publishedAt,
      duration: formatIsoDuration(v.contentDetails?.duration),
      durationSeconds,
      views: formatCommaNumber(viewsNumeric),
      viewsNumeric,
      likes: parseInt(stats.likeCount, 10) || 0,
      commentsCount: parseInt(stats.commentCount, 10) || 0,
      tag: v.snippet?.tags?.[0] || 'Content',
      thumbnailUrl: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.default?.url
    };
  }, 900);
}

/**
 * Fetches comments for a video
 */
async function getCommentsForVideo(auth, videoId, maxResults = 100, pageToken = null) {
  const cacheKey = `youtube_comments_${videoId}_${pageToken || 'first'}`;

  return getOrSet(cacheKey, async () => {
    const youtube = getYoutubeClient(auth);
    try {
      const res = await youtube.commentThreads.list({
        part: ['snippet'],
        videoId,
        maxResults,
        textFormat: 'plainText',
        pageToken: pageToken || undefined
      });

      const items = res.data.items || [];
      const comments = items.map((item) => {
        const top = item.snippet?.topLevelComment?.snippet || {};
        return {
          id: item.id,
          author: top.authorDisplayName || 'Viewer',
          authorProfileImageUrl: top.authorProfileImageUrl,
          text: top.textDisplay || '',
          likeCount: top.likeCount || 0,
          publishedAt: top.publishedAt
        };
      });

      return {
        comments,
        nextPageToken: res.data.nextPageToken || null,
        totalReplyCount: res.data.pageInfo?.totalResults || comments.length
      };
    } catch (err) {
      console.warn(`Comments disabled or unavailable for video ${videoId}:`, err.message);
      return { comments: [], nextPageToken: null, totalReplyCount: 0 };
    }
  }, 900);
}

module.exports = {
  getChannelProfile,
  getChannelVideos,
  getVideoDetailsById,
  getCommentsForVideo
};
