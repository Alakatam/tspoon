const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');
const { v4: uuidv4 } = require('uuid');

// Biome configurations
const BIOMES = {
  forest: { types: ['grass', 'bug', 'normal'], weight: 1.2 },
  mountain: { types: ['rock', 'ground', 'fighting'], weight: 1.0 },
  ocean: { types: ['water'], weight: 1.3 },
  cave: { types: ['dark', 'ghost', 'rock'], weight: 0.9 },
  city: { types: ['normal', 'electric', 'steel'], weight: 1.1 },
  meadow: { types: ['fairy', 'grass', 'flying'], weight: 1.0 }
};

// Weather effects on spawn rates
const WEATHER_BONUSES = {
  clear: {},
  rain: { water: 1.5, electric: 1.3 },
  snow: { ice: 2.0 },
  sandstorm: { ground: 1.5, rock: 1.3 },
  fog: { ghost: 1.5, psychic: 1.3 }
};

// Base shiny rate: 1/512, with pity system
const BASE_SHINY_RATE = 1 / 512;
const PITY_THRESHOLD = 100;
const PITY_BONUS = 0.01; // +1% per catch after threshold

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wild')
    .setDescription('Encounter a wild Pokémon!')
    .addStringOption(option =>
      option.setName('biome')
        .setDescription('Choose a biome to explore')
        .addChoices(
          { name: '🌲 Forest', value: 'forest' },
          { name: '⛰️ Mountain', value: 'mountain' },
          { name: '🌊 Ocean', value: 'ocean' },
          { name: '🕳️ Cave', value: 'cave' },
          { name: '🏙️ City', value: 'city' },
          { name: '🌸 Meadow', value: 'meadow' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      // Get or create user
      let user = await User.findOne({ userId: interaction.user.id });
      if (!user) {
        user = await User.create({
          userId: interaction.user.id,
          username: interaction.user.username
        });
      }

      // Update last active
      user.lastActive = new Date();

      // Get biome and weather
      const biome = interaction.options.getString('biome') || 
        Object.keys(BIOMES)[Math.floor(Math.random() * Object.keys(BIOMES).length)];
      const weather = 'clear'; // TODO: Get from global settings

      // Get Pokemon based on biome types
      const biomeData = BIOMES[biome];
      const weatherBonus = WEATHER_BONUSES[weather] || {};

      // Query Pokemon of matching types
      let pokemonPool = await PokemonCache.find({
        types: { $in: biomeData.types }
      }).limit(100);

      // If no Pokemon found, get random ones
      if (pokemonPool.length === 0) {
        pokemonPool = await PokemonCache.find({}).limit(100);
      }

      if (pokemonPool.length === 0) {
        return interaction.editReply({
          content: '❌ No Pokémon data found. Please wait for the database to sync.',
          ephemeral: true
        });
      }

      // Select random Pokemon
      const pokemon = pokemonPool[Math.floor(Math.random() * pokemonPool.length)];

      // Calculate shiny chance with pity system
      let shinyChance = BASE_SHINY_RATE;
      if (user.pityCounter >= PITY_THRESHOLD) {
        shinyChance += (user.pityCounter - PITY_THRESHOLD) * PITY_BONUS;
      }
      const isShiny = Math.random() < shinyChance;

      // Generate random level (1-50 for wild)
      const level = Math.floor(Math.random() * 50) + 1;

      // Store encounter data for catch button
      const encounterId = uuidv4();

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${isShiny ? '✨ ' : ''}A wild ${pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)} appeared!`)
        .setDescription(`**Biome:** ${biome.charAt(0).toUpperCase() + biome.slice(1)} | **Weather:** ${weather}\n**Level:** ${level}`)
        .setImage(isShiny && pokemon.spriteShiny ? pokemon.spriteShiny : pokemon.sprite)
        .setColor(isShiny ? 0xFFD700 : getTypeColor(pokemon.types[0]))
        .addFields(
          { name: 'Type', value: pokemon.types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' / '), inline: true },
          { name: 'Region', value: pokemon.region.charAt(0).toUpperCase() + pokemon.region.slice(1), inline: true }
        )
        .setFooter({ text: `Pokédex #${String(pokemon.id).padStart(3, '0')} | ${isShiny ? '⭐ SHINY!' : 'Common'}` });

      if (isShiny) {
        embed.setAuthor({ name: '✨ SHINY ENCOUNTER! ✨' });
      }

      // Create catch button
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`catch_${encounterId}_${pokemon.id}_${level}_${isShiny}`)
            .setLabel('🎯 Throw Poké Ball')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`run_${encounterId}`)
            .setLabel('🏃 Run Away')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });

      // Handle button interaction
      const filter = i => i.customId.startsWith(`catch_${encounterId}`) || i.customId === `run_${encounterId}`;
      
      try {
        const buttonInteraction = await interaction.channel.awaitMessageComponent({
          filter,
          time: 60000
        });

        if (buttonInteraction.customId === `run_${encounterId}`) {
          await buttonInteraction.update({
            content: `${interaction.user} ran away from ${pokemon.name}!`,
            embeds: [],
            components: []
          });
          return;
        }

        // Catch the Pokemon
        const ivs = UserPokemon.generateRandomIVs();
        const nature = UserPokemon.getRandomNature();

        const newPokemon = await UserPokemon.create({
          instanceId: uuidv4(),
          pokemonId: pokemon.id,
          ownerId: interaction.user.id,
          level,
          ivs,
          nature,
          isShiny
        });

        // Update user stats
        user.totalCatches += 1;
        if (isShiny) {
          user.shinyCatches += 1;
          user.pityCounter = 0;
        } else {
          user.pityCounter += 1;
        }

        // Add to pokedex if new
        if (!user.pokedex.includes(pokemon.id)) {
          user.pokedex.push(pokemon.id);
        }

        await user.save();

        // Calculate IV percentage
        const totalIV = Object.values(ivs).reduce((a, b) => a + b, 0);
        const ivPercent = Math.round((totalIV / 186) * 100);

        const catchEmbed = new EmbedBuilder()
          .setTitle(`🎉 Gotcha! ${pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)} was caught!`)
          .setDescription(`${isShiny ? '✨ **SHINY!** ✨\n' : ''}Caught by ${interaction.user}`)
          .setThumbnail(isShiny && pokemon.spriteShiny ? pokemon.spriteShiny : pokemon.sprite)
          .setColor(isShiny ? 0xFFD700 : 0x00FF00)
          .addFields(
            { name: 'Level', value: `${level}`, inline: true },
            { name: 'Nature', value: nature, inline: true },
            { name: 'IVs', value: `${ivPercent}%`, inline: true },
            { name: 'HP', value: `${ivs.hp}`, inline: true },
            { name: 'ATK', value: `${ivs.attack}`, inline: true },
            { name: 'DEF', value: `${ivs.defense}`, inline: true },
            { name: 'SP.ATK', value: `${ivs.spAttack}`, inline: true },
            { name: 'SP.DEF', value: `${ivs.spDefense}`, inline: true },
            { name: 'SPD', value: `${ivs.speed}`, inline: true }
          )
          .setFooter({ text: `Instance ID: ${newPokemon.instanceId.slice(0, 8)}...` });

        await buttonInteraction.update({ embeds: [catchEmbed], components: [] });

      } catch (err) {
        // Timeout - Pokemon fled
        await interaction.editReply({
          content: `The wild ${pokemon.name} fled!`,
          embeds: [],
          components: []
        });
      }

    } catch (error) {
      console.error('Wild command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while encountering a Pokémon.',
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
