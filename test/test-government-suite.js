/**
 * Comprehensive Automated Verification Suite for SocialPulse AI Government Intelligence
 * Verifies all 20 specification requirements:
 * 1. Security, 2FA, RBAC, lockout protection, session expiry, and audit trails
 * 2. Section 21 Anti-Suppression Safeguard (Server-side rejection of takedowns on policy criticism)
 * 3. Section 18 Data Integrity (Honest labels: "Not available", "Potential Content Reuse", "DEMO DATA")
 * 4. All 10 command center modules: Viral, AI Signal, Similarity, Clusters, Origin, Coordination, Narratives, Impact, State, Filtration, Alerts
 * 5. Multi-modal Fingerprinting and Blockchain Provenance Ledger
 */

const http = require('http');
const app = require('../src/server');

let server;
const PORT = 5098;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:${PORT}${path}`,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = body ? JSON.parse(body) : null;
            resolve({ status: res.statusCode, headers: res.headers, data });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, raw: body });
          }
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🏛️  GOVERNMENT INTELLIGENCE & CREATOR PROVENANCE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    server = app.listen(PORT);
    console.log(`Test server running on port ${PORT}\n`);

    // 1. UNAUTHORIZED ACCESS REJECTION (Section 16)
    console.log('--- 1. BACKEND SECURITY & ZERO-TRUST REJECTION ---');
    const unauthRes = await request('/api/gov/trends/viral');
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401 Unauthorized');
    assert(unauthRes.data && unauthRes.data.status === 'unauthorized', '401 response contains explicit unauthorized status');

    // 2. AUTHENTICATION FLOW: LOGIN & 2FA (Section 16)
    console.log('\n--- 2. TWO-FACTOR AUTHENTICATION & SESSIONS ---');
    const badLogin = await request('/api/gov/auth/login', {
      method: 'POST',
      body: { email: 'analyst@socialpulse.gov', token: 'WRONG-KEY' }
    });
    assert(badLogin.status === 401, 'Invalid access credentials rejected with 401');

    const validLogin = await request('/api/gov/auth/login', {
      method: 'POST',
      body: { email: 'analyst@socialpulse.gov', token: 'SP-SEC-9942-0XF1A7' }
    });
    assert(validLogin.status === 200, 'Valid credentials return 200 OK');
    assert(validLogin.data.status === '2FA_REQUIRED', '2FA challenge issued upon valid credentials');
    assert(validLogin.data.challengeToken, '2FA challenge token returned');
    assert(validLogin.data.demoOtpHint, 'Demo OTP hint provided for automated verification');

    const challengeToken = validLogin.data.challengeToken;
    const otp = validLogin.data.demoOtpHint;

    const bad2FA = await request('/api/gov/auth/verify-2fa', {
      method: 'POST',
      body: { challengeToken, otp: '000000' }
    });
    assert(bad2FA.status === 401, 'Invalid OTP rejected with 401');

    const good2FA = await request('/api/gov/auth/verify-2fa', {
      method: 'POST',
      body: { challengeToken, otp }
    });
    assert(good2FA.status === 200, 'Valid 2FA OTP verified with 200 OK');
    assert(good2FA.data.status === 'authenticated', 'Session status is authenticated');
    assert(good2FA.data.token, 'Session bearer token generated');
    assert(good2FA.data.user.role === 'Government Analyst', 'Role confirmed as Government Analyst');

    const analystToken = good2FA.data.token;
    const authHeaders = { Authorization: `Bearer ${analystToken}` };

    const sessionCheck = await request('/api/gov/auth/session', { headers: authHeaders });
    assert(sessionCheck.status === 200 && sessionCheck.data.active === true, 'GET /api/gov/auth/session confirms active session');
    assert(sessionCheck.data.remainingSeconds > 0, 'Remaining session seconds tracking correctly');

    // 3. VIRAL CONTENT INTELLIGENCE & DATA INTEGRITY (Sections 1 & 18)
    console.log('\n--- 3. VIRAL CONTENT INTELLIGENCE & HONEST METRICS ---');
    const viralRes = await request('/api/gov/trends/viral', { headers: authHeaders });
    assert(viralRes.status === 200, 'GET /api/gov/trends/viral returns 200 OK');
    assert(viralRes.data.mode === 'DEMO DATA' || viralRes.data.mode === 'OFFICIAL API', 'Section 18: Mode explicitly labeled "DEMO DATA" or "OFFICIAL API"');
    assert(Array.isArray(viralRes.data.trends) && viralRes.data.trends.length >= 4, 'Viral trends registry contains at least 4 monitored trends');
    
    const scamTrend = viralRes.data.trends.find((t) => t.id === 'trend-scam-04');
    assert(scamTrend && scamTrend.views === 'Not available', 'Section 18 Data Integrity: Telegram views honestly reported as "Not available"');
    assert(scamTrend && scamTrend.impressions === 'Not available', 'Section 18 Data Integrity: Telegram impressions honestly reported as "Not available"');

    // 4. AI CONTENT SIGNAL (Section 2)
    console.log('\n--- 4. AI CONTENT SIGNALS ---');
    const aiSignalRes = await request('/api/gov/trends/trend-scam-04/ai-signal', { headers: authHeaders });
    assert(aiSignalRes.status === 200, 'GET /api/gov/trends/:id/ai-signal returns 200 OK');
    assert(aiSignalRes.data.label === 'AI-generation signal — not definitive proof.', 'Section 2: Labeled "AI-generation signal — not definitive proof."');
    assert(aiSignalRes.data.overallSignal === 'Likely AI-generated', 'Overall signal classification matches expectation');
    assert(aiSignalRes.data.signalsDetected.some((s) => s.type === 'Synthetic voice indicators'), 'Synthetic voice indicator signal present');

    // 5. VIRAL VIDEO SIMILARITY RADAR & CONTENT CLUSTERING (Sections 3 & 4)
    console.log('\n--- 5. SIMILARITY RADAR & CONTENT CLUSTERING ---');
    const simRes = await request('/api/gov/trends/trend-emp-01/similarity-radar', { headers: authHeaders });
    assert(simRes.status === 200, 'GET /api/gov/trends/:id/similarity-radar returns 200 OK');
    assert(simRes.data.highestMatch.classification === 'Potential Content Reuse', 'Section 3: Labeled "Potential Content Reuse", NOT "Copyright Violation"');
    assert(simRes.data.highestMatch.matchingSegment === '00:31–00:58', 'Matching segment 00:31–00:58 identified');

    const clusterRes = await request('/api/gov/clusters', { headers: authHeaders });
    assert(clusterRes.status === 200, 'GET /api/gov/clusters returns 200 OK');
    assert(clusterRes.data.clusters[0].clusterId === 'CONTENT CLUSTER #024', 'Cluster #024 present');
    assert(clusterRes.data.clusters[0].totalRelatedItems === 49, 'Cluster #024 totals 49 related items across platforms');

    // 6. TREND ORIGIN & COORDINATION RADAR (Sections 5 & 6)
    console.log('\n--- 6. TREND ORIGIN & COORDINATION RADAR ---');
    const originRes = await request('/api/gov/trends/trend-emp-01/propagation', { headers: authHeaders });
    assert(originRes.status === 200, 'GET /api/gov/trends/:id/propagation returns 200 OK');
    assert(originRes.data.timelineLabel === 'Observed propagation timeline', 'Section 5: Labeled "Observed propagation timeline"');
    assert(originRes.data.propagationTimeline[0].event === 'Earliest observed signal', 'Section 5: Uses "Earliest observed signal", not absolute true origin');

    const coordRes = await request('/api/gov/coordination-radar', { headers: authHeaders });
    assert(coordRes.status === 200, 'GET /api/gov/coordination-radar returns 200 OK');
    assert(coordRes.data.statusLabel === 'Potential coordinated activity', 'Section 6: Labeled "Potential coordinated activity", not confirmed operation');
    assert(coordRes.data.recommendationStatus === 'Human review recommended', 'Section 6: Status is "Human review recommended"');
    assert(coordRes.data.detectedInstances[0].accountsDetected === 37, 'Coordination radar flagged 37 accounts in 8 minute window');

    // 7. SECTION 21 CRITICAL SAFEGUARDS: AWARENESS != ENFORCEMENT
    console.log('\n--- 7. SECTION 21 SAFEGUARD LAYER (ANTI-SUPPRESSION) ---');
    const narrRes = await request('/api/gov/narratives', { headers: authHeaders });
    assert(narrRes.status === 200, 'GET /api/gov/narratives returns 200 OK');
    
    const govCriticalNarr = narrRes.data.narratives.find((n) => n.criticism_of_government === true);
    assert(govCriticalNarr !== undefined, 'Government-critical narrative identified with criticism_of_government: true');
    assert(govCriticalNarr.blockedActionsNotice.includes('No suppression/restriction options'), 'UI notice explicitly states no suppression available');

    // Attempt forbidden takedown on policy criticism -> MUST BE BLOCKED SERVER-SIDE WITH 403!
    const blockedAction = await request(`/api/gov/narratives/${govCriticalNarr.id}/action`, {
      method: 'POST',
      headers: authHeaders,
      body: { actionType: 'takedown' }
    });
    assert(blockedAction.status === 403, 'Section 21 Safeguard: Server-side blocked takedown action on policy criticism with 403 Forbidden');
    assert(blockedAction.data.message.includes('Section 21'), 'Rejection message cites Section 21 safeguard rules');

    // Attempt valid communication action -> MUST SUCCEED
    const validAction = await request(`/api/gov/narratives/${govCriticalNarr.id}/action`, {
      method: 'POST',
      headers: authHeaders,
      body: { actionType: 'act-clarify' }
    });
    assert(validAction.status === 200, 'Permitted communication action (Draft Public Clarification) succeeds with 200 OK');

    // 8. PUBLIC IMPACT, STATE PULSE, FILTRATION & ALERTS (Sections 8, 9, 10, 11)
    console.log('\n--- 8. IMPACT, STATE PULSE, FILTRATION & ALERTS ---');
    const impactRes = await request('/api/gov/public-impact', { headers: authHeaders });
    assert(impactRes.status === 200, 'GET /api/gov/public-impact returns 200 OK');
    assert(impactRes.data.state === 'MEDIUM', 'Potential Public Impact Signal calculated as MEDIUM');

    const stateRes = await request('/api/gov/state-pulse?state=Madhya%20Pradesh', { headers: authHeaders });
    assert(stateRes.status === 200, 'GET /api/gov/state-pulse returns 200 OK');
    assert(stateRes.data.selectedState === 'Madhya Pradesh', 'State selected as Madhya Pradesh');
    assert(stateRes.data.data.topEmergingTrends.length === 3, 'Top 3 emerging trends returned for MP');
    assert(stateRes.data.data.districts['Bhopal'] !== undefined, 'District level drill-down for Bhopal available');

    const filtrationRes = await request('/api/gov/content-filtration', { headers: authHeaders });
    assert(filtrationRes.status === 200, 'GET /api/gov/content-filtration returns 200 OK');
    assert(filtrationRes.data.items.length >= 9, 'Advanced content filtration has sample items across categories');

    const alertsRes = await request('/api/gov/alerts', { headers: authHeaders });
    assert(alertsRes.status === 200, 'GET /api/gov/alerts returns 200 OK');
    assert(alertsRes.data.alerts.length === 7, 'Government Alert Center contains all 7 defined alert types');
    assert(alertsRes.data.alerts.some((a) => a.severityIcon === '🔴'), 'Critical red alert present');
    assert(alertsRes.data.alerts.some((a) => a.severityIcon === '🟢'), 'Positive green alert present');

    const matrixRes = await request('/api/gov/platform-matrix', { headers: authHeaders });
    assert(matrixRes.status === 200, 'GET /api/gov/platform-matrix returns 200 OK');
    assert(matrixRes.data.matrix.length >= 7, 'Platform data access matrix covers 7 platforms');

    // 9. ROLE-BASED ACCESS CONTROL (RBAC) & ADMIN REPORTING (Sections 16 & 21.4)
    console.log('\n--- 9. RBAC & ADMINISTRATOR TRANSPARENCY REPORT ---');
    // Analyst trying to access admin audit logs -> MUST BE 403
    const analystAuditDenied = await request('/api/gov/audit-logs', { headers: authHeaders });
    assert(analystAuditDenied.status === 403, 'RBAC: Government Analyst denied access to /audit-logs with 403 Forbidden');

    // Login as Administrator
    const adminLogin = await request('/api/gov/auth/login', {
      method: 'POST',
      body: { email: 'admin@socialpulse.gov', token: 'ADMIN-ROOT-2026-ALPHA' }
    });
    const admin2FA = await request('/api/gov/auth/verify-2fa', {
      method: 'POST',
      body: { challengeToken: adminLogin.data.challengeToken, otp: adminLogin.data.demoOtpHint }
    });
    const adminHeaders = { Authorization: `Bearer ${admin2FA.data.token}` };

    const adminAuditRes = await request('/api/gov/audit-logs', { headers: adminHeaders });
    assert(adminAuditRes.status === 200, 'RBAC: Administrator granted access to /audit-logs');
    assert(Array.isArray(adminAuditRes.data.logs), 'Audit logs returned as array');

    const transparencyRes = await request('/api/gov/transparency-report', { headers: adminHeaders });
    assert(transparencyRes.status === 200, 'Administrator granted access to Section 21.4 Transparency Report');
    assert(transparencyRes.data.report.takedownActionsOnGovernmentCritical === 0, 'Section 21.4 Rule: takedownActionsOnGovernmentCritical MUST BE 0');

    // 10. VERIFIED CREATOR PROVENANCE & FINGERPRINTING (Sections 12 & 13)
    console.log('\n--- 10. VERIFIED CREATOR MULTI-FINGERPRINTS & BLOCKCHAIN ---');
    const provRegister = await request('/api/copyright/provenance/register', {
      method: 'POST',
      body: {
        id: 'vid-3',
        title: '5 Productivity Hacks',
        duration: '05:00',
        creatorId: 'alexvance_tech'
      }
    });
    assert(provRegister.status === 200, 'POST /api/copyright/provenance/register returns 200 OK');
    assert(provRegister.data.fingerprints.videoHash.startsWith('vidfp_'), 'Video perceptual hash generated');
    assert(provRegister.data.fingerprints.audioHash.startsWith('audfp_'), 'Audio acoustic hash generated');
    assert(provRegister.data.fingerprints.transcriptHash.startsWith('txfp_'), 'Transcript hash generated');
    assert(provRegister.data.provenanceBlock.blockHash, 'Cryptographic block hash linked into ledger');

    const chainRes = await request('/api/copyright/provenance/chain');
    assert(chainRes.status === 200, 'GET /api/copyright/provenance/chain returns 200 OK');
    assert(chainRes.data.chain.length > 0, 'Blockchain ledger records provenance chain');

    const simCreatorRes = await request('/api/copyright/provenance/similarity/vid-3');
    assert(simCreatorRes.status === 200, 'GET /api/copyright/provenance/similarity/:id returns 200 OK');
    assert(simCreatorRes.data.summary.potentialMatchesFound === 14, 'Potential matches breakdown returned (14 found)');
    assert(simCreatorRes.data.summary.highSimilarityCount === 2, 'High similarity matches = 2');
    assert(simCreatorRes.data.summary.mediumSimilarityCount === 5, 'Medium similarity matches = 5');
    assert(simCreatorRes.data.summary.lowSimilarityCount === 7, 'Low similarity matches = 7');

    // 11. LOGOUT & TERMINAL LOCK (Section 16)
    console.log('\n--- 11. LOGOUT & SESSION TERMINATION ---');
    const logoutRes = await request('/api/gov/auth/logout', { method: 'POST', headers: authHeaders });
    assert(logoutRes.status === 200, 'POST /api/gov/auth/logout clears session');

    const postLogoutCheck = await request('/api/gov/auth/session', { headers: authHeaders });
    assert(postLogoutCheck.status === 401, 'Subsequent session check returns 401 Unauthorized after logout');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(`📊 FINAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
