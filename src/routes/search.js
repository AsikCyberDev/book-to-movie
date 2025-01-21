const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Basic full-text search
router.get('/', async (req, res) => {
    try {
        const { q = '', genre, minUpvotes } = req.query;

        // If q is empty, we can either return all or handle it specially.
        // We'll do a fallback rank for everything if q is empty
        const queryText = q.trim() !== '' ? q.trim() : '';

        let baseQuery = `
      SELECT bs.*,
             ts_rank_cd(search_vector, plainto_tsquery($1)) as rank
      FROM book_suggestions bs
      WHERE ($1 = '' OR search_vector @@ plainto_tsquery($1))
    `;
        const params = [queryText];

        if (genre) {
            params.push(genre);
            baseQuery += ` AND $${params.length} = ANY(genre)`;
        }
        if (minUpvotes) {
            params.push(minUpvotes);
            baseQuery += ` AND upvote_count >= $${params.length}`;
        }

        baseQuery += ` ORDER BY rank DESC, created_at DESC`;

        const result = await db.query(baseQuery, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
