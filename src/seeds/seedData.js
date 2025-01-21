require('dotenv').config(); // load .env if local
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

(async () => {
    try {
        // 1. Run the schema
        const schemaPath = path.join(__dirname, '../../schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
        await db.query(schemaSql);
        console.log('Database schema applied successfully.');

        // 2. Insert dummy data
        // Insert an admin user
        const adminUser = await db.query(
            `INSERT INTO users (email, username, password_hash, role)
       VALUES ('admin@example.com', 'adminUser', '$2a$10$NUB2haGcxvGoCE3hXRIznuB9X/nx54a39NyKXyT7FNn0w.Vh1Rg8O', 'admin')
       RETURNING id`,
        );
        const adminId = adminUser.rows[0].id;

        // Insert a normal reader
        const readerUser = await db.query(
            `INSERT INTO users (email, username, password_hash, role)
       VALUES ('reader@example.com', 'readerUser', '$2a$10$NUB2haGcxvGoCE3hXRIznuB9X/nx54a39NyKXyT7FNn0w.Vh1Rg8O', 'reader')
       RETURNING id`,
        );
        const readerId = readerUser.rows[0].id;

        // Insert a director
        const directorUser = await db.query(
            `INSERT INTO users (email, username, password_hash, role)
       VALUES ('director@example.com', 'directorUser', '$2a$10$NUB2haGcxvGoCE3hXRIznuB9X/nx54a39NyKXyT7FNn0w.Vh1Rg8O', 'director')
       RETURNING id`,
        );
        const directorId = directorUser.rows[0].id;

        // Insert some suggestions
        const suggestion1 = await db.query(
            `INSERT INTO book_suggestions
      (title, author, isbn, pitch, genre, suggested_by, status, upvote_count)
      VALUES
      ('The Great Adventure', 'John Writer', '1234567890123', 'An epic journey awaits...', ARRAY['Adventure','Fantasy'], $1, 'approved', 10)
      RETURNING id`,
            [readerId]
        );

        const suggestion2 = await db.query(
            `INSERT INTO book_suggestions
      (title, author, isbn, pitch, genre, suggested_by, status, upvote_count)
      VALUES
      ('Mysterious Case', 'Jane Investigator', '2345678901234', 'A detective thriller about hidden secrets.', ARRAY['Thriller'], $1, 'pending', 2)
      RETURNING id`,
            [directorId]
        );

        // Insert some comments
        await db.query(
            `INSERT INTO comments (content, user_id, suggestion_id)
       VALUES
       ('Wow, this would be an amazing movie!', $1, $2),
       ('I love the fantasy elements!', $3, $2)`,
            [directorId, suggestion1.rows[0].id, readerId]
        );

        // Insert upvotes
        await db.query(
            `INSERT INTO upvotes (user_id, suggestion_id)
       VALUES ($1, $2)`,
            [directorId, suggestion1.rows[0].id]
        );

        // Insert notifications
        await db.query(
            `INSERT INTO notifications (user_id, type, message)
       VALUES ($1, 'upvote', 'Someone upvoted your suggestion!')`,
            [readerId]
        );

        // Insert original stories
        await db.query(
            `INSERT INTO original_stories (title, synopsis, genre, manuscript_url, user_id, status)
       VALUES
       ('An Original Tale', 'A brand new story set in a whimsical world.', ARRAY['Fantasy'], 'https://example.com/manuscript1.pdf', $1, 'submitted')`,
            [readerId]
        );

        console.log('Dummy data seeded successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
})();
