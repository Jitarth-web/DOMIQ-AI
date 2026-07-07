/**
 * db.js
 * SQLite Database Connection & Enterprise Schema Initialization for DomIQ AI
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error connecting to SQLite database:', err.message);
  } else {
    console.log('✓ Connected to SQLite database:', dbPath);
  }
});

// Helper for db queries using promises
db.asyncRun = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    this.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

db.asyncGet = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    this.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

db.asyncAll = function(sql, params = []) {
  return new Promise((resolve, reject) => {
    this.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize & Migrate Tables
db.serialize(() => {
  // Check if old incompatible users table exists and migrate if needed
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, table) => {
    if (!err && table) {
      db.all("PRAGMA table_info(users)", (infoErr, columns) => {
        if (!infoErr && columns) {
          const colNames = columns.map(c => c.name);
          const hasFullName = colNames.includes('full_name');
          const hasFailedAttempts = colNames.includes('failed_login_attempts');
          
          if (!hasFullName || !hasFailedAttempts) {
            console.log('[DB MIGRATION] Migrating users table schema...');
            if (!hasFullName) db.run("ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''");
            if (!colNames.includes('failed_login_attempts')) db.run("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0");
            if (!colNames.includes('lockout_until')) db.run("ALTER TABLE users ADD COLUMN lockout_until DATETIME");
            if (!colNames.includes('reset_token')) db.run("ALTER TABLE users ADD COLUMN reset_token TEXT");
            if (!colNames.includes('reset_token_expiry')) db.run("ALTER TABLE users ADD COLUMN reset_token_expiry DATETIME");
            if (!colNames.includes('updated_at')) db.run("ALTER TABLE users ADD COLUMN updated_at DATETIME");
            if (!colNames.includes('last_login')) db.run("ALTER TABLE users ADD COLUMN last_login DATETIME");
            if (!colNames.includes('deleted_at')) db.run("ALTER TABLE users ADD COLUMN deleted_at DATETIME");
          }
        }
      });
    }
  });

  // 1. Users Table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      failed_login_attempts INTEGER DEFAULT 0,
      lockout_until DATETIME,
      reset_token TEXT,
      reset_token_expiry DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      deleted_at DATETIME
    )
  `);

  // 2. Refresh Tokens Table
  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 3. Projects Table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      template TEXT,
      last_saved INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  // 4. Project Versions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS project_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 4b. Project Snapshots Table (extension for Snapshots System)
  db.run(`
    CREATE TABLE IF NOT EXISTS project_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      thumbnail TEXT NOT NULL,
      floor_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);  // 5. Uploaded Blueprints Table
  db.run(`
    CREATE TABLE IF NOT EXISTS uploaded_blueprints (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      file_path TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 6. AI Generations Table
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_generations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      prompt TEXT,
      model TEXT,
      style TEXT,
      camera_angle TEXT,
      room_type TEXT,
      generation_time_ms INTEGER,
      cost_estimate REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 7. Renders Table
  db.run(`
    CREATE TABLE IF NOT EXISTS renders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      generation_id TEXT,
      image_path TEXT NOT NULL,
      image_url TEXT NOT NULL,
      thumbnail_url TEXT,
      prompt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 8. Exported Models Table
  db.run(`
    CREATE TABLE IF NOT EXISTS exported_models (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      file_path TEXT NOT NULL,
      model_url TEXT NOT NULL,
      format TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 9. User Workspace Table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_workspace (
      user_id TEXT PRIMARY KEY,
      chat_history TEXT,
      preferences TEXT,
      saved_renders TEXT,
      activity_log TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 10. Activity Logs Table
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  console.log('✓ Enterprise SQLite Database Schema verified and initialized.');
});

module.exports = db;
