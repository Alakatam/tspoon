const mongoose = require('mongoose');

const NATURES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
];

const userPokemonSchema = new mongoose.Schema({
  instanceId: { type: String, required: true, unique: true },
  pokemonId: { type: Number, required: true },
  ownerId: { type: String, required: true },
  nickname: { type: String, default: null },
  level: { type: Number, default: 1, min: 1, max: 100 },
  xp: { type: Number, default: 0 },
  ivs: {
    hp: { type: Number, default: 0, min: 0, max: 31 },
    attack: { type: Number, default: 0, min: 0, max: 31 },
    defense: { type: Number, default: 0, min: 0, max: 31 },
    spAttack: { type: Number, default: 0, min: 0, max: 31 },
    spDefense: { type: Number, default: 0, min: 0, max: 31 },
    speed: { type: Number, default: 0, min: 0, max: 31 }
  },
  evs: {
    hp: { type: Number, default: 0, min: 0, max: 252 },
    attack: { type: Number, default: 0, min: 0, max: 252 },
    defense: { type: Number, default: 0, min: 0, max: 252 },
    spAttack: { type: Number, default: 0, min: 0, max: 252 },
    spDefense: { type: Number, default: 0, min: 0, max: 252 },
    speed: { type: Number, default: 0, min: 0, max: 252 }
  },
  nature: { type: String, enum: NATURES, default: 'Hardy' },
  isShiny: { type: Boolean, default: false },
  caughtAt: { type: Date, default: Date.now },
  caughtIn: { type: String, default: 'Poké Ball' }
});

// Indexes
userPokemonSchema.index({ ownerId: 1 });
userPokemonSchema.index({ pokemonId: 1 });
userPokemonSchema.index({ isShiny: 1 });

// Virtual for total IV
userPokemonSchema.virtual('totalIV').get(function() {
  return this.ivs.hp + this.ivs.attack + this.ivs.defense + 
         this.ivs.spAttack + this.ivs.spDefense + this.ivs.speed;
});

// Virtual for IV percentage
userPokemonSchema.virtual('ivPercentage').get(function() {
  return Math.round((this.totalIV / 186) * 100);
});

// Static method to generate random IVs
userPokemonSchema.statics.generateRandomIVs = function() {
  return {
    hp: Math.floor(Math.random() * 32),
    attack: Math.floor(Math.random() * 32),
    defense: Math.floor(Math.random() * 32),
    spAttack: Math.floor(Math.random() * 32),
    spDefense: Math.floor(Math.random() * 32),
    speed: Math.floor(Math.random() * 32)
  };
};

// Static method to get random nature
userPokemonSchema.statics.getRandomNature = function() {
  return NATURES[Math.floor(Math.random() * NATURES.length)];
};

module.exports = mongoose.model('UserPokemon', userPokemonSchema);
module.exports.NATURES = NATURES;
