const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('View detailed information about a specific Pokémon')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('The instance ID of your Pokémon (first 8 characters)')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const instanceId = interaction.options.getString('id');

      // Find the Pokemon by partial instance ID
      const userPokemon = await UserPokemon.findOne({
        ownerId: interaction.user.id,
        instanceId: { $regex: `^${instanceId}`, $options: 'i' }
      });

      if (!userPokemon) {
        return interaction.editReply({
          content: '❌ Pokémon not found. Make sure you own this Pokémon and the ID is correct.',
          ephemeral: true
        });
      }

      // Get Pokemon data
      const pokemonData = await PokemonCache.findOne({ id: userPokemon.pokemonId });
      if (!pokemonData) {
        return interaction.editReply({
          content: '❌ Pokémon data not found in database.',
          ephemeral: true
        });
      }

      const name = pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1);
      
      // Calculate stats
      const totalIV = Object.values(userPokemon.ivs).reduce((a, b) => a + b, 0);
      const ivPercent = Math.round((totalIV / 186) * 100);
      const totalEV = Object.values(userPokemon.evs).reduce((a, b) => a + b, 0);

      // Create IV bar visualization
      const createStatBar = (value, max) => {
        const filled = Math.round((value / max) * 10);
        return '█'.repeat(filled) + '░'.repeat(10 - filled);
      };

      const embed = new EmbedBuilder()
        .setTitle(`${userPokemon.isShiny ? '✨ ' : ''}${userPokemon.nickname || name}`)
        .setDescription(userPokemon.nickname ? `Species: ${name}` : '')
        .setThumbnail(userPokemon.isShiny && pokemonData.spriteShiny ? pokemonData.spriteShiny : pokemonData.sprite)
        .setColor(userPokemon.isShiny ? 0xFFD700 : getTypeColor(pokemonData.types[0]))
        .addFields(
          { name: '📊 Basic Info', value: 
            `**Level:** ${userPokemon.level}\n` +
            `**Nature:** ${userPokemon.nature}\n` +
            `**Type:** ${pokemonData.types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' / ')}\n` +
            `**Region:** ${pokemonData.region.charAt(0).toUpperCase() + pokemonData.region.slice(1)}`,
            inline: true
          },
          { name: '📈 Stats', value:
            `**Total IV:** ${ivPercent}% (${totalIV}/186)\n` +
            `**Total EV:** ${totalEV}/510\n` +
            `**XP:** ${userPokemon.xp}`,
            inline: true
          },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: '💪 Individual Values (IVs)', value:
            `\`HP    \` ${createStatBar(userPokemon.ivs.hp, 31)} **${userPokemon.ivs.hp}**/31\n` +
            `\`ATK   \` ${createStatBar(userPokemon.ivs.attack, 31)} **${userPokemon.ivs.attack}**/31\n` +
            `\`DEF   \` ${createStatBar(userPokemon.ivs.defense, 31)} **${userPokemon.ivs.defense}**/31\n` +
            `\`SP.ATK\` ${createStatBar(userPokemon.ivs.spAttack, 31)} **${userPokemon.ivs.spAttack}**/31\n` +
            `\`SP.DEF\` ${createStatBar(userPokemon.ivs.spDefense, 31)} **${userPokemon.ivs.spDefense}**/31\n` +
            `\`SPD   \` ${createStatBar(userPokemon.ivs.speed, 31)} **${userPokemon.ivs.speed}**/31`,
            inline: false
          },
          { name: '🏋️ Effort Values (EVs)', value:
            `HP: ${userPokemon.evs.hp} | ATK: ${userPokemon.evs.attack} | DEF: ${userPokemon.evs.defense}\n` +
            `SP.ATK: ${userPokemon.evs.spAttack} | SP.DEF: ${userPokemon.evs.spDefense} | SPD: ${userPokemon.evs.speed}`,
            inline: false
          }
        )
        .setFooter({ 
          text: `Instance ID: ${userPokemon.instanceId} | Caught: ${new Date(userPokemon.caughtAt).toLocaleDateString()}` 
        });

      // Add abilities if available
      if (pokemonData.abilities && pokemonData.abilities.length > 0) {
        embed.addFields({
          name: '🎯 Abilities',
          value: pokemonData.abilities.map(a => a.charAt(0).toUpperCase() + a.slice(1).replace('-', ' ')).join(', '),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Info command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching Pokémon info.',
        ephemeral: true
      });
    }
  }
};

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
