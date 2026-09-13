/**
 * In-memory caching service using NodeCache
 * Safeguards YouTube 10,000 units/day API quota by caching queries for 15+ minutes
 */
const NodeCache = require('node-cache');
const config = require('../config');

// Initialize cache with default TTL
const cache = new NodeCache({
  stdTTL: config.cacheTtlSeconds,
  checkperiod: 120,
  useClones: false
});

/**
 * Gets a cached item or computes and caches it
 */
async function getOrSet(key, fetchFn, ttl = config.cacheTtlSeconds) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const result = await fetchFn();
  if (result !== undefined && result !== null) {
    cache.set(key, result, ttl);
  }
  return result;
}

function get(key) {
  return cache.get(key);
}

function set(key, value, ttl = config.cacheTtlSeconds) {
  return cache.set(key, value, ttl);
}

function del(key) {
  return cache.del(key);
}

function flush() {
  return cache.flushAll();
}

function getStats() {
  return cache.getStats();
}

module.exports = {
  getOrSet,
  get,
  set,
  del,
  flush,
  getStats
};
