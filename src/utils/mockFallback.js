/**
 * Fallback & Demo Dataset matching sih/js/data.js
 * Used when no OAuth token exists or as baseline validation
 */

const MOCK_DATA = {
  creator: {
    name: 'Alex Vance',
    handle: '@alexvance_tech',
    subscribers: '348,000',
    totalViews: '14.8M',
    avatarLetter: 'AV'
  },

  videos: [
    {
      id: 'vid-3',
      title: '5 Productivity Hacks',
      duration: '05:00',
      views: '1,420,500',
      viewsNumeric: 1420500,
      watchTimeHours: '84.6K',
      engagementRate: '8.9%',
      avgRetention: '64.2%',
      completionRate: '35.0%',
      rewatchRate: '1.9x',
      satisfactionScore: 82,
      scoreBreakdown: {
        retention: 86,
        engagement: 72,
        rewatch: 91,
        sentiment: 78
      },
      tag: 'Productivity',
      badge: 'Drop-Off Anomaly',
      retentionCurve: [
        { time: '0:00', seconds: 0, percent: 100, isAnomaly: false, dropPercent: null },
        { time: '0:30', seconds: 30, percent: 94, isAnomaly: false, dropPercent: null },
        { time: '1:00', seconds: 60, percent: 88, isAnomaly: false, dropPercent: null },
        { time: '1:30', seconds: 90, percent: 82, isAnomaly: false, dropPercent: null },
        { time: '2:00', seconds: 120, percent: 78, isAnomaly: false, dropPercent: null },
        { time: '2:30', seconds: 150, percent: 71, isAnomaly: false, dropPercent: null },
        { time: '3:00', seconds: 180, percent: 55, isAnomaly: false, dropPercent: null },
        { time: '3:12', seconds: 192, percent: 38, isAnomaly: true, dropPercent: 17 },
        { time: '3:30', seconds: 210, percent: 52, isAnomaly: false, dropPercent: null },
        { time: '4:00', seconds: 240, percent: 49, isAnomaly: false, dropPercent: null },
        { time: '4:30', seconds: 270, percent: 42, isAnomaly: false, dropPercent: null },
        { time: '5:00', seconds: 300, percent: 35, isAnomaly: false, dropPercent: null }
      ],
      anomaly: {
        timestamp: '03:12',
        dropPercent: 17,
        label: '17% Audience Drop',
        hypothesis: 'Audience retention drops sharply around 03:12. Possible contributing factors include a topic transition, slower pacing, repetitive information or reduced visual interest.',
        recommendedAction: 'Insert a quick visual hook, b-roll footage, or motion graphic at 03:05 to smooth the topic transition.'
      },
      rewatchHotspots: [
        {
          timestamp: '02:10–02:35',
          startSec: 130,
          endSec: 155,
          multiplier: '2.8×',
          note: 'This segment received unusually high replay activity and may contain highly valuable, interesting or difficult-to-follow information.'
        },
        {
          timestamp: '04:20–04:55',
          startSec: 260,
          endSec: 295,
          multiplier: '2.3×',
          note: 'Key summary takeaway replayed frequently by mobile viewers.'
        }
      ],
      audienceSegments: {
        loyal: 34,
        returning: 27,
        casual: 25,
        oneTime: 14
      },
      comments: {
        positive: 64,
        neutral: 23,
        negative: 13,
        totalCount: '3,420',
        trendingTopics: ['AI', 'Coding', 'Productivity', 'Tutorials', 'Editing'],
        topAudienceRequest: 'Many viewers are requesting a Part 2.'
      },
      copyrightRadar: {
        audio: 0,
        visual: 0,
        transcript: 0,
        scene: 0,
        metadata: 0,
        similarityScore: null,
        riskLevel: 'N/A',
        status: 'Restricted to Content ID Partners (Not accessible via public YouTube API)',
        yourSegment: 'N/A',
        matchSegment: 'None',
        apiNotice: 'Content ID similarity scanning is proprietary to YouTube CMS and cannot be accessed via YouTube Data API v3.'
      }
    },
    {
      id: 'vid-1',
      title: 'Complete JavaScript Tutorial',
      duration: '42:15',
      views: '2,450,000',
      viewsNumeric: 2450000,
      watchTimeHours: '312.4K',
      engagementRate: '11.4%',
      avgRetention: '78.5%',
      completionRate: '58.0%',
      rewatchRate: '3.1x',
      satisfactionScore: 94,
      scoreBreakdown: { retention: 94, engagement: 91, rewatch: 98, sentiment: 92 },
      tag: 'Development',
      badge: 'High Retention',
      retentionCurve: [
        { time: '0:00', seconds: 0, percent: 100, isAnomaly: false, dropPercent: null },
        { time: '10:00', seconds: 600, percent: 92, isAnomaly: false, dropPercent: null },
        { time: '20:00', seconds: 1200, percent: 85, isAnomaly: false, dropPercent: null },
        { time: '30:00', seconds: 1800, percent: 81, isAnomaly: false, dropPercent: null },
        { time: '42:15', seconds: 2535, percent: 78, isAnomaly: false, dropPercent: null }
      ],
      anomaly: null,
      rewatchHotspots: [
        {
          timestamp: '14:20–16:45',
          startSec: 860,
          endSec: 1005,
          multiplier: '3.4×',
          note: 'Asynchronous JavaScript & Event Loop explanation replayed repeatedly.'
        }
      ],
      audienceSegments: { loyal: 48, returning: 32, casual: 14, oneTime: 6 },
      comments: {
        positive: 88,
        neutral: 9,
        negative: 3,
        totalCount: '12,940',
        trendingTopics: ['JS', 'Closures', 'Promises', 'Frontend'],
        topAudienceRequest: 'Requesting TypeScript follow-up course.'
      },
      copyrightRadar: {
        audio: 0,
        visual: 0,
        transcript: 0,
        scene: 0,
        metadata: 0,
        similarityScore: null,
        riskLevel: 'N/A',
        status: 'Restricted to Content ID Partners',
        yourSegment: 'N/A',
        matchSegment: 'None'
      }
    }
  ],

  insights: [
    {
      icon: '🔥',
      title: 'Strongest Content Segment',
      type: 'strength',
      whatHappened: 'Peak retention occurred between 01:10 and 02:05 with 94% viewer hold.',
      whyItMatters: 'Clear practical demos with on-screen code snippets maintain the highest audience focus.',
      recommendedAction: 'Adopt this rapid-fire demonstration structure in your next upload intro.'
    },
    {
      icon: '⚠',
      title: 'Major Drop-Off Anomaly',
      type: 'drop',
      whatHappened: 'A sudden 17% drop occurred at 03:12 during an unscripted transition.',
      whyItMatters: 'Viewer momentum halts when visuals remain static for longer than 8 seconds.',
      recommendedAction: 'Insert a quick visual hook, b-roll footage, or motion graphic at 03:05.'
    },
    {
      icon: '🔁',
      title: 'Rewatch Hotspot',
      type: 'rewatch',
      whatHappened: '02:10–02:35 reached a 2.8× replay multiplier across unique sessions.',
      whyItMatters: 'Viewers treat this section as high-density instructional reference material.',
      recommendedAction: 'Pin this timestamp in the comments and provide a downloadable companion graphic.'
    },
    {
      icon: '💬',
      title: 'Audience Request Signal',
      type: 'request',
      whatHappened: '38% of top-level comments explicitly requested an advanced Part 2 deep-dive.',
      whyItMatters: 'Demonstrates strong organic demand with zero customer acquisition friction.',
      recommendedAction: 'Record a sequel focusing on production workflows and link it as an end-card.'
    },
    {
      icon: '📈',
      title: 'Growth Opportunity',
      type: 'growth',
      whatHappened: 'Returning viewer satisfaction increased +14% compared to the 30-day baseline.',
      whyItMatters: 'High cohort retention signals that audience trust and authority are solidifying.',
      recommendedAction: 'Introduce a community poll for the next topic to reinforce viewer loyalty.'
    },
    {
      icon: '©',
      title: 'Content ID Radar Notice',
      type: 'copyright',
      whatHappened: 'YouTube Content ID similarity scanning is restricted to enterprise CMS partners.',
      whyItMatters: 'Public APIs cannot access Content ID match records.',
      recommendedAction: 'Verify music licensing directly in YouTube Studio monetization tab.'
    }
  ],

  instagram: {
    overview: {
      totalReach: '892K',
      views: '1.18M',
      engagementRate: '11.4%',
      followerGrowth: '+8.4%',
      shares: '18.7K',
      saves: '14.3K'
    },
    tabMetrics: {
      overview: {
        totalReach: '892K',
        views: '1.18M',
        engagementRate: '11.4%',
        followerGrowth: '+8.4%',
        shares: '18.7K',
        saves: '14.3K',
        reachTrend: '↑ 14.2%',
        viewsTrend: '↑ 22.6%',
        engTrend: '↑ 3.1%',
        growthTrend: '↑ 2.4%',
        sharesTrend: '↑ 31.8%',
        savesTrend: '↑ 28.4%'
      },
      reels: {
        totalReach: '742K',
        views: '984K',
        engagementRate: '12.6%',
        followerGrowth: '+6.2%',
        shares: '15.2K',
        saves: '11.8K',
        reachTrend: '↑ 18.5%',
        viewsTrend: '↑ 25.4%',
        engTrend: '↑ 4.2%',
        growthTrend: '↑ 3.1%',
        sharesTrend: '↑ 35.2%',
        savesTrend: '↑ 31.0%'
      }
    },
    reels: [
      {
        id: 'ig-1',
        title: '5 AI Tools Every Student Should Know',
        type: 'reel',
        duration: '0:24',
        views: '428K',
        reach: '351K',
        likes: '31.4K',
        comments: '2.8K',
        shares: '8.7K',
        saves: '12.3K',
        avgWatchTime: '18.4s',
        completionRate: '67%',
        replayRate: '2.8×',
        followerConversion: '+4.2%',
        performanceScore: 91,
        tag: 'AI Tools',
        badge: 'High Shares',
        engagementRate: '12.6%',
        shareabilityScore: 93,
        saveabilityScore: 89,
        satisfactionScore: 87,
        scoreBreakdown: { reach: 91, engagement: 84, shares: 93, saves: 89, sentiment: 78 }
      }
    ]
  },

  pinterest: {
    overview: {
      totalImpressions: '2.4M',
      pinClicks: '142K',
      saves: '68.5K',
      outboundClicks: '38.2K',
      engagementRate: '8.7%',
      saveRate: '2.8%',
      impressionsTrend: '↑ 18.4%',
      pinClicksTrend: '↑ 14.2%',
      savesTrend: '↑ 24.6%',
      outboundTrend: '↑ 12.8%'
    },
    pins: [
      {
        id: 'pin-1',
        title: 'Modern Architecture Cheat Sheet 2026',
        board: 'Tech & Architecture',
        type: 'standard_pin',
        impressions: '640K',
        pinClicks: '42.5K',
        saves: '21.8K',
        outboundClicks: '11.2K',
        saveRate: '3.4%',
        engagementRate: '9.8%',
        pinScore: 92,
        badge: 'High Saves',
        tag: 'Architecture',
        gradient: 'linear-gradient(135deg, #e60023, #ff4757)',
        copyrightRadar: {
          audio: null,
          visual: null,
          transcript: null,
          metadata: 18,
          scene: null,
          similarityScore: 18,
          riskLevel: 'LOW',
          status: 'Clear',
          confirmedLicense: 'Creator Original Visual Asset',
          confirmedClaims: '0 Platform Copyright Flags',
          apiNotice: 'Pinterest API v5 does not expose automated reverse-image copyright scanning.'
        }
      },
      {
        id: 'pin-2',
        title: 'Minimalist Workspace Setup Guide',
        board: 'Productivity & Gear',
        type: 'idea_pin',
        impressions: '420K',
        pinClicks: '28.4K',
        saves: '14.2K',
        outboundClicks: '7.8K',
        saveRate: '3.3%',
        engagementRate: '8.4%',
        pinScore: 86,
        badge: 'Trending Idea Pin',
        tag: 'Productivity',
        gradient: 'linear-gradient(135deg, #bd081c, #ff6b81)',
        copyrightRadar: {
          audio: null,
          visual: null,
          transcript: null,
          metadata: 22,
          scene: null,
          similarityScore: 22,
          riskLevel: 'LOW',
          status: 'Clear',
          confirmedLicense: 'Verified Domain Attribution',
          confirmedClaims: '0 Platform Copyright Flags',
          apiNotice: 'Pinterest API v5 does not expose automated reverse-image copyright scanning.'
        }
      },
      {
        id: 'pin-3',
        title: '10 Clean Code Infographics for Web Devs',
        board: 'Coding & Design',
        type: 'standard_pin',
        impressions: '580K',
        pinClicks: '36.1K',
        saves: '19.4K',
        outboundClicks: '10.1K',
        saveRate: '3.3%',
        engagementRate: '9.1%',
        pinScore: 89,
        badge: 'High Outbound Clicks',
        tag: 'Web Dev',
        gradient: 'linear-gradient(135deg, #9b0014, #e60023)',
        copyrightRadar: {
          audio: null,
          visual: null,
          transcript: null,
          metadata: 16,
          scene: null,
          similarityScore: 16,
          riskLevel: 'LOW',
          status: 'Clear',
          confirmedLicense: 'Open Source Reference / CC-BY',
          confirmedClaims: '0 Platform Copyright Flags',
          apiNotice: 'Pinterest API v5 does not expose automated reverse-image copyright scanning.'
        }
      }
    ]
  },

  x: {
    overview: {
      totalImpressions: '3.8M',
      likes: '124K',
      reposts: '38.4K',
      quotes: '9.2K',
      replies: '14.8K',
      bookmarks: '42.6K',
      engagementRate: '6.2%',
      impressionsTrend: '↑ 26.5%',
      repostsTrend: '↑ 19.4%',
      bookmarksTrend: '↑ 32.1%',
      likesTrend: '↑ 15.8%'
    },
    posts: [
      {
        id: 'post-1',
        title: 'Breakthrough in AI Autonomous Agents (10 Key Takeaways)',
        text: 'Autonomous coding agents are entering production environments. Here are 10 key architectural patterns every senior engineer needs to know:',
        type: 'post',
        impressions: '890K',
        likes: '34.2K',
        reposts: '12.4K',
        quotes: '3.1K',
        replies: '4.8K',
        bookmarks: '18.9K',
        engagementRate: '8.2%',
        performanceScore: 94,
        badge: 'Viral Repost Momentum',
        tag: 'AI Tech',
        gradient: 'linear-gradient(135deg, #1d9bf0, #00ba7c)',
        copyrightRadar: {
          audio: null,
          visual: null,
          transcript: 12,
          metadata: 14,
          scene: null,
          similarityScore: 14,
          riskLevel: 'LOW',
          status: 'Clear',
          confirmedLicense: 'X Author Original Expression',
          confirmedClaims: '0 DMCA Claims / No Active Flags',
          apiNotice: 'X Content Matching & DMCA telemetry is internal to X Trust & Safety.'
        }
      },
      {
        id: 'post-2',
        title: 'Clean Architecture Patterns for TypeScript Backends',
        text: 'Stop building monolithic controllers. Use this lightweight 3-layer adapter pattern to decouple your business logic from external APIs:',
        type: 'post',
        impressions: '520K',
        likes: '19.8K',
        reposts: '7.2K',
        quotes: '1.4K',
        replies: '2.1K',
        bookmarks: '11.4K',
        engagementRate: '7.1%',
        performanceScore: 88,
        badge: 'High Bookmarks',
        tag: 'Software Engineering',
        gradient: 'linear-gradient(135deg, #0f172a, #1d9bf0)',
        copyrightRadar: {
          audio: null,
          visual: null,
          transcript: 15,
          metadata: 16,
          scene: null,
          similarityScore: 16,
          riskLevel: 'LOW',
          status: 'Clear',
          confirmedLicense: 'Open Source Reference / CC-BY',
          confirmedClaims: '0 DMCA Claims / No Active Flags',
          apiNotice: 'X Content Matching & DMCA telemetry is internal to X Trust & Safety.'
        }
      },
      {
        id: 'post-3',
        title: 'The 2026 Developer Tooling Reality Check',
        text: 'The biggest shift in developer workflows over the past 12 months is not code generation — it is autonomous agentic task verification.',
        type: 'post',
        impressions: '410K',
        likes: '14.5K',
        reposts: '5.1K',
        quotes: '980',
        replies: '1.6K',
        bookmarks: '8.7K',
        engagementRate: '6.5%',
        performanceScore: 82,
        badge: 'Discussion Thread',
        tag: 'Developer Tools',
        gradient: 'linear-gradient(135deg, #0f172a, #334155)',
        copyrightRadar: {
          audio: null,
          visual: null,
          transcript: 10,
          metadata: 12,
          scene: null,
          similarityScore: 12,
          riskLevel: 'LOW',
          status: 'Clear',
          yourSegment: 'N/A',
          confirmedLicense: 'X Author Original Expression',
          confirmedClaims: '0 DMCA Claims / No Active Flags',
          apiNotice: 'X Content Matching & DMCA telemetry is internal to X Trust & Safety.'
        }
      }
    ]
  }
};

module.exports = MOCK_DATA;
