const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const suggestionRoutes = require('./routes/suggestions');
const commentRoutes = require('./routes/comments');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const originalStoryRoutes = require('./routes/originalStories');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/original-stories', originalStoryRoutes);

// Error handler
app.use(errorHandler);

module.exports = app;
