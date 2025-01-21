const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, username, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (email, password_hash, username, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, role`,
            [email, hashedPassword, username, role]
        );

        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            user,
            token
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await db.query(
            `SELECT * FROM users WHERE email = $1`,
            [email]
        );
        const user = result.rows[0];
        if (!user) {
            throw new Error('Invalid login credentials');
        }
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            throw new Error('Invalid login credentials');
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role
            },
            token
        });
    } catch (error) {
        console.error(error);
        res.status(401).json({ error: error.message });
    }
});

module.exports = router;
