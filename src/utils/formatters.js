/**
 * Formatting utilities matching the SocialPulse AI data contract
 */

/**
 * Parses ISO 8601 duration string (e.g., 'PT5M30S', 'PT1H2M40S', 'PT42S') to total seconds
 */
function parseIsoDurationToSeconds(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formats total seconds to 'MM:SS' or 'HH:MM:SS'
 */
function formatSecondsToDuration(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  const pad = (n) => String(n).padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Converts ISO 8601 duration directly to 'MM:SS' or 'HH:MM:SS'
 */
function formatIsoDuration(isoDuration) {
  const seconds = parseIsoDurationToSeconds(isoDuration);
  return formatSecondsToDuration(seconds);
}

/**
 * Formats large numbers with commas (e.g., 1420500 -> '1,420,500')
 */
function formatCommaNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(num));
}

/**
 * Formats compact numbers (e.g., 14800000 -> '14.8M', 84600 -> '84.6K')
 */
function formatCompactNumber(num, digits = 1) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = Number(num);
  if (n >= 1e9) {
    return (n / 1e9).toFixed(digits).replace(/\.0$/, '') + 'B';
  }
  if (n >= 1e6) {
    return (n / 1e6).toFixed(digits).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1e3) {
    return (n / 1e3).toFixed(digits).replace(/\.0$/, '') + 'K';
  }
  return n.toString();
}

/**
 * Formats a decimal ratio to percentage string (e.g., 0.642 or 64.2 -> '64.2%')
 */
function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '0.0%';
  const num = Number(value);
  // If value is a fraction <= 1.0 (and not 0), convert to percentage
  const pct = num <= 1.0 && num > 0 ? num * 100 : num;
  return `${pct.toFixed(decimals)}%`;
}

/**
 * Formats multiplier string (e.g. 1.9 -> '1.9x')
 */
function formatMultiplier(value, symbol = 'x') {
  if (value === null || value === undefined || isNaN(value)) return `1.0${symbol}`;
  return `${Number(value).toFixed(1)}${symbol}`;
}

/**
 * Extracts 2-letter avatar initials from a title/name
 */
function getAvatarLetters(name) {
  if (!name || typeof name !== 'string') return 'SP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

module.exports = {
  parseIsoDurationToSeconds,
  formatSecondsToDuration,
  formatIsoDuration,
  formatCommaNumber,
  formatCompactNumber,
  formatPercent,
  formatMultiplier,
  getAvatarLetters
};
