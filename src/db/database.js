/**
 * SQLite Database Module for SocialPulse AI
 * Persists OAuth tokens and caching data
 */
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure data directory exists
const dataDir = path.dirname(config.databasePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(config.databasePath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  }
});

// Run schema initialization immediately so SQLite internal queue runs CREATE TABLE before queries
initSchema();

function initSchema() {
  db.serialize(() => {
    // OAuth Tokens Table
    db.run(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        key TEXT PRIMARY KEY,
        access_token TEXT,
        refresh_token TEXT,
        scope TEXT,
        token_type TEXT,
        expiry_date INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Key-Value Cache Table (for persistent query caching)
    db.run(`
      CREATE TABLE IF NOT EXISTS query_cache (
        cache_key TEXT PRIMARY KEY,
        cache_value TEXT,
        expires_at INTEGER
      )
    `);

    // Government Users Table (Section 16 RBAC)
    db.run(`
      CREATE TABLE IF NOT EXISTS gov_users (
        email TEXT PRIMARY KEY,
        name TEXT,
        role TEXT,
        clearance TEXT,
        password_hash TEXT,
        otp_secret TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Government Sessions Table (Section 16 Secure Sessions & Expiration)
    db.run(`
      CREATE TABLE IF NOT EXISTS gov_sessions (
        token TEXT PRIMARY KEY,
        email TEXT,
        role TEXT,
        clearance TEXT,
        ip TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at INTEGER
      )
    `);

    // Government Audit Logs Table (Section 16 & Section 21.4)
    db.run(`
      CREATE TABLE IF NOT EXISTS gov_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        email TEXT,
        role TEXT,
        action TEXT,
        resource TEXT,
        details TEXT,
        ip TEXT
      )
    `);

    // Login Attempt Protection Table (Section 16)
    db.run(`
      CREATE TABLE IF NOT EXISTS gov_login_attempts (
        identifier TEXT PRIMARY KEY,
        failed_attempts INTEGER DEFAULT 0,
        last_attempt INTEGER,
        locked_until INTEGER DEFAULT 0
      )
    `);

    // Content Provenance / Blockchain Ledger Table (Sections 12 & 13)
    db.run(`
      CREATE TABLE IF NOT EXISTS provenance_ledger (
        block_index INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        content_id TEXT,
        creator_id TEXT,
        video_hash TEXT,
        audio_hash TEXT,
        frame_hash TEXT,
        transcript_hash TEXT,
        metadata_hash TEXT,
        prev_block_hash TEXT,
        block_hash TEXT
      )
    `);

    // Narrative Action Audit Table (Section 21.4 Transparency Reporting)
    db.run(`
      CREATE TABLE IF NOT EXISTS narrative_action_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        narrative_id TEXT,
        category TEXT,
        is_government_critical INTEGER,
        action_type TEXT,
        user_email TEXT,
        status TEXT,
        notes TEXT
      )
    `);

    // Seed Default Government Users if not present
    seedDefaultGovUsers();
  });
}

function seedDefaultGovUsers() {
  const defaultUsers = [
    {
      email: 'analyst@socialpulse.gov',
      name: 'Rohan Sharma',
      role: 'Government Analyst',
      clearance: 'LEVEL-3 INGESTION & ANALYSIS',
      password_hash: 'SP-SEC-9942-0XF1A7',
      otp_secret: '202609'
    },
    {
      email: 'defense@socialpulse.gov',
      name: 'Col. Vikram Malhotra',
      role: 'Defense/Threat Analyst',
      clearance: 'LEVEL-4 TACTICAL INTELLIGENCE',
      password_hash: 'DIR-DEF-7721-0X9B44',
      otp_secret: '202609'
    },
    {
      email: 'admin@socialpulse.gov',
      name: 'Dr. Ananya Roy',
      role: 'Administrator',
      clearance: 'LEVEL-5 GOVERNANCE & AUDIT',
      password_hash: 'ADMIN-ROOT-2026-ALPHA',
      otp_secret: '202609'
    },
    {
      email: 'alex@socialpulse.io',
      name: 'Alex Vance',
      role: 'Verified Creator',
      clearance: 'VERIFIED CREATOR CLEARANCE',
      password_hash: 'CREATOR-KEY-2026-X883',
      otp_secret: '202609'
    }
  ];

  // Reset any transient lockout states on server init
  db.run('DELETE FROM gov_login_attempts');

  defaultUsers.forEach((u) => {
    db.run(
      `INSERT OR IGNORE INTO gov_users (email, name, role, clearance, password_hash, otp_secret)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [u.email, u.name, u.role, u.clearance, u.password_hash, u.otp_secret]
    );
  });
}

/**
 * Audit Logging Helper (Section 16 & Section 21)
 */
function logGovAudit({ email, role, action, resource, details, ip }) {
  return new Promise((resolve) => {
    const query = `
      INSERT INTO gov_audit_logs (email, role, action, resource, details, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [
        email || 'system',
        role || 'system',
        action,
        resource || 'api',
        typeof details === 'object' ? JSON.stringify(details) : details || '',
        ip || '127.0.0.1'
      ],
      function (err) {
        if (err) console.error('[AuditLog] Error recording audit log:', err.message);
        resolve(this ? this.lastID : null);
      }
    );
  });
}

/**
 * Fetch Government Audit Logs (Admin only)
 */
function getGovAuditLogs(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM gov_audit_logs ORDER BY timestamp DESC LIMIT ?',
      [limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

/**
 * Section 21.4 Transparency Reporting
 */
function getTransparencyReport() {
  return new Promise((resolve, reject) => {
    const report = {
      generatedAt: new Date().toISOString(),
      narrativesByCategory: {},
      totalGovernmentCritical: 0,
      actionsOnGovernmentCritical: 0,
      takedownActionsOnGovernmentCritical: 0, // Must ALWAYS be 0
      totalActionsLogged: 0,
      auditRecords: []
    };

    db.all('SELECT * FROM narrative_action_audit ORDER BY timestamp DESC LIMIT 50', [], (err, rows) => {
      if (err) return reject(err);
      report.auditRecords = rows || [];
      report.totalActionsLogged = (rows || []).length;
      (rows || []).forEach((r) => {
        if (r.is_government_critical === 1) {
          report.totalGovernmentCritical++;
          if (r.action_type === 'takedown' || r.action_type === 'suppress' || r.action_type === 'restrict') {
            report.takedownActionsOnGovernmentCritical++;
          } else {
            report.actionsOnGovernmentCritical++;
          }
        }
      });
      resolve(report);
    });
  });
}

/**
 * Record Narrative Action in Audit (Section 21)
 */
function recordNarrativeAction({ narrativeId, category, isGovernmentCritical, actionType, userEmail, status, notes }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO narrative_action_audit (narrative_id, category, is_government_critical, action_type, user_email, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [narrativeId, category, isGovernmentCritical ? 1 : 0, actionType, userEmail, status, notes],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      }
    );
  });
}

/**
 * Session Management (Section 16)
 */
function createGovSession({ token, email, role, clearance, ip, durationMinutes = 60 }) {
  const expiresAt = Date.now() + durationMinutes * 60 * 1000;
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO gov_sessions (token, email, role, clearance, ip, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [token, email, role, clearance, ip, expiresAt],
      function (err) {
        if (err) return reject(err);
        resolve({ token, email, role, clearance, expiresAt });
      }
    );
  });
}

function getGovSession(token) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM gov_sessions WHERE token = ?', [token], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      // Check if session has expired
      if (row.expires_at < Date.now()) {
        deleteGovSession(token);
        return resolve(null);
      }
      resolve(row);
    });
  });
}

function deleteGovSession(token) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM gov_sessions WHERE token = ?', [token], function (err) {
      if (err) return reject(err);
      resolve({ deleted: this.changes > 0 });
    });
  });
}

/**
 * Login Attempt Protection (Section 16 Brute-force & Lockout Protection)
 */
function checkLoginLockout(identifier) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM gov_login_attempts WHERE identifier = ?', [identifier], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve({ locked: false, attempts: 0 });

      const now = Date.now();
      if (row.locked_until && row.locked_until > now) {
        const remainingSeconds = Math.ceil((row.locked_until - now) / 1000);
        return resolve({ locked: true, remainingSeconds, attempts: row.failed_attempts });
      }
      resolve({ locked: false, attempts: row.failed_attempts });
    });
  });
}

function recordLoginAttempt(identifier, success) {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    if (success) {
      // Reset attempts on successful login
      db.run('DELETE FROM gov_login_attempts WHERE identifier = ?', [identifier], (err) => {
        if (err) return reject(err);
        resolve({ reset: true });
      });
    } else {
      // Increment failed attempts
      db.get('SELECT * FROM gov_login_attempts WHERE identifier = ?', [identifier], (err, row) => {
        if (err) return reject(err);
        const attempts = (row ? row.failed_attempts : 0) + 1;
        // Lock out for 5 minutes after 5 consecutive failed attempts
        const lockedUntil = attempts >= 5 ? now + 5 * 60 * 1000 : 0;

        db.run(
          `INSERT INTO gov_login_attempts (identifier, failed_attempts, last_attempt, locked_until)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(identifier) DO UPDATE SET
             failed_attempts = ?,
             last_attempt = ?,
             locked_until = ?`,
          [identifier, attempts, now, lockedUntil, attempts, now, lockedUntil],
          (err2) => {
            if (err2) return reject(err2);
            resolve({ attempts, lockedUntil });
          }
        );
      });
    }
  });
}

/**
 * Provenance Ledger (Sections 12 & 13)
 */
function addProvenanceBlock(block) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO provenance_ledger (timestamp, content_id, creator_id, video_hash, audio_hash, frame_hash, transcript_hash, metadata_hash, prev_block_hash, block_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        block.timestamp,
        block.contentId,
        block.creatorId,
        block.videoHash,
        block.audioHash,
        block.frameHash,
        block.transcriptHash,
        block.metadataHash,
        block.prevBlockHash,
        block.blockHash
      ],
      function (err) {
        if (err) return reject(err);
        resolve({ blockIndex: this.lastID, ...block });
      }
    );
  });
}

function getProvenanceChain(contentId) {
  return new Promise((resolve, reject) => {
    const query = contentId
      ? 'SELECT * FROM provenance_ledger WHERE content_id = ? ORDER BY block_index ASC'
      : 'SELECT * FROM provenance_ledger ORDER BY block_index DESC LIMIT 50';
    const params = contentId ? [contentId] : [];
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function getGovUserByEmail(email) {
  return new Promise((resolve, reject) => {
    const clean = (email || '').trim().toLowerCase();
    const alias = clean.endsWith('@socialpulse.cyber')
      ? clean.replace('@socialpulse.cyber', '@socialpulse.gov')
      : (clean.endsWith('@socialpulse.gov') ? clean.replace('@socialpulse.gov', '@socialpulse.cyber') : clean);

    db.get('SELECT * FROM gov_users WHERE email = ? OR email = ?', [clean, alias], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Save or update OAuth tokens for a key (e.g. 'google_creator')
 */
function saveToken(key, tokens) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO oauth_tokens (key, access_token, refresh_token, scope, token_type, expiry_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
        scope = COALESCE(excluded.scope, oauth_tokens.scope),
        token_type = COALESCE(excluded.token_type, oauth_tokens.token_type),
        expiry_date = excluded.expiry_date,
        updated_at = CURRENT_TIMESTAMP
    `;
    db.run(
      query,
      [
        key,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.scope || null,
        tokens.token_type || null,
        tokens.expiry_date || null
      ],
      function (err) {
        if (err) return reject(err);
        resolve({ key, changes: this.changes });
      }
    );
  });
}

/**
 * Retrieve OAuth tokens for a key
 */
function getToken(key) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM oauth_tokens WHERE key = ?', [key], (err, row) => {
      if (err) {
        if (err.message && err.message.includes('no such table')) {
          return resolve(null);
        }
        return reject(err);
      }
      if (!row) return resolve(null);
      resolve({
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        scope: row.scope,
        token_type: row.token_type,
        expiry_date: row.expiry_date
      });
    });
  });
}

/**
 * Delete stored tokens
 */
function deleteToken(key) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM oauth_tokens WHERE key = ?', [key], function (err) {
      if (err) return reject(err);
      resolve({ deleted: this.changes > 0 });
    });
  });
}

module.exports = {
  db,
  saveToken,
  getToken,
  deleteToken,
  // Government Intelligence & Security Helpers
  logGovAudit,
  getGovAuditLogs,
  getTransparencyReport,
  recordNarrativeAction,
  createGovSession,
  getGovSession,
  deleteGovSession,
  checkLoginLockout,
  recordLoginAttempt,
  getGovUserByEmail,
  addProvenanceBlock,
  getProvenanceChain
};

