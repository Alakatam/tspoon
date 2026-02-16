const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PokemonCache = require('../models/PokemonCache');
const { getTypeMatchups } = require('../utils/TypeChart');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('affection')
    .setDescription('View type matchups and battle tips for a Pokémon species')
    .addStringOption(option =>
      option.setName('pokemon')
        .setDescription('Pokémon name or Pokédex number')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const input = interaction.options.getString('pokemon').toLowerCase();
      
      // Find Pokemon by name or ID
      let pokemon;
      if (!isNaN(input)) {
        pokemon = await PokemonCache.findOne({ id: parseInt(input) });
      } else {
        pokemon = await PokemonCache.findOne({ 
          name: { $regex: `^${input}`, $options: 'i' } 
        });
      }

      if (!pokemon) {
        return interaction.editReply({
          content: '❌ Pokémon not found. Check the name or Pokédex number.',
          ephemeral: true
        });
      }

      const name = pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1);
      
      // Get type matchups
      const matchups = getTypeMatchups(pokemon.types);

      // Format weaknesses
      let weaknessText = 'None';
      if (matchups.weaknesses.length > 0) {
        weaknessText = matchups.weaknesses
          .sort((a, b) => b.multiplier - a.multiplier)
          .map(w => {
            const typeEmoji = getTypeEmoji(w.type);
            return `${typeEmoji} ${w.type.charAt(0).toUpperCase() + w.type.slice(1)} (${w.multiplier}×)`;
          })
          .join('\n');
      }

      // Format resistances
      let resistText = 'None';
      if (matchups.resistances.length > 0) {
        resistText = matchups.resistances
          .sort((a, b) => a.multiplier - b.multiplier)
          .map(r => {
            const typeEmoji = getTypeEmoji(r.type);
            return `${typeEmoji} ${r.type.charAt(0).toUpperCase() + r.type.slice(1)} (${r.multiplier}×)`;
          })
          .join('\n');
      }

      // Format immunities
      let immuneText = 'None';
      if (matchups.immunities.length > 0) {
        immuneText = matchups.immunities
          .map(t => `${getTypeEmoji(t)} ${t.charAt(0).toUpperCase() + t.slice(1)}`)
          .join('\n');
      }

      // Calculate total base stats
      const totalStats = Object.values(pokemon.stats).reduce((a, b) => a + b, 0);

      // Determine best roles based on stats
      const roles = [];
      if (pokemon.stats.attack > pokemon.stats.spAttack && pokemon.stats.attack > 80) {
        roles.push('Physical Attacker');
      }
      if (pokemon.stats.spAttack > pokemon.stats.attack && pokemon.stats.spAttack > 80) {
        roles.push('Special Attacker');
      }
      if (pokemon.stats.defense > 80 || pokemon.stats.spDefense > 80) {
        roles.push('Defensive');
      }
      if (pokemon.stats.speed > 100) {
        roles.push('Speed Sweeper');
      }
      if (pokemon.stats.hp > 100) {
        roles.push('Tank');
      }

      const embed = new EmbedBuilder()
        .setTitle(`📚 ${name} - Battle Guide`)
        .setThumbnail(pokemon.sprite)
        .setColor(getTypeColor(pokemon.types[0]))
        .addFields(
          { 
            name: '📋 Type', 
            value: pokemon.types.map(t => `${getTypeEmoji(t)} ${t.charAt(0).toUpperCase() + t.slice(1)}`).join(' / '),
            inline: true 
          },
          { 
            name: '📊 Total Stats', 
            value: `${totalStats}`,
            inline: true 
          },
          { 
            name: '🎭 Suggested Roles', 
            value: roles.length > 0 ? roles.join(', ') : 'Versatile',
            inline: true 
          },
          { 
            name: '⚠️ Weaknesses (Takes Super Effective)', 
            value: weaknessText,
            inline: true 
          },
          { 
            name: '🛡️ Resistances (Takes Not Very Effective)', 
            value: resistText,
            inline: true 
          },
          { 
            name: '🚫 Immunities (No Effect)', 
            value: immuneText,
            inline: true 
          },
          {
            name: '📈 Base Stats',
            value: 
              `\`HP    \` ${createStatBar(pokemon.stats.hp)} **${pokemon.stats.hp}**\n` +
              `\`ATK   \` ${createStatBar(pokemon.stats.attack)} **${pokemon.stats.attack}**\n` +
              `\`DEF   \` ${createStatBar(pokemon.stats.defense)} **${pokemon.stats.defense}**\n` +
              `\`SP.ATK\` ${createStatBar(pokemon.stats.spAttack)} **${pokemon.stats.spAttack}**\n` +
              `\`SP.DEF\` ${createStatBar(pokemon.stats.spDefense)} **${pokemon.stats.spDefense}**\n` +
              `\`SPD   \` ${createStatBar(pokemon.stats.speed)} **${pokemon.stats.speed}**`,
            inline: false
          }
        )
        .setFooter({ 
          text: `Pokédex #${String(pokemon.id).padStart(3, '0')} | ${pokemon.region.charAt(0).toUpperCase() + pokemon.region.slice(1)} Region` 
        });

      // Add abilities
      if (pokemon.abilities && pokemon.abilities.length > 0) {
        embed.addFields({
          name: '🎯 Abilities',
          value: pokemon.abilities.map(a => a.charAt(0).toUpperCase() + a.slice(1).replace(/-/g, ' ')).join(', '),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Affection command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching Pokémon data.',
        ephemeral: true
      });
    }
  }
};

function createStatBar(value) {
  const maxStat = 255; // Max possible base stat
  const filled = Math.round((value / maxStat) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function getTypeEmoji(type) {
  const emojis = {
    normal: '⚪',
    fire: '🔥',
    water: '💧',
    electric: '⚡',
    grass: '🌿',
    ice: '❄️',
    fighting: '🥊',
    poison: '☠️',
    ground: '🏜️',
    flying: '🦅',
    psychic: '🔮',
    bug: '🐛',
    rock: '🪨',
    ghost: '👻',
    dragon: '🐉',
    dark: '🌑',
    steel: '⚙️',
    fairy: '✨'
  };
  return emojis[type] || '❓';
}

function getTypeColor(type) {
  const colors = {
    normal: 0x9CA3AF,
    fire: 0xEF4444,
    water: 0x3B82F6,
    electric: 0xEAB308,
    grass: 0x22C55E,
    ice: 0x22D3EE,
    fighting: 0xB91C1C,
    poison: 0x9333EA,
    ground: 0xCA8A04,
    flying: 0xA78BFA,
    psychic: 0xEC4899,
    bug: 0x65A30D,
    rock: 0x78716C,
    ghost: 0x7C3AED,
    dragon: 0x6366F1,
    dark: 0x1F2937,
    steel: 0x94A3B8,
    fairy: 0xF472B6
  };
  return colors[type] || 0x9CA3AF;
}
