const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const db = require('../config/db');

// Get user notifications
router.get('/', auth, async (req, res) => {
    try {
        let query = `SELECT * FROM notifications WHERE user_id = $1`;
        const params = [req.user.id];

        if (req.query.unreadOnly === 'true') {
            query += ` AND read = false`;
        }
        query += ` ORDER BY created_at DESC`;
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE notifications
       SET read = true
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
            [req.params.id, req.user.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
