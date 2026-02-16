const mongoose = require('mongoose');

const globalSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  worldBossHp: { type: Number, default: 1000000 },
  currentWeather: { type: String, default: 'clear' },
  seasonStart: { type: Date },
  seasonEnd: { type: Date },
  activeEvents: [{ type: String }],
  dailyBounties: [{
    description: String,
    requirement: mongoose.Schema.Types.Mixed,
    reward: mongoose.Schema.Types.Mixed,
    expiresAt: Date
  }],
  communityBounty: {
    description: String,
    target: Number,
    current: Number,
    reward: mongoose.Schema.Types.Mixed,
    expiresAt: Date
  }
});

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);
