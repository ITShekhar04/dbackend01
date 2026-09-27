/**
 * Configuration module for SocialPulse AI Backend
 */
require('dotenv').config();
const path = require('path');

const config = {
  port: parseInt(process.env.NODE_PORT, 10) || 5000,
  frontendOrigins: (process.env.FRONTEND_URL || 'http://localhost:3000,http://127.0.0.1:5500')
    .split(',')
    .map((origin) => origin.trim()),

  google: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  },

  llm: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || ''
  },

  databasePath: path.resolve(__dirname, '../data/socialpulse.db'),

  cacheTtlSeconds: 15 * 60, // 15 minutes cache to safeguard YouTube 10,000 unit/day quota

  useMockFallbackIfUnauthenticated:
    process.env.USE_MOCK_FALLBACK_IF_UNAUTHENTICATED === 'true' ||
    process.env.USE_MOCK_FALLBACK_IF_UNAUTHENTICATED === undefined,

  instagram: {
    appId: process.env.INSTAGRAM_APP_ID || '',
    appSecret: process.env.INSTAGRAM_APP_SECRET || '',
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:5000/api/instagram/auth/callback',
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || ''
  },

  pinterest: {
    clientId: process.env.PINTEREST_APP_ID || process.env.PINTEREST_CLIENT_ID || '',
    clientSecret: process.env.PINTEREST_APP_SECRET || process.env.PINTEREST_CLIENT_SECRET || '',
    redirectUri: process.env.PINTEREST_REDIRECT_URI || 'http://localhost:5000/api/pinterest/auth/callback',
    accessToken: process.env.PINTEREST_ACCESS_TOKEN || ''
  },

  x: {
    apiKey: process.env.X_API_KEY || process.env.TWITTER_API_KEY || '',
    apiSecret: process.env.X_API_SECRET || process.env.TWITTER_API_SECRET || '',
    bearerToken: process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || '',
    clientId: process.env.X_CLIENT_ID || '',
    clientSecret: process.env.X_CLIENT_SECRET || '',
    redirectUri: process.env.X_REDIRECT_URI || 'http://localhost:5000/api/x/auth/callback',
    accessToken: process.env.X_ACCESS_TOKEN || ''
  },

  facebook: {
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN || '',
    pageId: process.env.FACEBOOK_PAGE_ID || ''
  },

  telegram: {
    apiKey: process.env.TELEGRAM_API_KEY || process.env.TELEGRAM_API_HASH || '',
    apiHash: process.env.TELEGRAM_API_HASH || process.env.TELEGRAM_API_KEY || ''
  }
};

module.exports = config;
