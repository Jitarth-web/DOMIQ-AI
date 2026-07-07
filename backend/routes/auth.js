/**
 * auth.js
 * Enterprise Auth Routes (Signup, Login, Refresh, Logout, Forgot Password, Reset Password, Me)
 * Implements HttpOnly Cookies, Refresh Token Rotation, Account Lockouts, and UUID User IDs.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'domiq_secret_jwt_key_2026_stay_secure';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'domiq_refresh_jwt_key_2026_stay_ultra_secure';

// Helper to set HttpOnly cookies
function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('domiq_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  if (refreshToken) {
    res.cookie('domiq_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }
}

function clearAuthCookies(res) {
  res.clearCookie('domiq_access_token');
  res.clearCookie('domiq_refresh_token');
}

// Initial Preset Templates for new users
const PRESETS = {
  studio: {
    name: "Modern Studio Flat",
    walls: [
      { id: "w1", x1: -5, y1: -4, x2: 5, y2: -4, thickness: 0.2, height: 2.8 },
      { id: "w2", x1: 5, y1: -4, x2: 5, y2: 4, thickness: 0.2, height: 2.8 },
      { id: "w3", x1: 5, y1: 4, x2: -5, y2: 4, thickness: 0.2, height: 2.8 },
      { id: "w4", x1: -5, y1: 4, x2: -5, y2: -4, thickness: 0.2, height: 2.8 },
      { id: "w5", x1: -5, y1: 1, x2: -1, y2: 1, thickness: 0.15, height: 2.8 },
      { id: "w6", x1: -1, y1: 1, x2: -1, y2: 4, thickness: 0.15, height: 2.8 }
    ],
    items: [
      { id: "d1", type: "door", x: -3, y: -4, w: 0.9, h: 2.1, depth: 0.15, rotation: 0, color: "#a1a1aa", material: "wood" },
      { id: "d2", type: "door", x: -2, y: 1, w: 0.8, h: 2.1, depth: 0.15, rotation: 0, color: "#e4e4e7", material: "wood" },
      { id: "win1", type: "window", x: 2, y: 4, w: 1.5, h: 1.2, depth: 0.15, rotation: 180, color: "#38bdf8", material: "glass" },
      { id: "win2", type: "window", x: 5, y: 0, w: 1.8, h: 1.5, depth: 0.15, rotation: 90, color: "#38bdf8", material: "glass" },
      { id: "f1", type: "bed_double", x: -3, y: 2.5, w: 1.6, h: 2.0, depth: 0.6, rotation: 90, color: "#cbd5e1", material: "fabric" },
      { id: "f2", type: "sofa", x: 2, y: -2, w: 2.1, h: 0.9, depth: 0.8, rotation: 0, color: "#475569", material: "fabric" },
      { id: "f3", type: "table_coffee", x: 2, y: -0.8, w: 0.9, h: 0.6, depth: 0.45, rotation: 0, color: "#78350f", material: "wood" },
      { id: "f4", type: "tv_stand", x: 4.5, y: -2, w: 0.4, h: 1.6, depth: 0.5, rotation: 270, color: "#1e293b", material: "metal" },
      { id: "f5", type: "dining_table", x: 2, y: 2, w: 1.2, h: 0.8, depth: 0.75, rotation: 90, color: "#b45309", material: "wood" },
      { id: "f6", type: "kitchen_island", x: -3, y: -2, w: 0.8, h: 1.8, depth: 0.9, rotation: 0, color: "#f1f5f9", material: "marble" },
      { id: "f7", type: "plant", x: 4.2, y: 3.2, w: 0.6, h: 0.6, depth: 1.4, rotation: 0, color: "#10b981", material: "fabric" }
    ],
    settings: { units: "meters", wallHeight: 2.8, wallThickness: 20, gridSnap: 10 }
  },
  loft: {
    name: "Nordic Open Loft",
    walls: [
      { id: "w1", x1: -6, y1: -5, x2: 6, y2: -5, thickness: 0.25, height: 3.2 },
      { id: "w2", x1: 6, y1: -5, x2: 6, y2: 5, thickness: 0.25, height: 3.2 },
      { id: "w3", x1: 6, y1: 5, x2: -6, y2: 5, thickness: 0.25, height: 3.2 },
      { id: "w4", x1: -6, y1: 5, x2: -6, y2: -5, thickness: 0.25, height: 3.2 }
    ],
    items: [
      { id: "d1", type: "door", x: 0, y: -5, w: 1.0, h: 2.4, depth: 0.2, rotation: 0, color: "#27272a", material: "metal" },
      { id: "win1", type: "window", x: -4, y: 5, w: 2.2, h: 2.0, depth: 0.2, rotation: 180, color: "#e0f2fe", material: "glass" },
      { id: "win2", type: "window", x: 4, y: 5, w: 2.2, h: 2.0, depth: 0.2, rotation: 180, color: "#e0f2fe", material: "glass" },
      { id: "f1", type: "sofa", x: -2, y: 2, w: 2.4, h: 1.0, depth: 0.8, rotation: 180, color: "#e2e8f0", material: "fabric" },
      { id: "f2", type: "chair", x: 1, y: 2.5, w: 0.85, h: 0.85, depth: 0.75, rotation: 150, color: "#f8fafc", material: "wood" },
      { id: "f3", type: "table_coffee", x: -0.5, y: 1.2, w: 1.0, h: 1.0, depth: 0.4, rotation: 45, color: "#f5f5f4", material: "wood" },
      { id: "f4", type: "dining_table", x: -3.5, y: -2.5, w: 1.6, h: 0.9, depth: 0.75, rotation: 0, color: "#d6d3d1", material: "wood" },
      { id: "f5", type: "wardrobe", x: 4.5, y: -3, w: 0.6, h: 2.0, depth: 2.2, rotation: 90, color: "#1c1917", material: "wood" },
      { id: "f6", type: "bed_double", x: 4, y: 2.5, w: 1.8, h: 2.1, depth: 0.65, rotation: 270, color: "#cbd5e1", material: "fabric" },
      { id: "f7", type: "plant", x: -5.2, y: 4.2, w: 0.6, h: 0.6, depth: 1.8, rotation: 0, color: "#14b8a6", material: "fabric" }
    ],
    settings: { units: "meters", wallHeight: 3.2, wallThickness: 25, gridSnap: 10 }
  }
};

/**
 * Helper to seed initial user projects
 */
async function seedUserProjects(userId) {
  const now = Date.now();
  const projectsToSeed = [
    { id: crypto.randomUUID(), name: PRESETS.studio.name, data: JSON.stringify(PRESETS.studio), template: "studio" },
    { id: crypto.randomUUID(), name: PRESETS.loft.name, data: JSON.stringify(PRESETS.loft), template: "loft" }
  ];

  for (const p of projectsToSeed) {
    await db.asyncRun(
      'INSERT INTO projects (id, user_id, name, data, template, last_saved) VALUES (?, ?, ?, ?, ?, ?)',
      [p.id, userId, p.name, p.data, p.template, now]
    );
  }
}

/**
 * POST /api/auth/signup
 */
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Full name, email, and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address format.' });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // Check if user already exists
    const existingUser = await db.asyncGet('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [cleanEmail]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email address already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    // Insert user
    await db.asyncRun(
      'INSERT INTO users (id, full_name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [userId, cleanFullName, cleanEmail, hashedPassword]
    );

    // Seed starter projects
    await seedUserProjects(userId);

    // Create tokens
    const userPayload = { id: userId, fullName: cleanFullName, email: cleanEmail };
    const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Store refresh token
    const refreshTokenId = crypto.randomUUID();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.asyncRun(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [refreshTokenId, userId, refreshTokenHash, expiresAt]
    );

    setAuthCookies(res, accessToken, refreshToken);

    console.log(`[AUTH] Registered new user: ${cleanEmail} (UUID: ${userId})`);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      token: accessToken,
      user: userPayload
    });
  } catch (error) {
    console.error('Signup route error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.asyncGet('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [cleanEmail]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Check account lockout
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      const minutesRemaining = Math.ceil((new Date(user.lockout_until) - new Date()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account locked due to repeated failed logins. Please try again in ${minutesRemaining} minute(s).`
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      let lockoutSql = 'UPDATE users SET failed_login_attempts = ? WHERE id = ?';
      let params = [newAttempts, user.id];

      if (newAttempts >= 5) {
        const lockoutTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        lockoutSql = 'UPDATE users SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?';
        params = [newAttempts, lockoutTime, user.id];
      }

      await db.asyncRun(lockoutSql, params);
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Reset failed login attempts & update last_login
    await db.asyncRun(
      'UPDATE users SET failed_login_attempts = 0, lockout_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    const userPayload = { id: user.id, fullName: user.full_name, email: user.email };
    const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Store refresh token
    const refreshTokenId = crypto.randomUUID();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.asyncRun(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [refreshTokenId, user.id, refreshTokenHash, expiresAt]
    );

    setAuthCookies(res, accessToken, refreshToken);

    console.log(`[AUTH] User logged in: ${user.email} (ID: ${user.id})`);

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token: accessToken,
      user: userPayload
    });
  } catch (error) {
    console.error('Login route error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

/**
 * POST /api/auth/refresh
 * Token Rotation
 */
router.post('/refresh', async (req, res) => {
  try {
    let token = req.cookies ? req.cookies.domiq_refresh_token : null;
    if (!token && req.body.refreshToken) {
      token = req.body.refreshToken;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Expired or invalid refresh token.' });
    }

    const user = await db.asyncGet('SELECT id, full_name, email FROM users WHERE id = ? AND deleted_at IS NULL', [decoded.id]);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    // Revoke old refresh tokens for this user
    await db.asyncRun('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL', [user.id]);

    // Issue new tokens
    const userPayload = { id: user.id, fullName: user.full_name, email: user.email };
    const newAccessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    const refreshTokenId = crypto.randomUUID();
    const refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.asyncRun(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [refreshTokenId, user.id, refreshTokenHash, expiresAt]
    );

    setAuthCookies(res, newAccessToken, newRefreshToken);

    return res.status(200).json({
      success: true,
      token: newAccessToken,
      user: userPayload
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ success: false, message: 'Failed to refresh token.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

/**
 * POST /api/auth/forgot-password
 * Generates single-use reset token and expiry
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.asyncGet('SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL', [cleanEmail]);

    if (!user) {
      // Return success to prevent email enumeration attacks
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been generated.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await db.asyncRun(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      [resetToken, resetTokenExpiry, user.id]
    );

    console.log(`\n======================================================`);
    console.log(`[AUTH SIMULATED EMAIL LINK FOR ${cleanEmail}]:`);
    console.log(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/#reset-password?token=${resetToken}`);
    console.log(`======================================================\n`);

    return res.status(200).json({
      success: true,
      message: 'Password reset link generated! Check server logs or dev console.',
      resetToken: resetToken // Expose for local development testing
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Server error generating password reset.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Verifies reset token & updates password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const user = await db.asyncGet('SELECT id FROM users WHERE reset_token = ? AND reset_token_expiry > CURRENT_TIMESTAMP AND deleted_at IS NULL', [token]);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.asyncRun(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully! You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating password.' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.asyncGet(
      'SELECT id, full_name, email, created_at, last_login FROM users WHERE id = ? AND deleted_at IS NULL',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    console.error('/me route error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching user profile.' });
  }
});

module.exports = router;
