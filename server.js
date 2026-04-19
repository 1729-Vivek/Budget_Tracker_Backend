const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const budgetRoutes = require('./routes/budgetRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Middleware
app.use(cors(FRONTEND_URL ? { origin: FRONTEND_URL } : undefined));
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.path.startsWith('/api/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  next();
});

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Budget Tracker API is running.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/budget', budgetRoutes);

// Connect to MongoDB
if (!MONGO_URI) {
  console.error('Missing MONGO_URI. Add it to your .env file before starting the server.');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    console.log('Connected to MongoDB');
  })
  .catch((error) => console.log(error));
