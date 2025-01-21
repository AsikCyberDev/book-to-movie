const express = require('express');
const { auth } = require('../middleware/auth');
const router = express.Router();
const db = require('../config/db');

// Get current user profile
router.get('/me', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, email, username, role, first_name, last_name, bio, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// Update user profile
router.put('/me', auth, async (req, res) => {
    try {
        const { firstName, lastName, bio } = req.body;
        const result = await db.query(
            `UPDATE users
       SET first_name = $1,
           last_name = $2,
           bio = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, email, username, role, first_name, last_name, bio, created_at, updated_at`,
            [firstName, lastName, bio, req.user.id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// (Optional) Get a user by ID (admin only)
router.get('/:id', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        const result = await db.query(
            `SELECT id, email, username, role, first_name, last_name, bio, created_at
       FROM users
       WHERE id = $1`,
            [userId]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
