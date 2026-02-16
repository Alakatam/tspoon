const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');
const mongoose = require('mongoose');
const { getTypeMultiplier } = require('../utils/TypeChart');

// World Boss Schema
const worldBossSchema = new mongoose.Schema({
  bossId: Number,
  bossName: String,
  currentHP: Number,
  maxHP: Number,
  level: Number,
  contributors: [{
    oderId: String,
    odername: String,
    damage: Number,
    attacks: Number
  }],
  phase: { type: Number, default: 1 },
  status: { type: String, default: 'active' },
  startedAt: { type: Date, default: Date.now },
  endsAt: Date,
  rewards: {
    topReward: String,
    participationReward: String,
    shinyChance: Number
  }
});

const WorldBoss = mongoose.models.WorldBoss || mongoose.model('WorldBoss', worldBossSchema);

// World Boss rotation
const WORLD_BOSSES = [
  { id: 150, name: 'Mewtwo', hp: 10000000, level: 100 },
  { id: 249, name: 'Lugia', hp: 10000000, level: 100 },
  { id: 250, name: 'Ho-Oh', hp: 10000000, level: 100 },
  { id: 384, name: 'Rayquaza', hp: 15000000, level: 100 },
  { id: 483, name: 'Dialga', hp: 12000000, level: 100 },
  { id: 484, name: 'Palkia', hp: 12000000, level: 100 },
  { id: 487, name: 'Giratina', hp: 15000000, level: 100 },
  { id: 493, name: 'Arceus', hp: 20000000, level: 100 }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('worldboss')
    .setDescription('Battle the global World Boss')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View current World Boss status')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('attack')
        .setDescription('Attack the World Boss')
        .addStringOption(option =>
          option.setName('pokemon')
            .setDescription('Pokemon instance ID to use')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('View top damage dealers')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'status':
        await handleStatus(interaction);
        break;
      case 'attack':
        await handleAttack(interaction);
        break;
      case 'leaderboard':
        await handleLeaderboard(interaction);
        break;
    }
  }
};

async function getOrCreateWorldBoss() {
  let boss = await WorldBoss.findOne({ status: 'active' });
  
  if (!boss) {
    // Create new World Boss
    const bossTemplate = WORLD_BOSSES[Math.floor(Math.random() * WORLD_BOSSES.length)];
    
    boss = new WorldBoss({
      bossId: bossTemplate.id,
      bossName: bossTemplate.name,
      currentHP: bossTemplate.hp,
      maxHP: bossTemplate.hp,
      level: bossTemplate.level,
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      rewards: {
        topReward: 'Master Ball',
        participationReward: 'Rare Candy',
        shinyChance: 0.25
      }
    });
    
    await boss.save();
  }
  
  return boss;
}

async function handleStatus(interaction) {
  await interaction.deferReply();

  try {
    const boss = await getOrCreateWorldBoss();
    const bossData = await PokemonCache.findOne({ id: boss.bossId });

    const hpPercent = Math.round((boss.currentHP / boss.maxHP) * 100);
    const hpBar = createMassiveHPBar(boss.currentHP, boss.maxHP);
    const totalDamage = boss.contributors.reduce((sum, c) => sum + c.damage, 0);
    const uniqueContributors = boss.contributors.length;

    // Get user's contribution
    const userContrib = boss.contributors.find(c => c.oderId === interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle(`🌍 WORLD BOSS: ${boss.bossName}`)
      .setDescription(`A massive **${boss.bossName}** threatens the world!\nEveryone must work together to defeat it!`)
      .setColor(0x9333EA)
      .setImage(bossData?.sprite)
      .addFields(
        { name: 'HP', value: `${hpBar}\n**${boss.currentHP.toLocaleString()}** / ${boss.maxHP.toLocaleString()} (${hpPercent}%)`, inline: false },
        { name: 'Level', value: `${boss.level}`, inline: true },
        { name: 'Phase', value: `${boss.phase}/3`, inline: true },
        { name: 'Time Remaining', value: `<t:${Math.floor(boss.endsAt.getTime() / 1000)}:R>`, inline: true },
        { name: 'Total Damage Dealt', value: totalDamage.toLocaleString(), inline: true },
        { name: 'Contributors', value: `${uniqueContributors}`, inline: true },
        { name: 'Your Damage', value: userContrib ? userContrib.damage.toLocaleString() : '0', inline: true }
      )
      .setFooter({ text: 'Use /worldboss attack <pokemon> to deal damage! | Top 10 get special rewards!' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('World boss status error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleAttack(interaction) {
  await interaction.deferReply();

  try {
    const pokemonId = interaction.options.getString('pokemon');

    // Find Pokemon
    const pokemon = await UserPokemon.findOne({
      ownerId: interaction.user.id,
      instanceId: { $regex: `^${pokemonId}`, $options: 'i' }
    });

    if (!pokemon) {
      return interaction.editReply({ content: '❌ Pokemon not found.', ephemeral: true });
    }

    const boss = await getOrCreateWorldBoss();

    if (boss.status !== 'active') {
      return interaction.editReply({ content: '❌ The World Boss has already been defeated! A new one will spawn soon.', ephemeral: true });
    }

    // Check cooldown (1 attack per minute per user)
    const contributor = boss.contributors.find(c => c.oderId === interaction.user.id);
    if (contributor && contributor.lastAttack) {
      const cooldown = 60 * 1000; // 1 minute
      const timeSinceLastAttack = Date.now() - new Date(contributor.lastAttack).getTime();
      if (timeSinceLastAttack < cooldown) {
        const remaining = Math.ceil((cooldown - timeSinceLastAttack) / 1000);
        return interaction.editReply({ content: `⏳ You can attack again in ${remaining} seconds.`, ephemeral: true });
      }
    }

    const pokemonData = await PokemonCache.findOne({ id: pokemon.pokemonId });
    const bossData = await PokemonCache.findOne({ id: boss.bossId });

    // Calculate damage
    const level = pokemon.level;
    const attack = pokemonData?.stats?.attack || 100;
    const defense = bossData?.stats?.defense || 150;
    const moveType = pokemonData?.types?.[0] || 'normal';
    
    const typeMult = getTypeMultiplier(moveType, bossData?.types || ['psychic']);
    const stab = (pokemonData?.types || []).includes(moveType) ? 1.5 : 1.0;
    const random = 0.85 + Math.random() * 0.15;
    
    // IVs bonus
    const totalIV = Object.values(pokemon.ivs).reduce((a, b) => a + b, 0);
    const ivBonus = 1 + (totalIV / 186) * 0.5;

    let damage = Math.floor(((2 * level / 5 + 2) * 100 * (attack / defense) / 50 + 2) * stab * typeMult * random * ivBonus);
    
    // Shiny bonus
    if (pokemon.isShiny) damage = Math.floor(damage * 1.5);
    
    damage = Math.max(100, damage); // Minimum 100 damage

    // Apply damage
    boss.currentHP = Math.max(0, boss.currentHP - damage);

    // Update contributor
    if (contributor) {
      contributor.damage += damage;
      contributor.attacks += 1;
      contributor.lastAttack = new Date();
    } else {
      boss.contributors.push({
        oderId: interaction.user.id,
        odername: interaction.user.username,
        damage,
        attacks: 1,
        lastAttack: new Date()
      });
    }

    await boss.save();

    const name = pokemonData?.name.charAt(0).toUpperCase() + pokemonData?.name.slice(1) || 'Pokemon';

    let effectivenessMsg = '';
    if (typeMult > 1) effectivenessMsg = "💥 Super effective!";
    else if (typeMult < 1 && typeMult > 0) effectivenessMsg = "😕 Not very effective...";

    // Check if defeated
    if (boss.currentHP <= 0) {
      await defeatWorldBoss(boss, interaction);
      return;
    }

    // Check phase transition
    const hpPercent = boss.currentHP / boss.maxHP;
    if (hpPercent <= 0.66 && boss.phase === 1) {
      boss.phase = 2;
      await boss.save();
    } else if (hpPercent <= 0.33 && boss.phase === 2) {
      boss.phase = 3;
      await boss.save();
    }

    const hpBar = createMassiveHPBar(boss.currentHP, boss.maxHP);
    const newContrib = boss.contributors.find(c => c.oderId === interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ World Boss Attack!`)
      .setDescription(`${pokemon.isShiny ? '✨ ' : ''}${name} dealt **${damage.toLocaleString()}** damage to ${boss.bossName}!\n${effectivenessMsg}`)
      .setColor(typeMult > 1 ? 0x22C55E : 0x3B82F6)
      .setThumbnail(pokemonData?.sprite)
      .addFields(
        { name: `${boss.bossName} HP`, value: `${hpBar}\n${boss.currentHP.toLocaleString()} / ${boss.maxHP.toLocaleString()}`, inline: false },
        { name: 'Your Total Damage', value: newContrib?.damage.toLocaleString() || damage.toLocaleString(), inline: true },
        { name: 'Your Attacks', value: `${newContrib?.attacks || 1}`, inline: true }
      )
      .setFooter({ text: 'Cooldown: 1 minute between attacks' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('World boss attack error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function defeatWorldBoss(boss, interaction) {
  boss.status = 'defeated';
  await boss.save();

  const bossData = await PokemonCache.findOne({ id: boss.bossId });

  // Sort contributors by damage
  const topContributors = [...boss.contributors].sort((a, b) => b.damage - a.damage);
  const top10 = topContributors.slice(0, 10);

  // Distribute rewards
  for (let i = 0; i < boss.contributors.length; i++) {
    const contrib = boss.contributors[i];
    const rank = topContributors.findIndex(c => c.oderId === contrib.oderId) + 1;
    
    // Participation reward: everyone gets the boss Pokemon
    const isShiny = Math.random() < (rank <= 10 ? boss.rewards.shinyChance : boss.rewards.shinyChance / 2);
    
    await UserPokemon.create({
      instanceId: require('uuid').v4(),
      pokemonId: boss.bossId,
      ownerId: contrib.oderId,
      level: Math.max(1, boss.level - 20),
      ivs: UserPokemon.generateRandomIVs(),
      nature: UserPokemon.getRandomNature(),
      isShiny,
      caughtIn: 'World Ball'
    });

    // Coins based on rank
    const coins = rank <= 10 ? 10000 - (rank * 500) : 1000;
    
    await User.updateOne(
      { oderId: contrib.oderId },
      { 
        $inc: { balance: coins, totalCatches: 1, shinyCatches: isShiny ? 1 : 0 },
        $addToSet: { pokedex: boss.bossId }
      }
    );
  }

  // Build leaderboard text
  let leaderboardText = '';
  for (let i = 0; i < Math.min(10, top10.length); i++) {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    leaderboardText += `${medal} **${top10[i].odername}** - ${top10[i].damage.toLocaleString()} damage\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎉 WORLD BOSS DEFEATED!`)
    .setDescription(`**${boss.bossName}** has been defeated by the combined efforts of ${boss.contributors.length} trainers!\n\nAll participants receive a ${boss.bossName}!`)
    .setColor(0xFFD700)
    .setImage(bossData?.sprite)
    .addFields(
      { name: '🏆 Top Damage Dealers', value: leaderboardText || 'No contributors', inline: false },
      { name: 'Total Damage Dealt', value: boss.contributors.reduce((s, c) => s + c.damage, 0).toLocaleString(), inline: true },
      { name: 'Total Contributors', value: `${boss.contributors.length}`, inline: true }
    )
    .setFooter({ text: 'A new World Boss will spawn soon!' });

  await interaction.editReply({ embeds: [embed] });
}

async function handleLeaderboard(interaction) {
  await interaction.deferReply();

  try {
    const boss = await getOrCreateWorldBoss();

    if (boss.contributors.length === 0) {
      return interaction.editReply({ content: '📭 No contributors yet. Be the first to attack!', ephemeral: true });
    }

    const topContributors = [...boss.contributors].sort((a, b) => b.damage - a.damage).slice(0, 20);

    let description = '';
    for (let i = 0; i < topContributors.length; i++) {
      const c = topContributors[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      description += `${medal} **${c.odername}** - ${c.damage.toLocaleString()} damage (${c.attacks} attacks)\n`;
    }

    const userRank = boss.contributors.sort((a, b) => b.damage - a.damage).findIndex(c => c.oderId === interaction.user.id) + 1;
    const userContrib = boss.contributors.find(c => c.oderId === interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle(`🏆 World Boss Leaderboard: ${boss.bossName}`)
      .setDescription(description)
      .setColor(0xFFD700)
      .setFooter({ text: userContrib ? `Your rank: #${userRank} with ${userContrib.damage.toLocaleString()} damage` : 'You haven\'t attacked yet!' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('World boss leaderboard error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

function createMassiveHPBar(current, max) {
  const percent = current / max;
  const filled = Math.round(percent * 25);
  const empty = 25 - filled;
  
  let color = '🟩';
  if (percent < 0.66) color = '🟨';
  if (percent < 0.33) color = '🟥';
  
  return color.repeat(filled) + '⬛'.repeat(empty);
}
