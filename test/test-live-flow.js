/**
 * Test Suite: Real YouTube Data Processing & Pipeline Verification
 * Validates algorithmic processor, sentiment analysis, and Google API response handling
 */
const assert = require('assert');
const analyticsProcessor = require('../src/services/analyticsProcessor');
const sentimentService = require('../src/services/sentimentService');
const {
  formatCommaNumber,
  formatCompactNumber,
  formatSecondsToDuration,
  formatIsoDuration,
  parseIsoDurationToSeconds,
  formatPercent,
  formatMultiplier,
  getAvatarLetters
} = require('../src/utils/formatters');

console.log('\n============================================================');
console.log('🧪 RUNNING YOUTUBE DATA PIPELINE & PROCESSOR VERIFICATION');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. Retention Curve Processing (Simulating real 100 YouTube buckets)
// -------------------------------------------------------------
test('Retention Processor correctly detects drop anomaly and downsamples', () => {
  // Real YouTube Analytics returns 100 buckets: [elapsedVideoTimeRatio, audienceWatchRatio]
  const rawRows = [];
  for (let i = 0; i <= 100; i++) {
    const ratio = (i / 100).toFixed(2);
    let watchRatio;
    if (i < 30) {
      watchRatio = 1.0 - (i * 0.005); // Gradual decline
    } else if (i === 30) {
      watchRatio = 0.85;
    } else if (i === 31) {
      watchRatio = 0.65; // Sudden 20% drop (anomaly)
    } else {
      watchRatio = 0.65 - ((i - 31) * 0.005);
    }
    rawRows.push([ratio, Math.max(0, watchRatio).toFixed(4)]);
  }

  const durationSeconds = 300; // 5 minute video
  const result = analyticsProcessor.processRetentionCurve(rawRows, durationSeconds);

  assert(Array.isArray(result.curve), 'curve is an array');
  assert(result.curve.length >= 10 && result.curve.length <= 16, `Sampled length is ${result.curve.length}`);
  assert(result.maxDrop >= 15, `maxDrop should be detected (got ${result.maxDrop})`);
  assert(result.anomalyPoint !== null, 'anomalyPoint must be found');

  const anomalyObj = analyticsProcessor.buildAnomalyDiagnosis(result.anomalyPoint, result.maxDrop, 'Test Video');
  assert(anomalyObj !== null, 'Anomaly diagnosis generated');
  assert(typeof anomalyObj.timestamp === 'string', 'Anomaly timestamp is string');
  assert(typeof anomalyObj.recommendedAction === 'string', 'Recommended action provided');
});

test('Retention Processor handles empty rows gracefully without crashing', () => {
  const result = analyticsProcessor.processRetentionCurve([], 180);
  assert(Array.isArray(result.curve), 'curve is array even when empty');
  assert(result.curve.length === 2, 'Fallback curve has 2 points');
  assert(result.anomalyPoint === null, 'No anomaly for empty');
  assert(result.maxDrop === 0, '0 drop for empty');

  const anomalyObj = analyticsProcessor.buildAnomalyDiagnosis(result.anomalyPoint, result.maxDrop, 'Test Video');
  assert(anomalyObj === null, 'No anomaly diagnosis for empty rows');
});

// -------------------------------------------------------------
// 2. Rewatch Hotspots from Relative Retention
// -------------------------------------------------------------
test('Derives rewatch hotspots from relative retention spikes', () => {
  // Relative retention performance rows: [elapsedRatio, relativePerformance]
  // 1.0 = average for videos of same length. > 1.0 = above average replay
  const relRows = [
    ['0.10', '0.95'],
    ['0.20', '0.98'],
    ['0.30', '1.25'], // Peak rewatch spike
    ['0.40', '0.90'],
    ['0.50', '0.85']
  ];

  const hotspots = analyticsProcessor.deriveRewatchHotspots(relRows, 300);
  assert(Array.isArray(hotspots), 'hotspots is array');
  assert(hotspots.length > 0, 'hotspot detected');
  assert(hotspots[0].multiplier.includes('×') || hotspots[0].multiplier.includes('x'), 'multiplier formatted');
  assert(typeof hotspots[0].timestamp === 'string', 'timestamp formatted');
});

test('Derives fallback hotspot when no extreme spike exists', () => {
  const relRows = [
    ['0.10', '0.80'],
    ['0.20', '0.80'],
    ['0.30', '0.80']
  ];
  const hotspots = analyticsProcessor.deriveRewatchHotspots(relRows, 240);
  assert(hotspots.length === 1, 'Provides benchmark hotspot for duration > 60s');
});

// -------------------------------------------------------------
// 3. Audience Segments Approximation from subscribedStatus
// -------------------------------------------------------------
test('Approximates audience loyalty cohorts from real subscribedStatus rows', () => {
  const subscriptionRows = [
    ['SUBSCRIBED', '4000'],
    ['UNSUBSCRIBED', '6000']
  ];

  const segments = analyticsProcessor.approximateAudienceSegments(subscriptionRows);
  assert(typeof segments.loyal === 'number', 'loyal is number');
  assert(typeof segments.returning === 'number', 'returning is number');
  assert(typeof segments.casual === 'number', 'casual is number');
  assert(typeof segments.oneTime === 'number', 'oneTime is number');
  const sum = segments.loyal + segments.returning + segments.casual + segments.oneTime;
  assert(sum >= 98 && sum <= 102, `Cohort percentages sum to ~100% (got ${sum}%)`);
});

test('Handles empty subscribedStatus rows with baseline distribution', () => {
  const segments = analyticsProcessor.approximateAudienceSegments([]);
  assert(segments.loyal > 0, 'Has loyal baseline');
  assert(segments.returning > 0, 'Has returning baseline');
});

// -------------------------------------------------------------
// 4. Satisfaction Score Composite
// -------------------------------------------------------------
test('Calculates composite satisfaction score and component breakdown', () => {
  const { satisfactionScore, scoreBreakdown } = analyticsProcessor.calculateSatisfactionScore(
    65.5, // avgRetentionPct
    9.2,  // engagementRatePct
    1.9,  // rewatchMultiplier
    82    // positive comment %
  );

  assert(satisfactionScore >= 0 && satisfactionScore <= 100, `Score in bounds: ${satisfactionScore}`);
  assert(typeof scoreBreakdown.retention === 'number', 'retention score number');
  assert(typeof scoreBreakdown.engagement === 'number', 'engagement score number');
  assert(typeof scoreBreakdown.rewatch === 'number', 'rewatch score number');
  assert(typeof scoreBreakdown.sentiment === 'number', 'sentiment score number');
});

// -------------------------------------------------------------
// 5. VADER Sentiment Analysis & Real Comments Topics Extraction
// -------------------------------------------------------------
test('Scores individual comments accurately using VADER sentiment', () => {
  const pos = sentimentService.scoreComment('This tutorial is absolutely amazing, explained so clearly! 🚀');
  assert(pos.label === 'positive', `Expected positive, got ${pos.label}`);
  assert(pos.compound > 0.4, 'High compound score');

  const neg = sentimentService.scoreComment('Terrible pacing, very confusing and boring.');
  assert(neg.label === 'negative', `Expected negative, got ${neg.label}`);
  assert(neg.compound < -0.3, 'Negative compound score');

  const neu = sentimentService.scoreComment('The video is 10 minutes long.');
  assert(neu.label === 'neutral', `Expected neutral, got ${neu.label}`);
});

test('Aggregates comments, calculates sentiment split, and extracts topics & requests', () => {
  const comments = [
    { text: 'Great explanation! Please make a Part 2 covering the database!' },
    { text: 'Loved this video so much, thank you!' },
    { text: 'Can you please make a part 2 on authentication?' },
    { text: 'Where is the github link and source code?' },
    { text: 'Audio was slightly quiet in the intro.' }
  ];

  const analysis = sentimentService.analyzeComments(comments, 5);
  assert(analysis.positive > 0, 'Positive percentage > 0');
  assert(typeof analysis.topAudienceRequest === 'string', 'Identified audience request');
  assert(analysis.topAudienceRequest.toLowerCase().includes('part 2'), `Audience request identified Part 2 (got: ${analysis.topAudienceRequest})`);
  assert(Array.isArray(analysis.trendingTopics), 'trendingTopics is array');
});

// -------------------------------------------------------------
// 6. Formatting Utilities Verification
// -------------------------------------------------------------
test('Formatters handle numbers, durations, and initials accurately', () => {
  assert(parseIsoDurationToSeconds('PT1H2M30S') === 3750, 'parseIsoDurationToSeconds 1h2m30s');
  assert(parseIsoDurationToSeconds('PT45S') === 45, 'parseIsoDurationToSeconds 45s');
  assert(formatSecondsToDuration(3750) === '1:02:30', 'formatSecondsToDuration 3750s');
  assert(formatSecondsToDuration(245) === '04:05', 'formatSecondsToDuration 245s');
  assert(formatIsoDuration('PT5M12S') === '05:12', 'formatIsoDuration PT5M12S');

  assert(formatCommaNumber(1250000) === '1,250,000', 'formatCommaNumber');
  assert(formatCompactNumber(14800000) === '14.8M', 'formatCompactNumber M');
  assert(formatCompactNumber(84600) === '84.6K', 'formatCompactNumber K');
  assert(formatCompactNumber(450) === '450', 'formatCompactNumber under 1000');

  assert(formatPercent(64.2) === '64.2%', 'formatPercent number');
  assert(formatPercent(0.642) === '64.2%', 'formatPercent fraction');
  assert(formatMultiplier(1.85) === '1.9x', 'formatMultiplier');

  assert(getAvatarLetters('Alex Vance') === 'AV', 'getAvatarLetters two words');
  assert(getAvatarLetters('Veritasium') === 'VE', 'getAvatarLetters single word');
});

// -------------------------------------------------------------
// 7. Copyright Radar Transparency
// -------------------------------------------------------------
test('Copyright Radar returns honest transparency payload with zero hallucinated risk', () => {
  const radar = analyticsProcessor.createCopyrightRadarPlaceholder();
  assert(radar.riskLevel === 'N/A', 'Risk level is N/A');
  assert(radar.status === 'Restricted to Content ID Partners', 'Status conveys Content ID partner limitation');
  assert(typeof radar.apiLimitationNotice === 'string', 'Clear explanation why public API cannot scan copyright');
});

console.log('\n============================================================');
console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('============================================================\n');

process.exit(failed > 0 ? 1 : 0);
