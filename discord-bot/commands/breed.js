const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Egg Schema
const eggSchema = new mongoose.Schema({
  eggId: { type: String, required: true, unique: true },
  ownerId: String,
  parent1Id: String,
  parent2Id: String,
  species: Number, // Pokemon ID that will hatch
  stepsRequired: { type: Number, default: 5000 },
  currentSteps: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Egg = mongoose.models.Egg || mongoose.model('Egg', eggSchema);

// Nursery slot schema
const nurserySchema = new mongoose.Schema({
  oderId: String,
  slot1: String, // Pokemon instance ID
  slot2: String, // Pokemon instance ID
  eggReady: { type: Boolean, default: false },
  lastCheck: { type: Date, default: Date.now }
});

const Nursery = mongoose.models.Nursery || mongoose.model('Nursery', nurserySchema);

// Egg groups for breeding compatibility
const EGG_GROUPS = {
  monster: [1, 4, 7, 29, 32, 104, 108, 111, 115, 131, 143, 147],
  water1: [7, 54, 60, 72, 79, 86, 90, 98, 116, 118, 120, 129, 131, 138, 140],
  water2: [118, 119, 129, 130, 170, 211, 223, 226, 230, 318, 319, 339, 340],
  bug: [10, 13, 46, 48, 123, 127, 165, 167, 193, 204, 212, 213, 214],
  flying: [16, 21, 83, 84, 142, 163, 176, 177, 198, 227, 278, 333, 396],
  field: [19, 25, 37, 50, 52, 58, 77, 83, 111, 128, 133, 155, 161, 190],
  fairy: [35, 39, 113, 173, 174, 175, 176, 183, 209, 298, 303, 311, 312],
  grass: [1, 43, 69, 102, 114, 152, 187, 191, 273, 285, 315, 331, 387],
  humanshape: [63, 66, 96, 106, 107, 122, 124, 125, 126, 236, 237, 296],
  mineral: [74, 81, 95, 185, 299, 337, 338, 343, 374, 524, 557, 597],
  amorphous: [88, 92, 109, 200, 218, 280, 353, 355, 422, 425, 442, 562],
  ditto: [132], // Can breed with anything
  dragon: [147, 148, 149, 329, 330, 333, 334, 371, 372, 373, 443, 444, 445]
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('breed')
    .setDescription('Breed Pokemon at the Nursery')
    .addSubcommand(subcommand =>
      subcommand
        .setName('deposit')
        .setDescription('Deposit two Pokemon at the nursery')
        .addStringOption(option =>
          option.setName('pokemon1')
            .setDescription('First Pokemon instance ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('pokemon2')
            .setDescription('Second Pokemon instance ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Check on your Pokemon at the nursery')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('collect')
        .setDescription('Collect an egg if one is ready')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('withdraw')
        .setDescription('Withdraw Pokemon from the nursery')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('eggs')
        .setDescription('View your eggs and their hatch progress')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('hatch')
        .setDescription('Attempt to hatch an egg')
        .addStringOption(option =>
          option.setName('egg')
            .setDescription('Egg ID to hatch')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'deposit':
        await handleDeposit(interaction);
        break;
      case 'check':
        await handleCheck(interaction);
        break;
      case 'collect':
        await handleCollect(interaction);
        break;
      case 'withdraw':
        await handleWithdraw(interaction);
        break;
      case 'eggs':
        await handleViewEggs(interaction);
        break;
      case 'hatch':
        await handleHatch(interaction);
        break;
    }
  }
};

async function handleDeposit(interaction) {
  await interaction.deferReply();

  try {
    const pokemon1Id = interaction.options.getString('pokemon1');
    const pokemon2Id = interaction.options.getString('pokemon2');

    // Check if already has Pokemon in nursery
    let nursery = await Nursery.findOne({ ownerId: interaction.user.id });
    if (nursery && nursery.slot1 && nursery.slot2) {
      return interaction.editReply({ content: '❌ Your nursery is full! Withdraw your Pokemon first.', ephemeral: true });
    }

    // Find both Pokemon
    const pokemon1 = await UserPokemon.findOne({
      ownerId: interaction.user.id,
      instanceId: { $regex: `^${pokemon1Id}`, $options: 'i' }
    });

    const pokemon2 = await UserPokemon.findOne({
      ownerId: interaction.user.id,
      instanceId: { $regex: `^${pokemon2Id}`, $options: 'i' }
    });

    if (!pokemon1 || !pokemon2) {
      return interaction.editReply({ content: '❌ One or both Pokemon not found.', ephemeral: true });
    }

    if (pokemon1.instanceId === pokemon2.instanceId) {
      return interaction.editReply({ content: '❌ You need two different Pokemon!', ephemeral: true });
    }

    // Check breeding compatibility (simplified - same egg group or Ditto)
    const data1 = await PokemonCache.findOne({ id: pokemon1.pokemonId });
    const data2 = await PokemonCache.findOne({ id: pokemon2.pokemonId });

    const isDitto1 = pokemon1.pokemonId === 132;
    const isDitto2 = pokemon2.pokemonId === 132;

    if (!isDitto1 && !isDitto2) {
      // Check if they share an egg group (simplified check)
      const compatible = checkCompatibility(pokemon1.pokemonId, pokemon2.pokemonId);
      if (!compatible) {
        return interaction.editReply({ 
          content: '❌ These Pokemon are not compatible for breeding. Try using a Ditto!', 
          ephemeral: true 
        });
      }
    }

    // Create or update nursery
    if (!nursery) {
      nursery = new Nursery({ ownerId: interaction.user.id });
    }
    nursery.slot1 = pokemon1.instanceId;
    nursery.slot2 = pokemon2.instanceId;
    nursery.eggReady = false;
    nursery.lastCheck = new Date();
    await nursery.save();

    const name1 = data1?.name.charAt(0).toUpperCase() + data1?.name.slice(1) || 'Pokemon';
    const name2 = data2?.name.charAt(0).toUpperCase() + data2?.name.slice(1) || 'Pokemon';

    const embed = new EmbedBuilder()
      .setTitle('🥚 Nursery')
      .setDescription(`You deposited ${name1} and ${name2} at the nursery!`)
      .setColor(0xF472B6)
      .addFields(
        { name: 'Slot 1', value: `${pokemon1.isShiny ? '✨ ' : ''}${name1} (Lv.${pokemon1.level})`, inline: true },
        { name: 'Slot 2', value: `${pokemon2.isShiny ? '✨ ' : ''}${name2} (Lv.${pokemon2.level})`, inline: true }
      )
      .setFooter({ text: 'Check back later to see if an egg is ready!' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Breed deposit error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleCheck(interaction) {
  await interaction.deferReply();

  try {
    const nursery = await Nursery.findOne({ ownerId: interaction.user.id });

    if (!nursery || !nursery.slot1) {
      return interaction.editReply({ content: '📭 Your nursery is empty! Use `/breed deposit` to add Pokemon.', ephemeral: true });
    }

    const pokemon1 = await UserPokemon.findOne({ instanceId: nursery.slot1 });
    const pokemon2 = await UserPokemon.findOne({ instanceId: nursery.slot2 });

    const data1 = await PokemonCache.findOne({ id: pokemon1?.pokemonId });
    const data2 = await PokemonCache.findOne({ id: pokemon2?.pokemonId });

    // Check if enough time has passed for an egg (5 minutes for demo, would be longer in production)
    const timePassed = Date.now() - new Date(nursery.lastCheck).getTime();
    const minutesPassed = timePassed / (1000 * 60);

    if (!nursery.eggReady && minutesPassed >= 5) {
      // 50% chance of egg
      if (Math.random() < 0.5) {
        nursery.eggReady = true;
        await nursery.save();
      }
      nursery.lastCheck = new Date();
      await nursery.save();
    }

    const name1 = data1?.name.charAt(0).toUpperCase() + data1?.name.slice(1) || 'Pokemon';
    const name2 = data2?.name.charAt(0).toUpperCase() + data2?.name.slice(1) || 'Pokemon';

    const embed = new EmbedBuilder()
      .setTitle('🥚 Nursery Status')
      .setColor(nursery.eggReady ? 0x22C55E : 0xEAB308)
      .addFields(
        { name: 'Slot 1', value: `${pokemon1?.isShiny ? '✨ ' : ''}${name1}`, inline: true },
        { name: 'Slot 2', value: `${pokemon2?.isShiny ? '✨ ' : ''}${name2}`, inline: true },
        { name: 'Status', value: nursery.eggReady ? '🥚 **An egg is ready!** Use `/breed collect`' : '💤 The two seem to get along...', inline: false }
      );

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Breed check error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleCollect(interaction) {
  await interaction.deferReply();

  try {
    const nursery = await Nursery.findOne({ ownerId: interaction.user.id });

    if (!nursery || !nursery.eggReady) {
      return interaction.editReply({ content: '❌ No egg is ready to collect.', ephemeral: true });
    }

    const pokemon1 = await UserPokemon.findOne({ instanceId: nursery.slot1 });
    const pokemon2 = await UserPokemon.findOne({ instanceId: nursery.slot2 });

    // Determine egg species (baby form of non-Ditto parent)
    let species;
    if (pokemon1.pokemonId === 132) {
      species = getBasicForm(pokemon2.pokemonId);
    } else if (pokemon2.pokemonId === 132) {
      species = getBasicForm(pokemon1.pokemonId);
    } else {
      species = getBasicForm(Math.random() < 0.5 ? pokemon1.pokemonId : pokemon2.pokemonId);
    }

    // Create egg
    const egg = new Egg({
      eggId: uuidv4().slice(0, 8),
      ownerId: interaction.user.id,
      parent1Id: nursery.slot1,
      parent2Id: nursery.slot2,
      species,
      stepsRequired: 2500 + Math.floor(Math.random() * 2500), // 2500-5000 steps
      currentSteps: 0
    });

    await egg.save();

    nursery.eggReady = false;
    nursery.lastCheck = new Date();
    await nursery.save();

    const pokemonData = await PokemonCache.findOne({ id: species });
    const speciesName = pokemonData?.name || 'Unknown';

    const embed = new EmbedBuilder()
      .setTitle('🥚 Egg Collected!')
      .setDescription(`You received an egg! It looks like it will hatch into a ${speciesName}!`)
      .setColor(0x22C55E)
      .addFields(
        { name: 'Egg ID', value: egg.eggId, inline: true },
        { name: 'Steps to Hatch', value: `${egg.stepsRequired}`, inline: true }
      )
      .setFooter({ text: 'Stay active in the server to hatch your egg! Check /breed eggs' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Breed collect error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleWithdraw(interaction) {
  await interaction.deferReply();

  try {
    const nursery = await Nursery.findOne({ ownerId: interaction.user.id });

    if (!nursery || !nursery.slot1) {
      return interaction.editReply({ content: '📭 Your nursery is empty!', ephemeral: true });
    }

    nursery.slot1 = null;
    nursery.slot2 = null;
    nursery.eggReady = false;
    await nursery.save();

    await interaction.editReply({ content: '✅ Pokemon withdrawn from the nursery.', ephemeral: true });

  } catch (error) {
    console.error('Breed withdraw error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleViewEggs(interaction) {
  await interaction.deferReply();

  try {
    const eggs = await Egg.find({ ownerId: interaction.user.id }).sort({ createdAt: -1 });

    if (eggs.length === 0) {
      return interaction.editReply({ content: '📭 You have no eggs. Use `/breed` to get some!', ephemeral: true });
    }

    let description = '';
    for (const egg of eggs) {
      const pokemonData = await PokemonCache.findOne({ id: egg.species });
      const name = pokemonData?.name.charAt(0).toUpperCase() + pokemonData?.name.slice(1) || '???';
      const progress = Math.round((egg.currentSteps / egg.stepsRequired) * 100);

      description += `**Egg ${egg.eggId}** - ${name}\n`;
      description += `${createProgressBar(progress)} ${progress}% (${egg.currentSteps}/${egg.stepsRequired})\n\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle('🥚 Your Eggs')
      .setDescription(description)
      .setColor(0xF472B6)
      .setFooter({ text: 'Eggs gain steps as you chat in the server!' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('View eggs error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleHatch(interaction) {
  await interaction.deferReply();

  try {
    const eggId = interaction.options.getString('egg');

    const egg = await Egg.findOne({ eggId, ownerId: interaction.user.id });

    if (!egg) {
      return interaction.editReply({ content: '❌ Egg not found.', ephemeral: true });
    }

    if (egg.currentSteps < egg.stepsRequired) {
      const remaining = egg.stepsRequired - egg.currentSteps;
      return interaction.editReply({ content: `❌ This egg needs ${remaining} more steps to hatch!`, ephemeral: true });
    }

    // Hatch the egg!
    const pokemonData = await PokemonCache.findOne({ id: egg.species });

    // Determine if shiny (higher chance from breeding: 1/256)
    const isShiny = Math.random() < (1 / 256);

    // Generate IVs (breeding can pass down IVs - simplified)
    const ivs = UserPokemon.generateRandomIVs();

    // Create hatched Pokemon
    const newPokemon = await UserPokemon.create({
      instanceId: uuidv4(),
      pokemonId: egg.species,
      ownerId: interaction.user.id,
      level: 1,
      ivs,
      nature: UserPokemon.getRandomNature(),
      isShiny,
      caughtIn: 'Egg'
    });

    // Update user stats
    await User.updateOne(
      { userId: interaction.user.id },
      { 
        $inc: { totalCatches: 1, shinyCatches: isShiny ? 1 : 0 },
        $addToSet: { pokedex: egg.species }
      }
    );

    // Delete egg
    await Egg.deleteOne({ eggId });

    const name = pokemonData?.name.charAt(0).toUpperCase() + pokemonData?.name.slice(1) || 'Pokemon';
    const totalIV = Object.values(ivs).reduce((a, b) => a + b, 0);
    const ivPercent = Math.round((totalIV / 186) * 100);

    const embed = new EmbedBuilder()
      .setTitle(`🎉 Egg Hatched!`)
      .setDescription(`${isShiny ? '✨ **SHINY!** ✨\n' : ''}Your egg hatched into a ${name}!`)
      .setColor(isShiny ? 0xFFD700 : 0x22C55E)
      .setThumbnail(isShiny && pokemonData?.spriteShiny ? pokemonData.spriteShiny : pokemonData?.sprite)
      .addFields(
        { name: 'Level', value: '1', inline: true },
        { name: 'IVs', value: `${ivPercent}%`, inline: true },
        { name: 'Nature', value: newPokemon.nature, inline: true }
      )
      .setFooter({ text: `Instance ID: ${newPokemon.instanceId.slice(0, 8)}` });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Hatch error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

function checkCompatibility(id1, id2) {
  // Simplified compatibility check
  for (const group of Object.values(EGG_GROUPS)) {
    if (group.includes(id1) && group.includes(id2)) {
      return true;
    }
  }
  // Default to compatible for demo purposes
  return true;
}

function getBasicForm(pokemonId) {
  // Return basic form (simplified - would use evolution chain in production)
  const evolutionBases = {
    // Starters
    2: 1, 3: 1, 5: 4, 6: 4, 8: 7, 9: 7,
    // Common evolutions
    12: 10, 15: 13, 18: 16, 20: 19, 22: 21, 24: 23,
    26: 25, 28: 27, 31: 29, 34: 32, 36: 35, 38: 37,
    40: 39, 42: 41, 45: 43, 47: 46, 49: 48, 51: 50,
    53: 52, 55: 54, 57: 56, 59: 58, 62: 60, 65: 63,
    68: 66, 71: 69, 73: 72, 76: 74, 78: 77, 80: 79,
    82: 81, 85: 84, 87: 86, 89: 88, 91: 90, 94: 92,
    97: 96, 99: 98, 101: 100, 103: 102, 105: 104,
    110: 109, 112: 111, 119: 118, 121: 120, 130: 129,
    134: 133, 135: 133, 136: 133, 139: 138, 141: 140,
    149: 147
  };
  return evolutionBases[pokemonId] || pokemonId;
}

function createProgressBar(percent) {
  const filled = Math.round(percent / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
