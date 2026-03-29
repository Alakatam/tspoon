const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');
const { getTypeMultiplier } = require('../utils/TypeChart');
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

const BIOME_ITEM_DROPS = {
  forest: ['Potion', 'Antidote', 'Poké Ball'],
  mountain: ['Revive', 'Hard Stone', 'Great Ball'],
  ocean: ['Water Stone', 'Mystic Water', 'Great Ball'],
  cave: ['Dusk Ball', 'Escape Rope', 'Ultra Ball'],
  city: ['Poké Ball', 'Great Ball', 'Super Potion'],
  meadow: ['Poké Ball', 'Honey', 'Quick Claw']
};

const ITEM_DROP_CHANCE = 0.4;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wild')
    .setDescription('Encounter a wild Pokémon!')
    .addStringOption(option =>
      option.setName('pokemon')
        .setDescription('Your Pokémon instance ID to battle with (optional, auto-selects highest level)')
        .setRequired(false)
    )
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

      // Select player Pokémon (required for battle flow)
      const selectedPokemonInput = interaction.options.getString('pokemon');
      const playerPokemon = await findPlayerPokemon(interaction.user.id, selectedPokemonInput);

      if (!playerPokemon) {
        return interaction.editReply({
          content: '❌ You need at least one Pokémon to battle in the wild. Catch one first, then try again with `/wild`.',
          ephemeral: true
        });
      }

      const playerSpecies = await PokemonCache.findOne({ id: playerPokemon.pokemonId });
      if (!playerSpecies) {
        return interaction.editReply({
          content: '❌ Your battle Pokémon data could not be loaded.',
          ephemeral: true
        });
      }

      const encounterId = uuidv4();
      const playerMaxHP = calculateHP(playerSpecies.stats.hp, playerPokemon.level, playerPokemon.ivs?.hp || 15);
      const wildMaxHP = calculateHP(pokemon.stats.hp, level, 15);

      const battleState = {
        userId: interaction.user.id,
        biome,
        weather,
        encounterId,
        isShiny,
        wild: pokemon,
        wildLevel: level,
        wildHP: wildMaxHP,
        wildMaxHP,
        playerMon: playerPokemon,
        playerSpecies,
        playerHP: playerMaxHP,
        playerMaxHP,
        turn: 1
      };

      const message = await interaction.editReply({
        embeds: [buildWildBattleEmbed(battleState, `A wild ${capitalize(pokemon.name)} appeared! Choose an action.`)],
        components: [buildWildBattleRow(encounterId)]
      });

      const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId.endsWith(encounterId),
        time: 120000
      });

      collector.on('collect', async i => {
        try {
          let battleMessage = '';
          const action = i.customId.split('_')[1];

          if (action === 'run') {
            collector.stop('run');
            await i.update({
              embeds: [buildWildBattleEmbed(battleState, `🏃 You ran away from ${capitalize(battleState.wild.name)}.`)],
              components: []
            });
            return;
          }

          if (action === 'catch') {
            const catchChance = calculateCatchChance(battleState.wildHP, battleState.wildMaxHP, battleState.isShiny);
            const caught = Math.random() < catchChance;

            if (caught) {
              const result = await catchWildPokemon(user, battleState);
              collector.stop('caught');
              await i.update({ embeds: [result], components: [] });
              return;
            }

            battleMessage += `🎯 ${capitalize(battleState.wild.name)} broke free!\n`;
          }

          if (action === 'attack' || action === 'falseswipe') {
            const useFalseSwipe = action === 'falseswipe';
            let damage = calculateDamage(
              {
                level: battleState.playerMon.level,
                types: battleState.playerSpecies.types,
                stats: battleState.playerSpecies.stats
              },
              {
                level: battleState.wildLevel,
                types: battleState.wild.types,
                stats: battleState.wild.stats
              },
              useFalseSwipe ? battleState.playerSpecies.types[0] : 'normal',
              useFalseSwipe ? 40 : 55
            );

            if (useFalseSwipe) {
              damage = Math.min(damage, Math.max(0, battleState.wildHP - 1));
            }

            battleState.wildHP = Math.max(0, battleState.wildHP - damage);
            battleMessage += `${useFalseSwipe ? '🗡️ False Swipe' : '⚔️ Attack'} dealt ${damage} damage!\n`;

            if (battleState.wildHP <= 0) {
              const faintResult = await handleWildFaintRewards(user, battleState);
              collector.stop('wild-fainted');
              await i.update({ embeds: [faintResult], components: [] });
              return;
            }
          }

          // Wild counter-attack if still alive
          const wildDamage = calculateDamage(
            {
              level: battleState.wildLevel,
              types: battleState.wild.types,
              stats: battleState.wild.stats
            },
            {
              level: battleState.playerMon.level,
              types: battleState.playerSpecies.types,
              stats: battleState.playerSpecies.stats
            },
            battleState.wild.types[0],
            50
          );

          battleState.playerHP = Math.max(0, battleState.playerHP - wildDamage);
          battleMessage += `${capitalize(battleState.wild.name)} dealt ${wildDamage} damage back!`;

          if (battleState.playerHP <= 0) {
            collector.stop('player-fainted');
            await i.update({
              embeds: [buildWildBattleEmbed(battleState, `💀 Your ${capitalize(battleState.playerSpecies.name)} fainted! The wild ${capitalize(battleState.wild.name)} escaped.`)],
              components: []
            });
            return;
          }

          battleState.turn += 1;
          await i.update({
            embeds: [buildWildBattleEmbed(battleState, battleMessage)],
            components: [buildWildBattleRow(encounterId)]
          });
        } catch (err) {
          console.error('Wild battle interaction error:', err);
          collector.stop('error');
          await i.update({
            content: '❌ Battle error occurred. Please try again.',
            embeds: [],
            components: []
          }).catch(() => {});
        }
      });

      collector.on('end', async (_collected, reason) => {
        if (reason === 'time') {
          await interaction.editReply({
            embeds: [buildWildBattleEmbed(battleState, `⏰ The wild ${capitalize(battleState.wild.name)} fled due to inactivity.`)],
            components: []
          }).catch(() => {});
        }
      });

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

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

async function findPlayerPokemon(userId, instanceIdPrefix) {
  if (instanceIdPrefix) {
    return UserPokemon.findOne({
      ownerId: userId,
      instanceId: { $regex: `^${instanceIdPrefix}`, $options: 'i' }
    });
  }

  return UserPokemon.findOne({ ownerId: userId }).sort({ level: -1, caughtAt: 1 });
}

function buildWildBattleRow(encounterId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wild_attack_${encounterId}`)
      .setLabel('⚔️ Attack')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`wild_falseswipe_${encounterId}`)
      .setLabel('🗡️ False Swipe')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`wild_catch_${encounterId}`)
      .setLabel('🎯 Throw Poké Ball')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`wild_run_${encounterId}`)
      .setLabel('🏃 Run')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildWildBattleEmbed(state, message) {
  const playerName = capitalize(state.playerSpecies.name);
  const wildName = capitalize(state.wild.name);
  const catchChance = Math.round(calculateCatchChance(state.wildHP, state.wildMaxHP, state.isShiny) * 100);

  const embed = new EmbedBuilder()
    .setTitle(`${state.isShiny ? '✨ ' : ''}Wild Battle: ${wildName}`)
    .setDescription(`${message}\n\n**Biome:** ${capitalize(state.biome)} | **Weather:** ${state.weather} | **Turn:** ${state.turn}`)
    .setColor(state.isShiny ? 0xFFD700 : getTypeColor(state.wild.types[0]))
    .setImage(state.isShiny && state.wild.spriteShiny ? state.wild.spriteShiny : state.wild.sprite)
    .addFields(
      {
        name: `Your ${playerName} (Lv.${state.playerMon.level})`,
        value: `HP: ${createHPBar(state.playerHP, state.playerMaxHP)} ${state.playerHP}/${state.playerMaxHP}`,
        inline: true
      },
      {
        name: `Wild ${wildName} (Lv.${state.wildLevel})`,
        value: `HP: ${createHPBar(state.wildHP, state.wildMaxHP)} ${state.wildHP}/${state.wildMaxHP}`,
        inline: true
      },
      {
        name: 'Catch Info',
        value: `Current catch chance: **${catchChance}%**\nFalse Swipe leaves target at **1 HP**.`,
        inline: false
      }
    )
    .setFooter({ text: `Pokédex #${String(state.wild.id).padStart(3, '0')}` });

  if (state.isShiny) {
    embed.setAuthor({ name: '✨ SHINY ENCOUNTER! ✨' });
  }

  return embed;
}

function calculateHP(baseHP, level, iv) {
  return Math.floor(((2 * (baseHP || 50) + (iv || 0)) * level) / 100) + level + 10;
}

function calculateDamage(attacker, defender, moveType, power) {
  const level = attacker.level || 1;
  const attack = attacker.stats?.attack || 50;
  const defense = defender.stats?.defense || 50;
  const typeMult = getTypeMultiplier(moveType, defender.types || ['normal']);
  const stab = (attacker.types || []).includes(moveType) ? 1.5 : 1.0;
  const random = 0.85 + Math.random() * 0.15;
  const damage = ((2 * level / 5 + 2) * power * (attack / Math.max(1, defense)) / 50 + 2) * typeMult * stab * random;
  return Math.max(1, Math.floor(damage));
}

function createHPBar(current, max) {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1, current / safeMax));
  const filled = Math.round(ratio * 10);
  const empty = 10 - filled;

  let color = '🟩';
  if (ratio < 0.5) color = '🟨';
  if (ratio < 0.25) color = '🟥';
  return color.repeat(filled) + '⬛'.repeat(empty);
}

function calculateCatchChance(currentHP, maxHP, isShiny) {
  const hpRatio = Math.max(0.01, currentHP / Math.max(1, maxHP));
  let chance = 0.18 + ((1 - hpRatio) * 0.62);
  if (isShiny) chance *= 0.75;
  return Math.max(0.05, Math.min(0.95, chance));
}

async function catchWildPokemon(user, state) {
  const ivs = UserPokemon.generateRandomIVs();
  const nature = UserPokemon.getRandomNature();
  const newPokemon = await UserPokemon.create({
    instanceId: uuidv4(),
    pokemonId: state.wild.id,
    ownerId: state.userId,
    level: state.wildLevel,
    ivs,
    nature,
    isShiny: state.isShiny
  });

  user.totalCatches += 1;
  if (state.isShiny) {
    user.shinyCatches += 1;
    user.pityCounter = 0;
  } else {
    user.pityCounter += 1;
  }

  if (!user.pokedex.includes(state.wild.id)) {
    user.pokedex.push(state.wild.id);
  }

  await user.save();

  const totalIV = Object.values(ivs).reduce((a, b) => a + b, 0);
  const ivPercent = Math.round((totalIV / 186) * 100);

  return new EmbedBuilder()
    .setTitle(`🎉 Gotcha! ${capitalize(state.wild.name)} was caught!`)
    .setDescription(`${state.isShiny ? '✨ **SHINY!** ✨\n' : ''}Caught by <@${state.userId}>`)
    .setThumbnail(state.isShiny && state.wild.spriteShiny ? state.wild.spriteShiny : state.wild.sprite)
    .setColor(state.isShiny ? 0xFFD700 : 0x22C55E)
    .addFields(
      { name: 'Level', value: `${state.wildLevel}`, inline: true },
      { name: 'Nature', value: nature, inline: true },
      { name: 'IVs', value: `${ivPercent}%`, inline: true }
    )
    .setFooter({ text: `Instance ID: ${newPokemon.instanceId.slice(0, 8)}...` });
}

async function handleWildFaintRewards(user, state) {
  const expGained = Math.floor(30 + state.wildLevel * 8 + (state.isShiny ? 100 : 0));
  state.playerMon.xp = (state.playerMon.xp || 0) + expGained;

  let levelUps = 0;
  while (state.playerMon.level < 100 && state.playerMon.xp >= state.playerMon.level * 100) {
    state.playerMon.xp -= state.playerMon.level * 100;
    state.playerMon.level += 1;
    levelUps += 1;
  }
  await state.playerMon.save();

  let itemRewardText = 'No item dropped';
  if (!user.items || typeof user.items.get !== 'function') {
    user.items = new Map(Object.entries(user.items || {}));
  }

  if (Math.random() < ITEM_DROP_CHANCE) {
    const dropPool = BIOME_ITEM_DROPS[state.biome] || ['Potion'];
    const itemName = dropPool[Math.floor(Math.random() * dropPool.length)];
    const current = user.items.get(itemName) || 0;
    user.items.set(itemName, current + 1);
    itemRewardText = `+1 ${itemName}`;
  }

  await user.save();

  const levelText = levelUps > 0 ? `\n🎉 ${capitalize(state.playerSpecies.name)} leveled up ${levelUps} time(s)!` : '';

  return new EmbedBuilder()
    .setTitle(`✅ ${capitalize(state.wild.name)} fainted!`)
    .setDescription(`${capitalize(state.playerSpecies.name)} defeated the wild Pokémon.${levelText}`)
    .setColor(0x22C55E)
    .addFields(
      { name: 'XP Earned', value: `${expGained}`, inline: true },
      { name: 'Item Drop', value: itemRewardText, inline: true },
      { name: 'Current Level', value: `${state.playerMon.level}`, inline: true }
    );
}
