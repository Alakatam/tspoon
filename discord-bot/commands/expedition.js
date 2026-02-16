const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Expedition Schema
const expeditionSchema = new mongoose.Schema({
  expeditionId: { type: String, required: true, unique: true },
  ownerId: String,
  pokemonId: String, // Instance ID
  missionType: String,
  startedAt: { type: Date, default: Date.now },
  endsAt: Date,
  rewards: {
    coins: Number,
    xp: Number,
    items: Object
  },
  completed: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false }
});

const Expedition = mongoose.models.Expedition || mongoose.model('Expedition', expeditionSchema);

// Mission types
const MISSION_TYPES = {
  scavenge: {
    name: '🔍 Scavenge',
    description: 'Search for items and coins',
    duration: 1, // hours
    rewards: {
      coins: { min: 100, max: 300 },
      xp: { min: 50, max: 100 },
      items: ['Poké Ball', 'Potion', 'Antidote']
    }
  },
  explore: {
    name: '🗺️ Explore',
    description: 'Explore new areas for better rewards',
    duration: 2,
    rewards: {
      coins: { min: 200, max: 500 },
      xp: { min: 100, max: 200 },
      items: ['Great Ball', 'Super Potion', 'Revive']
    }
  },
  treasure: {
    name: '💎 Treasure Hunt',
    description: 'Hunt for rare treasures',
    duration: 4,
    rewards: {
      coins: { min: 500, max: 1500 },
      xp: { min: 200, max: 400 },
      items: ['Ultra Ball', 'Hyper Potion', 'Rare Candy', 'PP Up']
    }
  },
  training: {
    name: '🏋️ Training',
    description: 'Focus on gaining experience',
    duration: 3,
    rewards: {
      coins: { min: 50, max: 150 },
      xp: { min: 300, max: 600 },
      items: ['Protein', 'Iron', 'Calcium']
    }
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('expedition')
    .setDescription('Send Pokemon on expeditions for rewards')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start a new expedition')
        .addStringOption(option =>
          option.setName('pokemon')
            .setDescription('Pokemon instance ID to send')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('mission')
            .setDescription('Type of mission')
            .setRequired(true)
            .addChoices(
              { name: '🔍 Scavenge (1 hour)', value: 'scavenge' },
              { name: '🗺️ Explore (2 hours)', value: 'explore' },
              { name: '💎 Treasure Hunt (4 hours)', value: 'treasure' },
              { name: '🏋️ Training (3 hours)', value: 'training' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check your active expeditions')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('claim')
        .setDescription('Claim completed expedition rewards')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Expedition ID to claim (or "all" for all completed)')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'start':
        await handleStart(interaction);
        break;
      case 'status':
        await handleStatus(interaction);
        break;
      case 'claim':
        await handleClaim(interaction);
        break;
    }
  }
};

async function handleStart(interaction) {
  await interaction.deferReply();

  try {
    const pokemonId = interaction.options.getString('pokemon');
    const missionType = interaction.options.getString('mission');

    // Check if user has free expedition slots (max 3)
    const activeExpeditions = await Expedition.countDocuments({
      ownerId: interaction.user.id,
      claimed: false
    });

    if (activeExpeditions >= 3) {
      return interaction.editReply({ content: '❌ You can only have 3 expeditions at a time. Claim completed ones first!', ephemeral: true });
    }

    // Find Pokemon
    const pokemon = await UserPokemon.findOne({
      ownerId: interaction.user.id,
      instanceId: { $regex: `^${pokemonId}`, $options: 'i' }
    });

    if (!pokemon) {
      return interaction.editReply({ content: '❌ Pokemon not found.', ephemeral: true });
    }

    // Check if Pokemon is already on expedition
    const onExpedition = await Expedition.findOne({
      pokemonId: pokemon.instanceId,
      claimed: false
    });

    if (onExpedition) {
      return interaction.editReply({ content: '❌ This Pokemon is already on an expedition!', ephemeral: true });
    }

    const mission = MISSION_TYPES[missionType];
    const endsAt = new Date(Date.now() + mission.duration * 60 * 60 * 1000);

    // Calculate rewards based on Pokemon level
    const levelBonus = 1 + (pokemon.level / 100);
    const coins = Math.floor((Math.random() * (mission.rewards.coins.max - mission.rewards.coins.min) + mission.rewards.coins.min) * levelBonus);
    const xp = Math.floor((Math.random() * (mission.rewards.xp.max - mission.rewards.xp.min) + mission.rewards.xp.min) * levelBonus);
    const item = mission.rewards.items[Math.floor(Math.random() * mission.rewards.items.length)];

    // Create expedition
    const expedition = new Expedition({
      expeditionId: uuidv4().slice(0, 8),
      ownerId: interaction.user.id,
      pokemonId: pokemon.instanceId,
      missionType,
      endsAt,
      rewards: {
        coins,
        xp,
        items: { [item]: 1 }
      }
    });

    await expedition.save();

    const pokemonData = await PokemonCache.findOne({ id: pokemon.pokemonId });
    const name = pokemonData?.name.charAt(0).toUpperCase() + pokemonData?.name.slice(1) || 'Pokemon';

    const embed = new EmbedBuilder()
      .setTitle(`${mission.name} Started!`)
      .setDescription(`${pokemon.isShiny ? '✨ ' : ''}${name} is heading out on an expedition!`)
      .setColor(0x3B82F6)
      .setThumbnail(pokemonData?.sprite)
      .addFields(
        { name: 'Mission', value: mission.description, inline: false },
        { name: 'Duration', value: `${mission.duration} hour(s)`, inline: true },
        { name: 'Returns', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
        { name: 'Expedition ID', value: expedition.expeditionId, inline: true }
      )
      .setFooter({ text: 'Check /expedition status to track progress' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Expedition start error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleStatus(interaction) {
  await interaction.deferReply();

  try {
    const expeditions = await Expedition.find({
      ownerId: interaction.user.id,
      claimed: false
    }).sort({ endsAt: 1 });

    if (expeditions.length === 0) {
      return interaction.editReply({ content: '📭 No active expeditions. Use `/expedition start` to send Pokemon out!', ephemeral: true });
    }

    let description = '';
    for (const exp of expeditions) {
      const pokemon = await UserPokemon.findOne({ instanceId: exp.pokemonId });
      const pokemonData = await PokemonCache.findOne({ id: pokemon?.pokemonId });
      const name = pokemonData?.name.charAt(0).toUpperCase() + pokemonData?.name.slice(1) || 'Pokemon';
      const mission = MISSION_TYPES[exp.missionType];

      const now = Date.now();
      const endsAt = new Date(exp.endsAt).getTime();
      const isComplete = now >= endsAt;

      description += `**${mission.name}** - ${pokemon?.isShiny ? '✨ ' : ''}${name}\n`;
      description += `ID: \`${exp.expeditionId}\` | `;
      
      if (isComplete) {
        description += '✅ **Complete!**\n';
      } else {
        description += `Returns <t:${Math.floor(endsAt / 1000)}:R>\n`;
      }
      description += '\n';
    }

    const completedCount = expeditions.filter(e => Date.now() >= new Date(e.endsAt).getTime()).length;

    const embed = new EmbedBuilder()
      .setTitle('🗺️ Active Expeditions')
      .setDescription(description)
      .setColor(0x3B82F6)
      .setFooter({ text: `${expeditions.length}/3 slots used | ${completedCount} ready to claim` });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('claim_all_expeditions')
          .setLabel('Claim All Completed')
          .setStyle(ButtonStyle.Success)
          .setDisabled(completedCount === 0)
      );

    const message = await interaction.editReply({ embeds: [embed], components: [row] });

    // Handle claim all button
    try {
      const buttonInteraction = await message.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      if (buttonInteraction.customId === 'claim_all_expeditions') {
        await claimAll(buttonInteraction, interaction.user.id);
      }
    } catch (err) {
      // Timeout - remove button
      await interaction.editReply({ components: [] }).catch(() => {});
    }

  } catch (error) {
    console.error('Expedition status error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleClaim(interaction) {
  await interaction.deferReply();

  try {
    const expId = interaction.options.getString('id');

    if (expId.toLowerCase() === 'all') {
      await claimAll({ update: (opts) => interaction.editReply(opts) }, interaction.user.id);
      return;
    }

    const expedition = await Expedition.findOne({
      expeditionId: expId,
      ownerId: interaction.user.id,
      claimed: false
    });

    if (!expedition) {
      return interaction.editReply({ content: '❌ Expedition not found.', ephemeral: true });
    }

    if (Date.now() < new Date(expedition.endsAt).getTime()) {
      return interaction.editReply({ content: '❌ This expedition is not complete yet!', ephemeral: true });
    }

    // Award rewards
    await User.updateOne(
      { userId: interaction.user.id },
      { $inc: { balance: expedition.rewards.coins } }
    );

    // Add XP to Pokemon
    const pokemon = await UserPokemon.findOne({ instanceId: expedition.pokemonId });
    if (pokemon) {
      pokemon.xp = (pokemon.xp || 0) + expedition.rewards.xp;
      const xpNeeded = pokemon.level * 100;
      let leveledUp = false;
      if (pokemon.xp >= xpNeeded && pokemon.level < 100) {
        pokemon.level += 1;
        pokemon.xp = 0;
        leveledUp = true;
      }
      await pokemon.save();

      const pokemonData = await PokemonCache.findOne({ id: pokemon.pokemonId });
      const name = pokemonData?.name.charAt(0).toUpperCase() + pokemonData?.name.slice(1) || 'Pokemon';

      expedition.claimed = true;
      await expedition.save();

      const itemList = Object.entries(expedition.rewards.items || {})
        .map(([item, count]) => `${count}x ${item}`)
        .join(', ');

      const embed = new EmbedBuilder()
        .setTitle('🎁 Expedition Rewards!')
        .setDescription(`${pokemon.isShiny ? '✨ ' : ''}${name} returned from the expedition!${leveledUp ? `\n🎉 **Leveled up to ${pokemon.level}!**` : ''}`)
        .setColor(0x22C55E)
        .setThumbnail(pokemonData?.sprite)
        .addFields(
          { name: '💰 Coins', value: `+${expedition.rewards.coins}`, inline: true },
          { name: '✨ XP', value: `+${expedition.rewards.xp}`, inline: true },
          { name: '🎒 Items', value: itemList || 'None', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Expedition claim error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function claimAll(interaction, userId) {
  const expeditions = await Expedition.find({
    ownerId: userId,
    claimed: false
  });

  const completed = expeditions.filter(e => Date.now() >= new Date(e.endsAt).getTime());

  if (completed.length === 0) {
    await interaction.update({ content: '❌ No completed expeditions to claim.', embeds: [], components: [] });
    return;
  }

  let totalCoins = 0;
  let totalXp = 0;
  const allItems = {};
  const claimedPokemon = [];

  for (const exp of completed) {
    totalCoins += exp.rewards.coins || 0;
    totalXp += exp.rewards.xp || 0;

    for (const [item, count] of Object.entries(exp.rewards.items || {})) {
      allItems[item] = (allItems[item] || 0) + count;
    }

    const pokemon = await UserPokemon.findOne({ instanceId: exp.pokemonId });
    if (pokemon) {
      pokemon.xp = (pokemon.xp || 0) + exp.rewards.xp;
      const xpNeeded = pokemon.level * 100;
      if (pokemon.xp >= xpNeeded && pokemon.level < 100) {
        pokemon.level += 1;
        pokemon.xp = 0;
      }
      await pokemon.save();

      const pokemonData = await PokemonCache.findOne({ id: pokemon.pokemonId });
      claimedPokemon.push(pokemonData?.name || 'Pokemon');
    }

    exp.claimed = true;
    await exp.save();
  }

  await User.updateOne(
    { userId },
    { $inc: { balance: totalCoins } }
  );

  const itemList = Object.entries(allItems)
    .map(([item, count]) => `${count}x ${item}`)
    .join(', ');

  const embed = new EmbedBuilder()
    .setTitle('🎁 All Expeditions Claimed!')
    .setDescription(`Claimed rewards from ${completed.length} expedition(s)`)
    .setColor(0x22C55E)
    .addFields(
      { name: '💰 Total Coins', value: `+${totalCoins}`, inline: true },
      { name: '✨ Total XP', value: `+${totalXp}`, inline: true },
      { name: '🎒 Items', value: itemList || 'None', inline: false },
      { name: '🐾 Pokemon Returned', value: claimedPokemon.join(', '), inline: false }
    );

  await interaction.update({ embeds: [embed], components: [] });
}
