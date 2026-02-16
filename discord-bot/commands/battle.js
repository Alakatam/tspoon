const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');
const { getTypeMultiplier } = require('../utils/TypeChart');

// Gym Leaders Configuration
const GYM_LEADERS = {
  brock: { name: 'Brock', badge: 'Boulder Badge', type: 'rock', team: [74, 95], levelRange: [12, 14], reward: 500 },
  misty: { name: 'Misty', badge: 'Cascade Badge', type: 'water', team: [120, 121], levelRange: [18, 21], reward: 750 },
  lt_surge: { name: 'Lt. Surge', badge: 'Thunder Badge', type: 'electric', team: [100, 26], levelRange: [21, 24], reward: 1000 },
  erika: { name: 'Erika', badge: 'Rainbow Badge', type: 'grass', team: [71, 114, 45], levelRange: [29, 32], reward: 1250 },
  koga: { name: 'Koga', badge: 'Soul Badge', type: 'poison', team: [109, 89, 49], levelRange: [37, 43], reward: 1500 },
  sabrina: { name: 'Sabrina', badge: 'Marsh Badge', type: 'psychic', team: [64, 122, 65], levelRange: [38, 43], reward: 1750 },
  blaine: { name: 'Blaine', badge: 'Volcano Badge', type: 'fire', team: [58, 78, 59], levelRange: [42, 47], reward: 2000 },
  giovanni: { name: 'Giovanni', badge: 'Earth Badge', type: 'ground', team: [111, 31, 112], levelRange: [45, 50], reward: 2500 }
};

// Status effects
const STATUS_EFFECTS = {
  burn: { damagePercent: 0.0625, attackMod: 0.5 },
  paralysis: { speedMod: 0.5, skipChance: 0.25 },
  poison: { damagePercent: 0.125 },
  sleep: { skipChance: 1.0, maxTurns: 3 },
  freeze: { skipChance: 1.0, thawChance: 0.2 }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Battle a Gym Leader or another trainer')
    .addSubcommand(subcommand =>
      subcommand
        .setName('gym')
        .setDescription('Challenge a Gym Leader')
        .addStringOption(option =>
          option.setName('leader')
            .setDescription('Which gym leader to challenge')
            .setRequired(true)
            .addChoices(
              { name: '🪨 Brock (Rock)', value: 'brock' },
              { name: '💧 Misty (Water)', value: 'misty' },
              { name: '⚡ Lt. Surge (Electric)', value: 'lt_surge' },
              { name: '🌿 Erika (Grass)', value: 'erika' },
              { name: '☠️ Koga (Poison)', value: 'koga' },
              { name: '🔮 Sabrina (Psychic)', value: 'sabrina' },
              { name: '🔥 Blaine (Fire)', value: 'blaine' },
              { name: '🏜️ Giovanni (Ground)', value: 'giovanni' }
            )
        )
        .addStringOption(option =>
          option.setName('pokemon')
            .setDescription('Your Pokemon instance ID to use')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('duel')
        .setDescription('Challenge another trainer to a duel')
        .addUserOption(option =>
          option.setName('opponent')
            .setDescription('The trainer to challenge')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('pokemon')
            .setDescription('Your Pokemon instance ID to use')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'gym') {
      await handleGymBattle(interaction);
    } else if (subcommand === 'duel') {
      await handleDuel(interaction);
    }
  }
};

async function handleGymBattle(interaction) {
  await interaction.deferReply();

  try {
    const leaderId = interaction.options.getString('leader');
    const pokemonId = interaction.options.getString('pokemon');

    // Get user
    let user = await User.findOne({ userId: interaction.user.id });
    if (!user) {
      return interaction.editReply({ content: '❌ You need to catch some Pokémon first! Use `/wild`', ephemeral: true });
    }

    // Check if already has this badge
    if (user.gymBadges && user.gymBadges.includes(GYM_LEADERS[leaderId].badge)) {
      return interaction.editReply({ content: `✅ You already have the ${GYM_LEADERS[leaderId].badge}!`, ephemeral: true });
    }

    // Get player's Pokemon
    const playerPokemon = await UserPokemon.findOne({
      ownerId: interaction.user.id,
      instanceId: { $regex: `^${pokemonId}`, $options: 'i' }
    });

    if (!playerPokemon) {
      return interaction.editReply({ content: '❌ Pokemon not found. Check the instance ID.', ephemeral: true });
    }

    const playerData = await PokemonCache.findOne({ id: playerPokemon.pokemonId });
    if (!playerData) {
      return interaction.editReply({ content: '❌ Pokemon data not found.', ephemeral: true });
    }

    // Get gym leader data
    const leader = GYM_LEADERS[leaderId];
    const leaderPokemonId = leader.team[0];
    const leaderLevel = Math.floor(Math.random() * (leader.levelRange[1] - leader.levelRange[0] + 1)) + leader.levelRange[0];
    const leaderData = await PokemonCache.findOne({ id: leaderPokemonId });

    if (!leaderData) {
      return interaction.editReply({ content: '❌ Gym leader data not found.', ephemeral: true });
    }

    // Calculate HP
    const playerHP = calculateHP(playerData.stats.hp, playerPokemon.level, playerPokemon.ivs.hp);
    const leaderHP = calculateHP(leaderData.stats.hp, leaderLevel, 15);

    // Battle state
    const battleState = {
      playerHP: playerHP,
      playerMaxHP: playerHP,
      leaderHP: leaderHP,
      leaderMaxHP: leaderHP,
      playerPokemon: { ...playerData.toObject(), level: playerPokemon.level, ivs: playerPokemon.ivs },
      leaderPokemon: { ...leaderData.toObject(), level: leaderLevel },
      turn: 1,
      status: { player: [], leader: [] }
    };

    // Create battle embed
    const createBattleEmbed = (state, message = '') => {
      const playerName = playerData.name.charAt(0).toUpperCase() + playerData.name.slice(1);
      const leaderPokeName = leaderData.name.charAt(0).toUpperCase() + leaderData.name.slice(1);

      return new EmbedBuilder()
        .setTitle(`⚔️ Gym Battle: ${leader.name}`)
        .setDescription(message || `Turn ${state.turn}`)
        .setColor(0xEF4444)
        .addFields(
          {
            name: `Your ${playerName} (Lv.${playerPokemon.level})`,
            value: `HP: ${createHPBar(state.playerHP, state.playerMaxHP)} ${state.playerHP}/${state.playerMaxHP}`,
            inline: true
          },
          {
            name: `${leader.name}'s ${leaderPokeName} (Lv.${leaderLevel})`,
            value: `HP: ${createHPBar(state.leaderHP, state.leaderMaxHP)} ${state.leaderHP}/${state.leaderMaxHP}`,
            inline: true
          }
        )
        .setThumbnail(leaderData.sprite)
        .setFooter({ text: `Badge: ${leader.badge} | Reward: ${leader.reward} coins` });
    };

    const createBattleButtons = () => {
      return new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('battle_attack')
            .setLabel('⚔️ Attack')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('battle_special')
            .setLabel('✨ Special Attack')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('battle_forfeit')
            .setLabel('🏃 Forfeit')
            .setStyle(ButtonStyle.Secondary)
        );
    };

    const message = await interaction.editReply({
      embeds: [createBattleEmbed(battleState, `${leader.name} sent out ${leaderData.name}! Choose your action.`)],
      components: [createBattleButtons()]
    });

    // Battle loop
    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async i => {
      let battleMessage = '';

      if (i.customId === 'battle_forfeit') {
        collector.stop('forfeit');
        await i.update({
          embeds: [createBattleEmbed(battleState, `You forfeited the battle! ${leader.name} wins.`)],
          components: []
        });
        return;
      }

      // Player's turn
      const isSpecial = i.customId === 'battle_special';
      const playerDamage = calculateDamage(
        battleState.playerPokemon,
        battleState.leaderPokemon,
        isSpecial ? playerData.types[0] : 'normal',
        isSpecial ? 90 : 50
      );

      battleState.leaderHP = Math.max(0, battleState.leaderHP - playerDamage);
      battleMessage += `Your attack dealt ${playerDamage} damage!\n`;

      // Check if leader fainted
      if (battleState.leaderHP <= 0) {
        // Victory!
        user.gymBadges = user.gymBadges || [];
        user.gymBadges.push(leader.badge);
        user.balance = (user.balance || 0) + leader.reward;
        await user.save();

        // Give XP to Pokemon
        playerPokemon.xp = (playerPokemon.xp || 0) + (leaderLevel * 50);
        const xpNeeded = playerPokemon.level * 100;
        if (playerPokemon.xp >= xpNeeded && playerPokemon.level < 100) {
          playerPokemon.level += 1;
          playerPokemon.xp = 0;
          battleMessage += `\n🎉 ${playerData.name} leveled up to ${playerPokemon.level}!`;
        }
        await playerPokemon.save();

        collector.stop('victory');
        await i.update({
          embeds: [new EmbedBuilder()
            .setTitle(`🏆 Victory!`)
            .setDescription(`You defeated ${leader.name}!\n\n${battleMessage}`)
            .setColor(0x22C55E)
            .addFields(
              { name: '🏅 Badge Earned', value: leader.badge, inline: true },
              { name: '💰 Coins Earned', value: `${leader.reward}`, inline: true }
            )
            .setThumbnail(playerData.sprite)
          ],
          components: []
        });
        return;
      }

      // Leader's turn
      const leaderDamage = calculateDamage(
        battleState.leaderPokemon,
        battleState.playerPokemon,
        leaderData.types[0],
        60
      );

      battleState.playerHP = Math.max(0, battleState.playerHP - leaderDamage);
      battleMessage += `${leader.name}'s ${leaderData.name} dealt ${leaderDamage} damage!`;

      // Check if player fainted
      if (battleState.playerHP <= 0) {
        collector.stop('defeat');
        await i.update({
          embeds: [new EmbedBuilder()
            .setTitle(`💀 Defeat...`)
            .setDescription(`Your ${playerData.name} fainted!\n${leader.name} wins this time.`)
            .setColor(0xEF4444)
            .setThumbnail(leaderData.sprite)
          ],
          components: []
        });
        return;
      }

      battleState.turn++;

      await i.update({
        embeds: [createBattleEmbed(battleState, battleMessage)],
        components: [createBattleButtons()]
      });
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        interaction.editReply({
          content: '⏰ Battle timed out!',
          embeds: [],
          components: []
        }).catch(() => {});
      }
    });

  } catch (error) {
    console.error('Gym battle error:', error);
    await interaction.editReply({ content: '❌ An error occurred during the battle.', ephemeral: true });
  }
}

async function handleDuel(interaction) {
  await interaction.deferReply();

  try {
    const opponent = interaction.options.getUser('opponent');
    const pokemonId = interaction.options.getString('pokemon');

    if (opponent.id === interaction.user.id) {
      return interaction.editReply({ content: '❌ You cannot duel yourself!', ephemeral: true });
    }

    if (opponent.bot) {
      return interaction.editReply({ content: '❌ You cannot duel a bot!', ephemeral: true });
    }

    // Get player's Pokemon
    const playerPokemon = await UserPokemon.findOne({
      ownerId: interaction.user.id,
      instanceId: { $regex: `^${pokemonId}`, $options: 'i' }
    });

    if (!playerPokemon) {
      return interaction.editReply({ content: '❌ Pokemon not found. Check the instance ID.', ephemeral: true });
    }

    const playerData = await PokemonCache.findOne({ id: playerPokemon.pokemonId });

    // Create duel request
    const embed = new EmbedBuilder()
      .setTitle('⚔️ Duel Challenge!')
      .setDescription(`${interaction.user} challenges ${opponent} to a battle!`)
      .setColor(0xEAB308)
      .addFields(
        { name: 'Challenger Pokemon', value: `${playerData.name} (Lv.${playerPokemon.level})`, inline: true }
      )
      .setThumbnail(playerData.sprite)
      .setFooter({ text: 'The challenged player has 60 seconds to respond' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`duel_accept_${interaction.user.id}`)
          .setLabel('Accept Challenge')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`duel_decline_${interaction.user.id}`)
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.editReply({
      content: `${opponent}`,
      embeds: [embed],
      components: [row]
    });

    // Wait for opponent response
    try {
      const response = await interaction.channel.awaitMessageComponent({
        filter: i => i.user.id === opponent.id && i.customId.includes(interaction.user.id),
        time: 60000
      });

      if (response.customId.startsWith('duel_decline')) {
        await response.update({
          content: `${opponent} declined the duel challenge.`,
          embeds: [],
          components: []
        });
        return;
      }

      // Duel accepted - ask opponent to select Pokemon
      await response.update({
        content: `${opponent} accepted! They need to select their Pokemon using \`/battle duel\` with their own Pokemon.`,
        embeds: [embed],
        components: []
      });

    } catch (err) {
      await interaction.editReply({
        content: `${opponent} did not respond to the duel challenge.`,
        embeds: [],
        components: []
      });
    }

  } catch (error) {
    console.error('Duel error:', error);
    await interaction.editReply({ content: '❌ An error occurred setting up the duel.', ephemeral: true });
  }
}

function calculateHP(baseHP, level, iv) {
  return Math.floor(((2 * baseHP + iv) * level) / 100) + level + 10;
}

function calculateDamage(attacker, defender, moveType, power) {
  const level = attacker.level || 50;
  const attack = attacker.stats?.attack || 100;
  const defense = defender.stats?.defense || 100;

  const typeMult = getTypeMultiplier(moveType, defender.types || ['normal']);
  const stab = (attacker.types || []).includes(moveType) ? 1.5 : 1.0;
  const random = 0.85 + Math.random() * 0.15;

  const damage = ((2 * level / 5 + 2) * power * (attack / defense) / 50 + 2) * stab * typeMult * random;
  return Math.max(1, Math.floor(damage));
}

function createHPBar(current, max) {
  const percent = current / max;
  const filled = Math.round(percent * 10);
  const empty = 10 - filled;
  
  let color = '🟩';
  if (percent < 0.5) color = '🟨';
  if (percent < 0.25) color = '🟥';
  
  return color.repeat(filled) + '⬛'.repeat(empty);
}
