const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const budgetRoutes = require('./routes/budgetRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(express.json());

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
