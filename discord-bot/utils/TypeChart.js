/**
 * Pokemon Type Effectiveness Chart
 * Returns damage multipliers (0x, 0.5x, 1x, 2x)
 */

const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

/**
 * Calculate damage multiplier for a type matchup
 * @param {string} attackingType - The attacking Pokemon's move type
 * @param {string[]} defendingTypes - The defending Pokemon's types
 * @returns {number} - Damage multiplier
 */
function getTypeMultiplier(attackingType, defendingTypes) {
  let multiplier = 1.0;
  const effectiveness = TYPE_CHART[attackingType.toLowerCase()] || {};
  
  for (const defType of defendingTypes) {
    const modifier = effectiveness[defType.toLowerCase()];
    if (modifier !== undefined) {
      multiplier *= modifier;
    }
  }
  
  return multiplier;
}

/**
 * Get weaknesses for a Pokemon's types
 * @param {string[]} types - Pokemon's types
 * @returns {Object} - Weaknesses (2x), resistances (0.5x), immunities (0x)
 */
function getTypeMatchups(types) {
  const weaknesses = [];
  const resistances = [];
  const immunities = [];
  
  const allTypes = Object.keys(TYPE_CHART);
  
  for (const attackType of allTypes) {
    const multiplier = getTypeMultiplier(attackType, types);
    
    if (multiplier === 0) {
      immunities.push(attackType);
    } else if (multiplier >= 2) {
      weaknesses.push({ type: attackType, multiplier });
    } else if (multiplier <= 0.5) {
      resistances.push({ type: attackType, multiplier });
    }
  }
  
  return { weaknesses, resistances, immunities };
}

module.exports = {
  TYPE_CHART,
  getTypeMultiplier,
  getTypeMatchups
};
