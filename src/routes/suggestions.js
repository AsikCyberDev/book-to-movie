const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const db = require('../config/db');

// Create suggestion
router.post('/', auth, async (req, res) => {
    try {
        const {
            title, author, isbn, asin, coverImageUrl,
            synopsis, pitch, genre, publicationYear, pageCount
        } = req.body;

        const result = await db.query(
            `INSERT INTO book_suggestions
       (title, author, isbn, asin, cover_image_url, synopsis, pitch, genre, publication_year, page_count, suggested_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
            [
                title, author, isbn, asin, coverImageUrl,
                synopsis, pitch, genre, publicationYear, pageCount,
                req.user.id
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// List suggestions (basic; no pagination in code snippet)
router.get('/', async (req, res) => {
    try {
        const { genre, status, sortBy = 'created_at' } = req.query;
        let query = 'SELECT * FROM book_suggestions WHERE 1=1';
        const params = [];

        if (genre) {
            params.push(genre);
            query += ` AND $${params.length} = ANY(genre)`;
        }
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        // Sort
        if (sortBy === 'upvotes') {
            query += ' ORDER BY upvote_count DESC';
        } else if (sortBy === 'title') {
            query += ' ORDER BY title ASC';
        } else {
            query += ' ORDER BY created_at DESC';
        }

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// Get single suggestion
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM book_suggestions WHERE id = $1',
            [req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// Update suggestion (owner or admin can do it)
router.put('/:id', auth, async (req, res) => {
    try {
        // Check if the user is the owner or an admin
        const suggestionRes = await db.query(
            'SELECT suggested_by FROM book_suggestions WHERE id = $1',
            [req.params.id]
        );
        if (!suggestionRes.rows.length) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }
        const { suggested_by } = suggestionRes.rows[0];
        if (suggested_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const {
            title, author, synopsis, pitch, genre, publicationYear, pageCount
        } = req.body;

        const result = await db.query(
            `UPDATE book_suggestions
         SET title = COALESCE($1, title),
             author = COALESCE($2, author),
             synopsis = COALESCE($3, synopsis),
             pitch = COALESCE($4, pitch),
             genre = COALESCE($5, genre),
             publication_year = COALESCE($6, publication_year),
             page_count = COALESCE($7, page_count),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING *`,
            [
                title, author, synopsis, pitch, genre, publicationYear,
                pageCount, req.params.id
            ]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// Upvote a suggestion
router.post('/:id/upvote', auth, async (req, res) => {
    try {
        // Insert into upvotes
        await db.query(
            `INSERT INTO upvotes (user_id, suggestion_id)
       VALUES ($1, $2)`,
            [req.user.id, req.params.id]
        );
        // Increase upvote count
        await db.query(
            `UPDATE book_suggestions
       SET upvote_count = upvote_count + 1
       WHERE id = $1`,
            [req.params.id]
        );

        res.status(201).json({ message: 'Upvote recorded' });
    } catch (error) {
        if (error.code === '23505') {
            // unique_violation => user already upvoted
            return res.status(409).json({ error: 'Already upvoted' });
        }
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// Remove an upvote
router.delete('/:id/upvote', auth, async (req, res) => {
    try {
        // remove from upvotes
        const result = await db.query(
            `DELETE FROM upvotes
       WHERE user_id = $1 AND suggestion_id = $2
       RETURNING *`,
            [req.user.id, req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Upvote not found' });
        }
        // Decrease upvote count
        await db.query(
            `UPDATE book_suggestions
       SET upvote_count = GREATEST(upvote_count - 1, 0)
       WHERE id = $1`,
            [req.params.id]
        );
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
