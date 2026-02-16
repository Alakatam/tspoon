const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { getTypeMultiplier } = require('../utils/TypeChart');

// Raid Schema
const raidSchema = new mongoose.Schema({
  raidId: { type: String, required: true, unique: true },
  bossId: Number, // Pokemon ID
  bossLevel: Number,
  bossHP: Number,
  bossMaxHP: Number,
  participants: [{
    oderId: String,
    odername: String,
    pokemonId: String,
    damage: { type: Number, default: 0 }
  }],
  status: { type: String, default: 'waiting' }, // waiting, active, completed, failed
  difficulty: String, // easy, normal, hard, legendary
  rewards: {
    coins: Number,
    shinyChance: Number,
    items: [String]
  },
  channelId: String,
  messageId: String,
  startedAt: Date,
  expiresAt: Date,
  completedAt: Date
});

const Raid = mongoose.models.Raid || mongoose.model('Raid', raidSchema);

// Raid Bosses
const RAID_BOSSES = {
  easy: [
    { id: 143, name: 'Snorlax', level: 30 },
    { id: 131, name: 'Lapras', level: 30 },
    { id: 130, name: 'Gyarados', level: 30 }
  ],
  normal: [
    { id: 149, name: 'Dragonite', level: 50 },
    { id: 143, name: 'Snorlax', level: 50 },
    { id: 59, name: 'Arcanine', level: 50 }
  ],
  hard: [
    { id: 150, name: 'Mewtwo', level: 70 },
    { id: 149, name: 'Dragonite', level: 70 },
    { id: 248, name: 'Tyranitar', level: 70 }
  ],
  legendary: [
    { id: 150, name: 'Mewtwo', level: 100 },
    { id: 151, name: 'Mew', level: 100 },
    { id: 249, name: 'Lugia', level: 100 },
    { id: 250, name: 'Ho-Oh', level: 100 },
    { id: 384, name: 'Rayquaza', level: 100 }
  ]
};

const DIFFICULTY_SETTINGS = {
  easy: { hpMult: 500, maxPlayers: 2, shinyChance: 0.02, coins: 500, time: 5 },
  normal: { hpMult: 1000, maxPlayers: 3, shinyChance: 0.05, coins: 1000, time: 5 },
  hard: { hpMult: 2000, maxPlayers: 4, shinyChance: 0.10, coins: 2000, time: 5 },
  legendary: { hpMult: 5000, maxPlayers: 4, shinyChance: 0.15, coins: 5000, time: 10 }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Participate in Raid Battles')
    .addSubcommand(subcommand =>
      subcommand
        .setName('spawn')
        .setDescription('Spawn a raid boss (costs coins)')
        .addStringOption(option =>
          option.setName('difficulty')
            .setDescription('Raid difficulty')
            .setRequired(true)
            .addChoices(
              { name: '⭐ Easy (500 coins)', value: 'easy' },
              { name: '⭐⭐ Normal (1000 coins)', value: 'normal' },
              { name: '⭐⭐⭐ Hard (2000 coins)', value: 'hard' },
              { name: '⭐⭐⭐⭐⭐ Legendary (5000 coins)', value: 'legendary' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Join an active raid')
        .addStringOption(option =>
          option.setName('raid')
            .setDescription('Raid ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('pokemon')
            .setDescription('Pokemon instance ID to use')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('attack')
        .setDescription('Attack the raid boss')
        .addStringOption(option =>
          option.setName('raid')
            .setDescription('Raid ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('active')
        .setDescription('View active raids in this server')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'spawn':
        await handleSpawn(interaction);
        break;
      case 'join':
        await handleJoin(interaction);
        break;
      case 'attack':
        await handleAttack(interaction);
        break;
      case 'active':
        await handleActive(interaction);
        break;
    }
  }
};

async function handleSpawn(interaction) {
  await interaction.deferReply();

  try {
    const difficulty = interaction.options.getString('difficulty');
    const settings = DIFFICULTY_SETTINGS[difficulty];
    const bosses = RAID_BOSSES[difficulty];

    // Check if user has enough coins
    const user = await User.findOne({ oderId: interaction.user.id });
    if (!user || user.balance < settings.coins) {
      return interaction.editReply({ content: `❌ You need ${settings.coins} coins to spawn this raid!`, ephemeral: true });
    }

    // Deduct coins
    await User.updateOne(
      { oderId: interaction.user.id },
      { $inc: { balance: -settings.coins } }
    );

    // Select random boss
    const boss = bosses[Math.floor(Math.random() * bosses.length)];
    const bossData = await PokemonCache.findOne({ id: boss.id });
    const bossHP = boss.level * settings.hpMult;

    // Create raid
    const raid = new Raid({
      raidId: uuidv4().slice(0, 6).toUpperCase(),
      bossId: boss.id,
      bossLevel: boss.level,
      bossHP,
      bossMaxHP: bossHP,
      difficulty,
      channelId: interaction.channelId,
      expiresAt: new Date(Date.now() + settings.time * 60 * 1000),
      rewards: {
        coins: settings.coins * 2,
        shinyChance: settings.shinyChance,
        items: ['Rare Candy', 'PP Max', difficulty === 'legendary' ? 'Master Ball' : 'Ultra Ball']
      }
    });

    await raid.save();

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ RAID BOSS APPEARED!`)
      .setDescription(`A wild **${boss.name}** has appeared!\n\n**Difficulty:** ${'⭐'.repeat(['easy', 'normal', 'hard', 'legendary'].indexOf(difficulty) + 1)}`)
      .setColor(0xEF4444)
      .setImage(bossData?.sprite)
      .addFields(
        { name: 'Level', value: `${boss.level}`, inline: true },
        { name: 'HP', value: `${bossHP.toLocaleString()}`, inline: true },
        { name: 'Players', value: `0/${settings.maxPlayers}`, inline: true },
        { name: 'Raid ID', value: `\`${raid.raidId}\``, inline: true },
        { name: 'Expires', value: `<t:${Math.floor(raid.expiresAt.getTime() / 1000)}:R>`, inline: true },
        { name: 'Shiny Chance', value: `${(settings.shinyChance * 100).toFixed(0)}%`, inline: true }
      )
      .setFooter({ text: 'Use /raid join <id> <pokemon> to participate!' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`raid_quick_join_${raid.raidId}`)
          .setLabel('Quick Join')
          .setStyle(ButtonStyle.Success)
      );

    await interaction.editReply({ embeds: [embed], components: [row] });

  } catch (error) {
    console.error('Raid spawn error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleJoin(interaction) {
  await interaction.deferReply();

  try {
    const raidId = interaction.options.getString('raid').toUpperCase();
    const pokemonId = interaction.options.getString('pokemon');

    const raid = await Raid.findOne({ raidId, status: { $in: ['waiting', 'active'] } });
    if (!raid) {
      return interaction.editReply({ content: '❌ Raid not found or has ended.', ephemeral: true });
    }

    // Check if already joined
    if (raid.participants.some(p => p.oderId === interaction.user.id)) {
      return interaction.editReply({ content: '❌ You already joined this raid!', ephemeral: true });
    }

    // Check max players
    const settings = DIFFICULTY_SETTINGS[raid.difficulty];
    if (raid.participants.length >= settings.maxPlayers) {
      return interaction.editReply({ content: '❌ This raid is full!', ephemeral: true });
    }

    // Find Pokemon
    const pokemon = await UserPokemon.findOne({
      ownerId: interaction.user.id,
      instanceId: { $regex: `^${pokemonId}`, $options: 'i' }
    });

    if (!pokemon) {
      return interaction.editReply({ content: '❌ Pokemon not found.', ephemeral: true });
    }

    // Join raid
    raid.participants.push({
      oderId: interaction.user.id,
      odername: interaction.user.username,
      pokemonId: pokemon.instanceId,
      damage: 0
    });

    if (raid.status === 'waiting') {
      raid.status = 'active';
      raid.startedAt = new Date();
    }

    await raid.save();

    const pokemonData = await PokemonCache.findOne({ id: pokemon.pokemonId });
    const name = pokemonData?.name.charAt(0).toUpperCase() + pokemonData?.name.slice(1) || 'Pokemon';

    await interaction.editReply({
      content: `✅ Joined raid **${raidId}** with ${pokemon.isShiny ? '✨ ' : ''}${name}!\n\nUse \`/raid attack ${raidId}\` to deal damage!`
    });

  } catch (error) {
    console.error('Raid join error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleAttack(interaction) {
  await interaction.deferReply();

  try {
    const raidId = interaction.options.getString('raid').toUpperCase();

    const raid = await Raid.findOne({ raidId, status: 'active' });
    if (!raid) {
      return interaction.editReply({ content: '❌ Raid not found or not active.', ephemeral: true });
    }

    const participant = raid.participants.find(p => p.oderId === interaction.user.id);
    if (!participant) {
      return interaction.editReply({ content: '❌ You are not in this raid! Use `/raid join` first.', ephemeral: true });
    }

    // Get participant's Pokemon
    const pokemon = await UserPokemon.findOne({ instanceId: participant.pokemonId });
    const pokemonData = await PokemonCache.findOne({ id: pokemon?.pokemonId });
    const bossData = await PokemonCache.findOne({ id: raid.bossId });

    // Calculate damage
    const level = pokemon?.level || 50;
    const attack = pokemonData?.stats?.attack || 100;
    const defense = bossData?.stats?.defense || 100;
    const moveType = pokemonData?.types?.[0] || 'normal';
    
    const typeMult = getTypeMultiplier(moveType, bossData?.types || ['normal']);
    const stab = (pokemonData?.types || []).includes(moveType) ? 1.5 : 1.0;
    const random = 0.85 + Math.random() * 0.15;

    let damage = Math.floor(((2 * level / 5 + 2) * 80 * (attack / defense) / 50 + 2) * stab * typeMult * random);
    damage = Math.max(1, damage);

    // Apply damage
    raid.bossHP = Math.max(0, raid.bossHP - damage);
    participant.damage += damage;
    await raid.save();

    const name = pokemonData?.name.charAt(0).toUpperCase() + pokemonData?.name.slice(1) || 'Pokemon';
    const bossName = bossData?.name.charAt(0).toUpperCase() + bossData?.name.slice(1) || 'Boss';

    let effectivenessMsg = '';
    if (typeMult > 1) effectivenessMsg = "It's super effective! 💥";
    else if (typeMult < 1 && typeMult > 0) effectivenessMsg = "It's not very effective... 😕";
    else if (typeMult === 0) effectivenessMsg = "It had no effect! 😱";

    // Check if raid is complete
    if (raid.bossHP <= 0) {
      await completeRaid(raid, interaction);
      return;
    }

    const hpPercent = Math.round((raid.bossHP / raid.bossMaxHP) * 100);
    const hpBar = createHPBar(raid.bossHP, raid.bossMaxHP);

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ Attack! ${name} vs ${bossName}`)
      .setDescription(`${pokemon?.isShiny ? '✨ ' : ''}${name} dealt **${damage}** damage!\n${effectivenessMsg}`)
      .setColor(typeMult > 1 ? 0x22C55E : typeMult < 1 ? 0xEF4444 : 0xEAB308)
      .addFields(
        { name: `${bossName} HP`, value: `${hpBar} ${hpPercent}%\n${raid.bossHP.toLocaleString()} / ${raid.bossMaxHP.toLocaleString()}`, inline: false },
        { name: 'Your Total Damage', value: `${participant.damage.toLocaleString()}`, inline: true }
      );

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Raid attack error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function completeRaid(raid, interaction) {
  raid.status = 'completed';
  raid.completedAt = new Date();
  await raid.save();

  const bossData = await PokemonCache.findOne({ id: raid.bossId });
  const bossName = bossData?.name.charAt(0).toUpperCase() + bossData?.name.slice(1) || 'Boss';

  // Distribute rewards
  const rewards = [];
  for (const participant of raid.participants) {
    const damagePercent = participant.damage / raid.bossMaxHP;
    const coins = Math.floor(raid.rewards.coins * (0.5 + damagePercent * 0.5)); // Min 50% reward
    
    // Shiny chance
    const isShiny = Math.random() < raid.rewards.shinyChance;
    
    // Create reward Pokemon
    const rewardPokemon = await UserPokemon.create({
      instanceId: uuidv4(),
      pokemonId: raid.bossId,
      ownerId: participant.oderId,
      level: Math.max(1, raid.bossLevel - 10),
      ivs: UserPokemon.generateRandomIVs(),
      nature: UserPokemon.getRandomNature(),
      isShiny,
      caughtIn: 'Raid Ball'
    });

    await User.updateOne(
      { oderId: participant.oderId },
      { 
        $inc: { balance: coins, totalCatches: 1, shinyCatches: isShiny ? 1 : 0 },
        $addToSet: { pokedex: raid.bossId }
      }
    );

    rewards.push({
      username: participant.odername,
      damage: participant.damage,
      coins,
      isShiny
    });
  }

  // Sort by damage
  rewards.sort((a, b) => b.damage - a.damage);

  let rewardText = '';
  for (const r of rewards) {
    rewardText += `**${r.username}** - ${r.damage.toLocaleString()} damage\n`;
    rewardText += `💰 ${r.coins} coins | ${r.isShiny ? '✨ SHINY ' : ''}${bossName}\n\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎉 RAID COMPLETE!`)
    .setDescription(`The **${bossName}** has been defeated!\n\n**Rewards:**\n${rewardText}`)
    .setColor(0x22C55E)
    .setThumbnail(bossData?.sprite)
    .setFooter({ text: `Raid ID: ${raid.raidId}` });

  await interaction.editReply({ embeds: [embed] });
}

async function handleActive(interaction) {
  await interaction.deferReply();

  try {
    const raids = await Raid.find({
      channelId: interaction.channelId,
      status: { $in: ['waiting', 'active'] }
    }).sort({ createdAt: -1 }).limit(5);

    if (raids.length === 0) {
      return interaction.editReply({ content: '📭 No active raids in this channel. Use `/raid spawn` to create one!', ephemeral: true });
    }

    let description = '';
    for (const raid of raids) {
      const bossData = await PokemonCache.findOne({ id: raid.bossId });
      const bossName = bossData?.name.charAt(0).toUpperCase() + bossData?.name.slice(1) || 'Boss';
      const hpPercent = Math.round((raid.bossHP / raid.bossMaxHP) * 100);
      const settings = DIFFICULTY_SETTINGS[raid.difficulty];

      description += `**${bossName}** (Lv.${raid.bossLevel}) - ${raid.difficulty.toUpperCase()}\n`;
      description += `ID: \`${raid.raidId}\` | HP: ${hpPercent}% | Players: ${raid.participants.length}/${settings.maxPlayers}\n`;
      description += `Expires: <t:${Math.floor(raid.expiresAt.getTime() / 1000)}:R>\n\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle('⚔️ Active Raids')
      .setDescription(description)
      .setColor(0xEF4444)
      .setFooter({ text: 'Use /raid join <id> <pokemon> to participate!' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Active raids error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

function createHPBar(current, max) {
  const percent = current / max;
  const filled = Math.round(percent * 20);
  const empty = 20 - filled;
  
  let color = '🟩';
  if (percent < 0.5) color = '🟨';
  if (percent < 0.25) color = '🟥';
  
  return color.repeat(filled) + '⬛'.repeat(empty);
}
