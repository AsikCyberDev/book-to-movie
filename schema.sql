-- schema.sql
--
-- Book-to-Movie Platform Database Schema
-- --------------------------------------
-- 1) Requires pgcrypto extension for UUID generation
-- 2) Drops existing tables in proper order
-- 3) Creates tables: users, book_suggestions, upvotes, comments, notifications, original_stories
-- 4) Adds indexes and full-text search
-- 5) Creates base views (featured_suggestions, user_reputation)
-- 6) Creates a materialized view (trending_genres)
-- --------------------------------------

-- 1) Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) Drop existing tables if they exist (in correct order to handle dependencies)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS upvotes CASCADE;
DROP TABLE IF EXISTS original_stories CASCADE;
DROP TABLE IF EXISTS book_suggestions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 3) Create tables

-- 3.1) users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('reader', 'director', 'admin')),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.2) book_suggestions
CREATE TABLE book_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(13),
    asin VARCHAR(10),
    cover_image_url TEXT,
    synopsis TEXT,
    pitch TEXT NOT NULL,
    genre TEXT[] NOT NULL,
    publication_year INTEGER,
    page_count INTEGER,
    suggested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    upvote_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'featured', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.3) upvotes
CREATE TABLE upvotes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    suggestion_id UUID REFERENCES book_suggestions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, suggestion_id)
);

-- 3.4) comments
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suggestion_id UUID NOT NULL REFERENCES book_suggestions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.5) notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('comment', 'upvote', 'status_change', 'featured')),
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.6) original_stories
CREATE TABLE original_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    synopsis TEXT NOT NULL,
    genre TEXT[],
    manuscript_url TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4) Create indexes for performance

-- book_suggestions
CREATE INDEX idx_book_suggestions_suggested_by
    ON book_suggestions(suggested_by);

CREATE INDEX idx_book_suggestions_status
    ON book_suggestions(status);

CREATE INDEX idx_book_suggestions_created_at
    ON book_suggestions(created_at DESC);

CREATE INDEX idx_book_suggestions_upvote_count
    ON book_suggestions(upvote_count DESC);

CREATE INDEX idx_book_suggestions_genre
    ON book_suggestions USING GIN (genre);

-- upvotes
CREATE INDEX idx_upvotes_suggestion_id
    ON upvotes(suggestion_id);

CREATE INDEX idx_upvotes_created_at
    ON upvotes(created_at DESC);

-- comments
CREATE INDEX idx_comments_suggestion_id
    ON comments(suggestion_id);

CREATE INDEX idx_comments_created_at
    ON comments(created_at DESC);

CREATE INDEX idx_comments_user_suggestion
    ON comments(user_id, suggestion_id);

-- notifications
CREATE INDEX idx_notifications_user_id
    ON notifications(user_id);

CREATE INDEX idx_notifications_read
    ON notifications(read);

CREATE INDEX idx_notifications_created_at
    ON notifications(created_at DESC);

CREATE INDEX idx_notifications_user_read
    ON notifications(user_id, read);

-- 5) Add full-text search to book_suggestions

ALTER TABLE book_suggestions
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(author, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(synopsis, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(pitch, '')), 'D')
    ) STORED;

CREATE INDEX idx_book_suggestions_search
    ON book_suggestions
    USING GIST (search_vector);

-- 6) Base views for common operations

-- 6.1) featured_suggestions
CREATE OR REPLACE VIEW featured_suggestions AS
SELECT
    bs.*,
    u.username AS suggester_username,
    COUNT(DISTINCT c.id) AS comment_count
FROM book_suggestions bs
JOIN users u
    ON bs.suggested_by = u.id
LEFT JOIN comments c
    ON bs.id = c.suggestion_id
WHERE bs.status = 'featured'
GROUP BY bs.id, u.username;

-- 6.2) user_reputation
CREATE OR REPLACE VIEW user_reputation AS
SELECT
    u.id,
    u.username,
    u.role,
    COUNT(DISTINCT bs.id) AS suggestions_made,
    SUM(bs.upvote_count) AS total_suggestion_upvotes,
    COUNT(DISTINCT c.id) AS comments_made,
    COUNT(DISTINCT uv.suggestion_id) AS upvotes_given,
    (
      COUNT(DISTINCT bs.id) * 10 +
      SUM(COALESCE(bs.upvote_count, 0)) * 2 +
      COUNT(DISTINCT c.id) * 3 +
      COUNT(DISTINCT uv.suggestion_id)
    ) AS reputation_score
FROM users u
LEFT JOIN book_suggestions bs ON u.id = bs.suggested_by
LEFT JOIN comments c ON u.id = c.user_id
LEFT JOIN upvotes uv ON u.id = uv.user_id
GROUP BY u.id, u.username, u.role;

-- 7) Materialized view for trending genres
CREATE MATERIALIZED VIEW trending_genres AS
SELECT
    unnest(genre) AS genre_name,
    COUNT(*) AS suggestion_count,
    SUM(upvote_count) AS total_upvotes,
    COUNT(DISTINCT suggested_by) AS unique_suggesters
FROM book_suggestions
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY genre_name
ORDER BY total_upvotes DESC;

CREATE INDEX idx_trending_genres_upvotes
    ON trending_genres(total_upvotes DESC);

COMMIT;
