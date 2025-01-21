const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const db = require('../config/db');

// Add comment
router.post('/:suggestionId', auth, async (req, res) => {
    try {
        const { content } = req.body;
        // Check if suggestion exists
        const suggestionRes = await db.query(
            'SELECT id FROM book_suggestions WHERE id = $1',
            [req.params.suggestionId]
        );
        if (!suggestionRes.rows.length) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }
        const result = await db.query(
            `INSERT INTO comments (content, user_id, suggestion_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [content, req.user.id, req.params.suggestionId]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// Get comments for a suggestion
router.get('/:suggestionId', async (req, res) => {
    try {
        const suggestionRes = await db.query(
            'SELECT id FROM book_suggestions WHERE id = $1',
            [req.params.suggestionId]
        );
        if (!suggestionRes.rows.length) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }
        const result = await db.query(
            `SELECT c.*, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE suggestion_id = $1
       ORDER BY created_at DESC`,
            [req.params.suggestionId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
