const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const db = require('../config/db');

// Get pending suggestions
router.get('/suggestions/pending', auth, checkRole(['admin']), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM book_suggestions
       WHERE status = 'pending'
       ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// Update suggestion status
router.put('/suggestions/:id/status', auth, checkRole(['admin']), async (req, res) => {
    try {
        const { status, reason } = req.body;
        const result = await db.query(
            `UPDATE book_suggestions
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
            [status, req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }

        // Optionally, send a notification, etc.
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
