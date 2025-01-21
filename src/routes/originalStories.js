const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const db = require('../config/db');

// Submit an original story
router.post('/', auth, async (req, res) => {
    try {
        const {
            title, synopsis, genre, manuscriptUrl
        } = req.body;

        const result = await db.query(
            `INSERT INTO original_stories
       (title, synopsis, genre, manuscript_url, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [title, synopsis, genre, manuscriptUrl, req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// (Optional) get all original stories by the user
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM original_stories
       WHERE user_id = $1
       ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
