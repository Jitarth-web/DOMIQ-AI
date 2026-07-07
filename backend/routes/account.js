/**
 * account.js
 * User Account Management Endpoints (Profile, Password Change, Soft Delete Account)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * GET /api/account
 * Get user account details and workspace summary stats
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await db.asyncGet(
      'SELECT id, full_name, email, created_at, last_login FROM users WHERE id = ? AND deleted_at IS NULL',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const projectCountRow = await db.asyncGet(
      'SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND deleted_at IS NULL',
      [req.user.id]
    );

    const renderCountRow = await db.asyncGet(
      'SELECT COUNT(*) as count FROM renders WHERE user_id = ? AND deleted_at IS NULL',
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      account: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        stats: {
          totalProjects: projectCountRow ? projectCountRow.count : 0,
          totalRenders: renderCountRow ? renderCountRow.count : 0
        }
      }
    });
  } catch (error) {
    console.error('Get account error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving account.' });
  }
});

/**
 * PATCH /api/account
 * Update account profile info
 */
router.patch('/', authMiddleware, async (req, res) => {
  try {
    const { fullName } = req.body;
    if (!fullName) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }

    const cleanFullName = fullName.trim();
    await db.asyncRun(
      'UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [cleanFullName, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Account profile updated successfully.',
      user: { id: req.user.id, fullName: cleanFullName, email: req.user.email }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating account.' });
  }
});

/**
 * PATCH /api/account/password
 * Secure authenticated password change
 */
router.patch('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }

    const user = await db.asyncGet('SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect current password.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.asyncRun(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully!'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Server error changing password.' });
  }
});

/**
 * DELETE /api/account
 * Soft delete account
 */
router.delete('/', authMiddleware, async (req, res) => {
  try {
    await db.asyncRun('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.user.id]);
    await db.asyncRun('UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = ?', [req.user.id]);

    res.clearCookie('domiq_access_token');
    res.clearCookie('domiq_refresh_token');

    return res.status(200).json({
      success: true,
      message: 'Account and associated workspace data have been deactivated successfully.'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting account.' });
  }
});

module.exports = router;
