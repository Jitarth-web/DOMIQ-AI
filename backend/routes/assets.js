/**
 * assets.js
 * User-isolated asset management routes (Renders, Blueprints, Exported 3D Models)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

/**
 * GET /api/assets/renders
 * List photorealistic renders for user
 */
router.get('/renders', async (req, res) => {
  try {
    const projectId = req.query.projectId;
    let sql = 'SELECT * FROM renders WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC';
    let params = [req.user.id];

    if (projectId) {
      sql = 'SELECT * FROM renders WHERE user_id = ? AND project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC';
      params = [req.user.id, projectId];
    }

    const rows = await db.asyncAll(sql, params);
    return res.status(200).json({
      success: true,
      renders: rows.map(r => ({
        id: r.id,
        projectId: r.project_id,
        generationId: r.generation_id,
        imageUrl: r.image_url,
        thumbnailUrl: r.thumbnail_url || r.image_url,
        prompt: r.prompt,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    console.error('List renders error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve renders.' });
  }
});

/**
 * POST /api/assets/renders
 * Save generated render metadata
 */
router.post('/renders', async (req, res) => {
  try {
    const { projectId, generationId, imagePath, imageUrl, prompt } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Image URL is required.' });
    }

    const renderId = crypto.randomUUID();
    await db.asyncRun(
      'INSERT INTO renders (id, user_id, project_id, generation_id, image_path, image_url, thumbnail_url, prompt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [renderId, req.user.id, projectId || null, generationId || null, imagePath || imageUrl, imageUrl, imageUrl, prompt || '']
    );

    return res.status(201).json({
      success: true,
      render: { id: renderId, imageUrl, prompt }
    });
  } catch (error) {
    console.error('Save render error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save render asset.' });
  }
});

/**
 * GET /api/assets/blueprints
 */
router.get('/blueprints', async (req, res) => {
  try {
    const rows = await db.asyncAll(
      'SELECT * FROM uploaded_blueprints WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      blueprints: rows
    });
  } catch (error) {
    console.error('List blueprints error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve blueprints.' });
  }
});

/**
 * POST /api/assets/blueprints
 */
router.post('/blueprints', async (req, res) => {
  try {
    const { projectId, imageUrl, filePath } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Blueprint image URL is required.' });
    }

    const blueprintId = crypto.randomUUID();
    await db.asyncRun(
      'INSERT INTO uploaded_blueprints (id, user_id, project_id, file_path, image_url) VALUES (?, ?, ?, ?, ?)',
      [blueprintId, req.user.id, projectId || null, filePath || imageUrl, imageUrl]
    );

    return res.status(201).json({
      success: true,
      blueprint: { id: blueprintId, imageUrl }
    });
  } catch (error) {
    console.error('Save blueprint error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save blueprint.' });
  }
});

module.exports = router;
