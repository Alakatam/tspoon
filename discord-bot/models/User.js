const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  balance: { type: Number, default: 1000 },
  items: { type: Map, of: Number, default: {} },
  badges: [{ type: String }],
  questProgress: {
    daily: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    weekly: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
  },
  pokedex: [{ type: Number }],
  totalCatches: { type: Number, default: 0 },
  shinyCatches: { type: Number, default: 0 },
  pityCounter: { type: Number, default: 0 },
  lastDaily: { type: Date },
  lastWeekly: { type: Date },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

// Index for faster queries
userSchema.index({ totalCatches: -1 });
userSchema.index({ shinyCatches: -1 });

module.exports = mongoose.model('User', userSchema);
