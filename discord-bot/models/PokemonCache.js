const mongoose = require('mongoose');

const pokemonCacheSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  types: [{ type: String }],
  stats: {
    hp: Number,
    attack: Number,
    defense: Number,
    spAttack: Number,
    spDefense: Number,
    speed: Number
  },
  sprite: String,
  spriteShiny: String,
  height: Number,
  weight: Number,
  abilities: [{ type: String }],
  moves: [{ type: String }],
  region: { type: String, default: 'unknown' },
  generation: { type: Number, default: 1 }
});

pokemonCacheSchema.index({ name: 1 });
pokemonCacheSchema.index({ types: 1 });
pokemonCacheSchema.index({ region: 1 });

module.exports = mongoose.model('PokemonCache', pokemonCacheSchema);
