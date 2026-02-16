const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');

const ITEMS_PER_PAGE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('box')
    .setDescription('View your Pokémon collection')
    .addBooleanOption(option =>
      option.setName('shiny')
        .setDescription('Show only shiny Pokémon')
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Filter by type')
        .addChoices(
          { name: 'Normal', value: 'normal' },
          { name: 'Fire', value: 'fire' },
          { name: 'Water', value: 'water' },
          { name: 'Electric', value: 'electric' },
          { name: 'Grass', value: 'grass' },
          { name: 'Ice', value: 'ice' },
          { name: 'Fighting', value: 'fighting' },
          { name: 'Poison', value: 'poison' },
          { name: 'Ground', value: 'ground' },
          { name: 'Flying', value: 'flying' },
          { name: 'Psychic', value: 'psychic' },
          { name: 'Bug', value: 'bug' },
          { name: 'Rock', value: 'rock' },
          { name: 'Ghost', value: 'ghost' },
          { name: 'Dragon', value: 'dragon' },
          { name: 'Dark', value: 'dark' },
          { name: 'Steel', value: 'steel' },
          { name: 'Fairy', value: 'fairy' }
        )
    )
    .addIntegerOption(option =>
      option.setName('miniv')
        .setDescription('Minimum IV percentage (0-100)')
        .setMinValue(0)
        .setMaxValue(100)
    )
    .addStringOption(option =>
      option.setName('sort')
        .setDescription('Sort by')
        .addChoices(
          { name: 'Recent (newest first)', value: 'recent' },
          { name: 'Level (highest first)', value: 'level' },
          { name: 'IVs (highest first)', value: 'iv' },
          { name: 'Pokédex Number', value: 'dex' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const shinyOnly = interaction.options.getBoolean('shiny') || false;
      const typeFilter = interaction.options.getString('type');
      const minIV = interaction.options.getInteger('miniv') || 0;
      const sortBy = interaction.options.getString('sort') || 'recent';

      // Build query
      const query = { ownerId: interaction.user.id };
      if (shinyOnly) query.isShiny = true;

      // Get user's Pokemon
      let userPokemon = await UserPokemon.find(query);

      if (userPokemon.length === 0) {
        return interaction.editReply({
          content: '📦 Your box is empty! Use `/wild` to catch some Pokémon.',
          ephemeral: true
        });
      }

      // Get Pokemon data for filtering and display
      const pokemonIds = [...new Set(userPokemon.map(p => p.pokemonId))];
      const pokemonData = await PokemonCache.find({ id: { $in: pokemonIds } });
      const pokemonMap = new Map(pokemonData.map(p => [p.id, p]));

      // Filter by type if specified
      if (typeFilter) {
        userPokemon = userPokemon.filter(p => {
          const data = pokemonMap.get(p.pokemonId);
          return data && data.types.includes(typeFilter);
        });
      }

      // Filter by IV
      if (minIV > 0) {
        userPokemon = userPokemon.filter(p => {
          const totalIV = p.ivs.hp + p.ivs.attack + p.ivs.defense + 
                         p.ivs.spAttack + p.ivs.spDefense + p.ivs.speed;
          const ivPercent = Math.round((totalIV / 186) * 100);
          return ivPercent >= minIV;
        });
      }

      // Sort
      userPokemon.sort((a, b) => {
        switch (sortBy) {
          case 'level':
            return b.level - a.level;
          case 'iv':
            const ivA = a.ivs.hp + a.ivs.attack + a.ivs.defense + a.ivs.spAttack + a.ivs.spDefense + a.ivs.speed;
            const ivB = b.ivs.hp + b.ivs.attack + b.ivs.defense + b.ivs.spAttack + b.ivs.spDefense + b.ivs.speed;
            return ivB - ivA;
          case 'dex':
            return a.pokemonId - b.pokemonId;
          case 'recent':
          default:
            return new Date(b.caughtAt) - new Date(a.caughtAt);
        }
      });

      if (userPokemon.length === 0) {
        return interaction.editReply({
          content: '📦 No Pokémon match your filters. Try different criteria!',
          ephemeral: true
        });
      }

      // Pagination
      let page = 0;
      const totalPages = Math.ceil(userPokemon.length / ITEMS_PER_PAGE);

      const generateEmbed = (pageNum) => {
        const start = pageNum * ITEMS_PER_PAGE;
        const end = Math.min(start + ITEMS_PER_PAGE, userPokemon.length);
        const pagePokemon = userPokemon.slice(start, end);

        let description = '';
        pagePokemon.forEach((p, idx) => {
          const data = pokemonMap.get(p.pokemonId);
          const name = data ? data.name.charAt(0).toUpperCase() + data.name.slice(1) : `Unknown #${p.pokemonId}`;
          const totalIV = p.ivs.hp + p.ivs.attack + p.ivs.defense + p.ivs.spAttack + p.ivs.spDefense + p.ivs.speed;
          const ivPercent = Math.round((totalIV / 186) * 100);
          
          description += `${p.isShiny ? '✨' : '📍'} **${name}** ${p.nickname ? `(${p.nickname})` : ''}\n`;
          description += `Lv.${p.level} | IV: ${ivPercent}% | ${p.nature}\n`;
          description += `\`${p.instanceId.slice(0, 8)}\`\n\n`;
        });

        const embed = new EmbedBuilder()
          .setTitle(`📦 ${interaction.user.username}'s Box`)
          .setDescription(description)
          .setColor(0x3B82F6)
          .setFooter({ 
            text: `Page ${pageNum + 1}/${totalPages} | Total: ${userPokemon.length} Pokémon` 
          });

        // Add active filters
        const filters = [];
        if (shinyOnly) filters.push('✨ Shiny Only');
        if (typeFilter) filters.push(`Type: ${typeFilter}`);
        if (minIV > 0) filters.push(`IV ≥ ${minIV}%`);
        if (filters.length > 0) {
          embed.addFields({ name: 'Filters', value: filters.join(' | '), inline: false });
        }

        return embed;
      };

      const generateButtons = (pageNum) => {
        return new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('box_first')
              .setLabel('⏮️')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(pageNum === 0),
            new ButtonBuilder()
              .setCustomId('box_prev')
              .setLabel('◀️')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(pageNum === 0),
            new ButtonBuilder()
              .setCustomId('box_page')
              .setLabel(`${pageNum + 1}/${totalPages}`)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('box_next')
              .setLabel('▶️')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(pageNum >= totalPages - 1),
            new ButtonBuilder()
              .setCustomId('box_last')
              .setLabel('⏭️')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(pageNum >= totalPages - 1)
          );
      };

      const message = await interaction.editReply({
        embeds: [generateEmbed(page)],
        components: totalPages > 1 ? [generateButtons(page)] : []
      });

      if (totalPages <= 1) return;

      // Handle pagination
      const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 120000
      });

      collector.on('collect', async i => {
        switch (i.customId) {
          case 'box_first':
            page = 0;
            break;
          case 'box_prev':
            page = Math.max(0, page - 1);
            break;
          case 'box_next':
            page = Math.min(totalPages - 1, page + 1);
            break;
          case 'box_last':
            page = totalPages - 1;
            break;
        }

        await i.update({
          embeds: [generateEmbed(page)],
          components: [generateButtons(page)]
        });
      });

      collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });

    } catch (error) {
      console.error('Box command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching your box.',
        ephemeral: true
      });
    }
  }
};
