/**
 * Google OAuth 2.0 Client & Token Management Service
 */
const { google } = require('googleapis');
const config = require('../config');
const { saveToken, getToken, deleteToken } = require('../db/database');
const cacheService = require('./cacheService');

const TOKEN_KEY = 'google_creator';

let oauth2ClientInstance = null;

function createOAuth2Client() {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  // Automatically persist refreshed tokens
  client.on('tokens', async (tokens) => {
    try {
      await saveToken(TOKEN_KEY, tokens);
      console.log('Google OAuth tokens refreshed and saved to SQLite.');
    } catch (err) {
      console.error('Failed to save refreshed token:', err.message);
    }
  });

  return client;
}

function getOAuth2Client() {
  if (!oauth2ClientInstance) {
    oauth2ClientInstance = createOAuth2Client();
  }
  return oauth2ClientInstance;
}

/**
 * Generates the Google OAuth 2.0 authorization URL
 */
function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: config.google.scopes,
    include_granted_scopes: true
  });
}

/**
 * Exchanges authorization code for tokens and saves to SQLite
 */
async function exchangeCodeForTokens(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  await saveToken(TOKEN_KEY, tokens);
  client.setCredentials(tokens);
  cacheService.flush();
  return tokens;
}

/**
 * Loads stored tokens and returns an authenticated OAuth2Client, or null if not authenticated
 */
async function getAuthenticatedClient() {
  const client = getOAuth2Client();
  const storedTokens = await getToken(TOKEN_KEY);

  if (!storedTokens || (!storedTokens.access_token && !storedTokens.refresh_token)) {
    return null;
  }

  client.setCredentials(storedTokens);
  return client;
}

/**
 * Checks if a valid token exists
 */
async function isAuthenticated() {
  const tokens = await getToken(TOKEN_KEY);
  return !!(tokens && (tokens.access_token || tokens.refresh_token));
}

/**
 * Revokes and deletes stored tokens
 */
async function logout() {
  const client = getOAuth2Client();
  try {
    const tokens = await getToken(TOKEN_KEY);
    if (tokens && tokens.access_token) {
      await client.revokeToken(tokens.access_token);
    }
  } catch (err) {
    console.warn('Token revocation warning:', err.message);
  } finally {
    await deleteToken(TOKEN_KEY);
    client.setCredentials({});
    cacheService.flush();
  }
  return { success: true };
}

module.exports = {
  getOAuth2Client,
  getAuthUrl,
  exchangeCodeForTokens,
  getAuthenticatedClient,
  isAuthenticated,
  logout
};
