/**
 * projects.js
 * User-isolated Projects CRUD & Version History endpoints.
 * Enforces strict user_id filtering, UUIDs, soft deletes, and project versioning.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

// Require authentication for all project routes
router.use(authMiddleware);

/**
 * GET /api/projects
 * List all non-deleted projects for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const rows = await db.asyncAll(
      'SELECT id, name, template, last_saved, created_at, updated_at FROM projects WHERE user_id = ? AND deleted_at IS NULL ORDER BY last_saved DESC',
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      projects: rows.map(r => ({
        id: r.id,
        name: r.name,
        template: r.template,
        lastSaved: r.last_saved,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
    });
  } catch (error) {
    console.error('List projects error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve projects.' });
  }
});

/**
 * GET /api/projects/:id
 * Retrieve single project details if owned by user
 */
router.get('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await db.asyncGet(
      'SELECT * FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [projectId, req.user.id]
    );

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found or access denied.' });
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(project.data);
    } catch (e) {
      parsedData = {};
    }

    return res.status(200).json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        template: project.template,
        lastSaved: project.last_saved,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        ...parsedData
      }
    });
  } catch (error) {
    console.error('Get project error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving project.' });
  }
});

/**
 * POST /api/projects
 * Save or update a project and create a version snapshot
 */
router.post('/', async (req, res) => {
  try {
    const { id, name, data, template, lastSaved } = req.body;

    if (!name || !data) {
      return res.status(400).json({ success: false, message: 'Project name and layout data are required.' });
    }

    const projectId = id || crypto.randomUUID();
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const saveTimestamp = lastSaved || Date.now();

    // Check if project exists and is owned by this user
    const existing = await db.asyncGet('SELECT id FROM projects WHERE id = ?', [projectId]);

    if (existing) {
      // Verify ownership
      const owned = await db.asyncGet('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, req.user.id]);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Forbidden. You do not own this project.' });
      }

      await db.asyncRun(
        'UPDATE projects SET name = ?, data = ?, template = ?, last_saved = ?, updated_at = CURRENT_TIMESTAMP, deleted_at = NULL WHERE id = ? AND user_id = ?',
        [name, dataString, template || null, saveTimestamp, projectId, req.user.id]
      );
    } else {
      await db.asyncRun(
        'INSERT INTO projects (id, user_id, name, data, template, last_saved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [projectId, req.user.id, name, dataString, template || null, saveTimestamp]
      );
    }

    // Create version snapshot
    const versionId = crypto.randomUUID();
    await db.asyncRun(
      'INSERT INTO project_versions (id, project_id, user_id, snapshot) VALUES (?, ?, ?, ?)',
      [versionId, projectId, req.user.id, dataString]
    );

    return res.status(200).json({
      success: true,
      message: 'Project saved successfully.',
      projectId: projectId,
      versionId: versionId,
      lastSaved: saveTimestamp
    });
  } catch (error) {
    console.error('Save project error:', error);
    return res.status(500).json({ success: false, message: 'Server error saving project.' });
  }
});

/**
 * DELETE /api/projects/:id
 * Soft delete project
 */
router.delete('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const owned = await db.asyncGet('SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [projectId, req.user.id]);
    if (!owned) {
      return res.status(404).json({ success: false, message: 'Project not found or access denied.' });
    }

    await db.asyncRun('UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [projectId, req.user.id]);

    return res.status(200).json({
      success: true,
      message: 'Project moved to trash.'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting project.' });
  }
});

/**
 * GET /api/projects/:id/versions
 * List version history snapshots for a project
 */
router.get('/:id/versions', async (req, res) => {
  try {
    const projectId = req.params.id;
    const versions = await db.asyncAll(
      'SELECT id, created_at FROM project_versions WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 20',
      [projectId, req.user.id]
    );

    return res.status(200).json({
      success: true,
      versions: versions
    });
  } catch (error) {
    console.error('List project versions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve version history.' });
  }
});

/**
 * POST /api/projects/:id/restore/:versionId
 * Restore project state from a previous snapshot version
 */
router.post('/:id/restore/:versionId', async (req, res) => {
  try {
    const { id, versionId } = req.params;

    const versionRow = await db.asyncGet(
      'SELECT snapshot FROM project_versions WHERE id = ? AND project_id = ? AND user_id = ?',
      [versionId, id, req.user.id]
    );

    if (!versionRow) {
      return res.status(404).json({ success: false, message: 'Version snapshot not found.' });
    }

    const now = Date.now();
    await db.asyncRun(
      'UPDATE projects SET data = ?, last_saved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [versionRow.snapshot, now, id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Project restored to selected version successfully.',
      lastSaved: now
    });
  } catch (error) {
    console.error('Restore project version error:', error);
    return res.status(500).json({ success: false, message: 'Failed to restore project version.' });
  }
});


/**
 * GET /api/projects/:id/snapshots
 * List visual snapshots for a project
 */
router.get('/:id/snapshots', async (req, res) => {
  try {
    const projectId = req.params.id;
    const snapshots = await db.asyncAll(
      'SELECT id, name, thumbnail, floor_name, created_at FROM project_snapshots WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC',
      [projectId, req.user.id]
    );

    return res.status(200).json({
      success: true,
      snapshots: snapshots
    });
  } catch (error) {
    console.error('List project snapshots error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve snapshots.' });
  }
});

/**
 * POST /api/projects/:id/snapshots
 * Create a new visual snapshot
 */
router.post('/:id/snapshots', async (req, res) => {
  try {
    const projectId = req.params.id;
    const { name, snapshot, thumbnail, floorName } = req.body;
    const snapshotId = crypto.randomUUID();

    await db.asyncRun(
      'INSERT INTO project_snapshots (id, project_id, user_id, name, snapshot, thumbnail, floor_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [snapshotId, projectId, req.user.id, name, snapshot, thumbnail, floorName]
    );

    return res.status(200).json({
      success: true,
      snapshotId: snapshotId
    });
  } catch (error) {
    console.error('Create project snapshot error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create snapshot.' });
  }
});

/**
 * PUT /api/projects/:id/snapshots/:snapshotId
 * Rename an existing snapshot
 */
router.put('/:id/snapshots/:snapshotId', async (req, res) => {
  try {
    const { id, snapshotId } = req.params;
    const { name } = req.body;

    await db.asyncRun(
      'UPDATE project_snapshots SET name = ? WHERE id = ? AND project_id = ? AND user_id = ?',
      [name, snapshotId, id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Snapshot renamed successfully.'
    });
  } catch (error) {
    console.error('Rename project snapshot error:', error);
    return res.status(500).json({ success: false, message: 'Failed to rename snapshot.' });
  }
});

/**
 * DELETE /api/projects/:id/snapshots/:snapshotId
 * Delete a snapshot
 */
router.delete('/:id/snapshots/:snapshotId', async (req, res) => {
  try {
    const { id, snapshotId } = req.params;

    await db.asyncRun(
      'DELETE FROM project_snapshots WHERE id = ? AND project_id = ? AND user_id = ?',
      [snapshotId, id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Snapshot deleted successfully.'
    });
  } catch (error) {
    console.error('Delete project snapshot error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete snapshot.' });
  }
});

/**
 * POST /api/projects/:id/snapshots/:snapshotId/duplicate
 * Duplicate an existing snapshot
 */
router.post('/:id/snapshots/:snapshotId/duplicate', async (req, res) => {
  try {
    const { id, snapshotId } = req.params;

    const original = await db.asyncGet(
      'SELECT name, snapshot, thumbnail, floor_name FROM project_snapshots WHERE id = ? AND project_id = ? AND user_id = ?',
      [snapshotId, id, req.user.id]
    );

    if (!original) {
      return res.status(404).json({ success: false, message: 'Snapshot not found.' });
    }

    const newId = crypto.randomUUID();
    const newName = `${original.name} Copy`;

    await db.asyncRun(
      'INSERT INTO project_snapshots (id, project_id, user_id, name, snapshot, thumbnail, floor_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newId, id, req.user.id, newName, original.snapshot, original.thumbnail, original.floor_name]
    );

    return res.status(200).json({
      success: true,
      snapshotId: newId,
      message: 'Snapshot duplicated successfully.'
    });
  } catch (error) {
    console.error('Duplicate project snapshot error:', error);
    return res.status(500).json({ success: false, message: 'Failed to duplicate snapshot.' });
  }
});

/**
 * POST /api/projects/:id/snapshots/:snapshotId/restore
 * Restore project layout state from a visual snapshot
 */
router.post('/:id/snapshots/:snapshotId/restore', async (req, res) => {
  try {
    const { id, snapshotId } = req.params;

    const snapshotRow = await db.asyncGet(
      'SELECT snapshot FROM project_snapshots WHERE id = ? AND project_id = ? AND user_id = ?',
      [snapshotId, id, req.user.id]
    );

    if (!snapshotRow) {
      return res.status(404).json({ success: false, message: 'Snapshot not found.' });
    }

    const now = Date.now();
    await db.asyncRun(
      'UPDATE projects SET data = ?, last_saved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [snapshotRow.snapshot, now, id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Project restored to selected snapshot successfully.',
      lastSaved: now
    });
  } catch (error) {
    console.error('Restore project snapshot error:', error);
    return res.status(500).json({ success: false, message: 'Failed to restore snapshot.' });
  }
});

module.exports = router;

