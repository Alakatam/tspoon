const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('release')
    .setDescription('Release Pokemon for Essence (currency)')
    .addStringOption(option =>
      option.setName('pokemon')
        .setDescription('Pokemon instance ID(s) to release (comma separated, or "bulk" for mass release)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('filter')
        .setDescription('Bulk release filter (only with "bulk")')
        .addChoices(
          { name: 'Low IV (< 50%)', value: 'low_iv' },
          { name: 'Duplicates (keep highest)', value: 'duplicates' },
          { name: 'Common (non-shiny, low IV)', value: 'common' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const input = interaction.options.getString('pokemon');
      const filter = interaction.options.getString('filter');

      if (input.toLowerCase() === 'bulk') {
        await handleBulkRelease(interaction, filter);
      } else {
        await handleSingleRelease(interaction, input);
      }

    } catch (error) {
      console.error('Release error:', error);
      await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
    }
  }
};

async function handleSingleRelease(interaction, input) {
  const ids = input.split(',').map(s => s.trim());
  
  const toRelease = [];
  let totalEssence = 0;

  for (const id of ids) {
    const pokemon = await UserPokemon.findOne({
      ownerId: interaction.user.id,
      instanceId: { $regex: `^${id}`, $options: 'i' }
    });

    if (pokemon) {
      const pokemonData = await PokemonCache.findOne({ id: pokemon.pokemonId });
      const essence = calculateEssence(pokemon, pokemonData);
      toRelease.push({ pokemon, pokemonData, essence });
      totalEssence += essence;
    }
  }

  if (toRelease.length === 0) {
    return interaction.editReply({ content: '❌ No Pokemon found with those IDs.', ephemeral: true });
  }

  // Show confirmation
  let description = 'You are about to release:\n\n';
  for (const { pokemon, pokemonData, essence } of toRelease) {
    const name = pokemonData?.name.charAt(0).toUpperCase() + pokemonData?.name.slice(1) || 'Unknown';
    description += `${pokemon.isShiny ? '✨ ' : ''}**${name}** (Lv.${pokemon.level}) - ${essence} Essence\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Release')
    .setDescription(description)
    .setColor(0xEF4444)
    .addFields(
      { name: 'Total Essence', value: `💎 ${totalEssence}`, inline: true },
      { name: 'Pokemon Count', value: `${toRelease.length}`, inline: true }
    )
    .setFooter({ text: 'This action cannot be undone!' });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('release_confirm')
        .setLabel('Confirm Release')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('release_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

  const message = await interaction.editReply({ embeds: [embed], components: [row] });

  try {
    const buttonInteraction = await message.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id,
      time: 30000
    });

    if (buttonInteraction.customId === 'release_cancel') {
      await buttonInteraction.update({ content: '❌ Release cancelled.', embeds: [], components: [] });
      return;
    }

    // Execute release
    for (const { pokemon } of toRelease) {
      await UserPokemon.deleteOne({ instanceId: pokemon.instanceId });
    }

    await User.updateOne(
      { userId: interaction.user.id },
      { $inc: { balance: totalEssence } }
    );

    await buttonInteraction.update({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Pokemon Released')
        .setDescription(`Released ${toRelease.length} Pokemon and received ${totalEssence} Essence!`)
        .setColor(0x22C55E)
      ],
      components: []
    });

  } catch (err) {
    await interaction.editReply({ content: '⏰ Release cancelled - timed out.', embeds: [], components: [] });
  }
}

async function handleBulkRelease(interaction, filter) {
  if (!filter) {
    return interaction.editReply({ content: '❌ Please specify a filter for bulk release.', ephemeral: true });
  }

  let toRelease = [];
  const allPokemon = await UserPokemon.find({ ownerId: interaction.user.id });

  switch (filter) {
    case 'low_iv':
      for (const pokemon of allPokemon) {
        if (pokemon.isShiny) continue; // Never auto-release shinies
        const totalIV = Object.values(pokemon.ivs).reduce((a, b) => a + b, 0);
        const ivPercent = (totalIV / 186) * 100;
        if (ivPercent < 50) {
          const pokemonData = await PokemonCache.findOne({ id: pokemon.pokemonId });
          toRelease.push({ pokemon, pokemonData, essence: calculateEssence(pokemon, pokemonData) });
        }
      }
      break;

    case 'duplicates':
      // Group by species, keep highest level/IV
      const bySpecies = {};
      for (const pokemon of allPokemon) {
        if (!bySpecies[pokemon.pokemonId]) {
          bySpecies[pokemon.pokemonId] = [];
        }
        bySpecies[pokemon.pokemonId].push(pokemon);
      }

      for (const species of Object.values(bySpecies)) {
        if (species.length <= 1) continue;
        
        // Sort by shiny first, then level, then IV
        species.sort((a, b) => {
          if (a.isShiny !== b.isShiny) return b.isShiny - a.isShiny;
          if (a.level !== b.level) return b.level - a.level;
          const ivA = Object.values(a.ivs).reduce((x, y) => x + y, 0);
          const ivB = Object.values(b.ivs).reduce((x, y) => x + y, 0);
          return ivB - ivA;
        });

        // Keep first (best), release rest
        for (let i = 1; i < species.length; i++) {
          if (species[i].isShiny) continue; // Never auto-release shinies
          const pokemonData = await PokemonCache.findOne({ id: species[i].pokemonId });
          toRelease.push({ pokemon: species[i], pokemonData, essence: calculateEssence(species[i], pokemonData) });
        }
      }
      break;

    case 'common':
      for (const pokemon of allPokemon) {
        if (pokemon.isShiny) continue;
        const totalIV = Object.values(pokemon.ivs).reduce((a, b) => a + b, 0);
        const ivPercent = (totalIV / 186) * 100;
        if (ivPercent < 70 && pokemon.level < 20) {
          const pokemonData = await PokemonCache.findOne({ id: pokemon.pokemonId });
          toRelease.push({ pokemon, pokemonData, essence: calculateEssence(pokemon, pokemonData) });
        }
      }
      break;
  }

  if (toRelease.length === 0) {
    return interaction.editReply({ content: '📭 No Pokemon match the filter criteria.', ephemeral: true });
  }

  // Limit to 50 at a time
  if (toRelease.length > 50) {
    toRelease = toRelease.slice(0, 50);
  }

  const totalEssence = toRelease.reduce((sum, { essence }) => sum + essence, 0);

  const embed = new EmbedBuilder()
    .setTitle('⚠️ Bulk Release Confirmation')
    .setDescription(`Filter: **${filter.replace('_', ' ').toUpperCase()}**\n\nThis will release **${toRelease.length}** Pokemon.`)
    .setColor(0xEF4444)
    .addFields(
      { name: 'Total Essence', value: `💎 ${totalEssence}`, inline: true },
      { name: 'Pokemon Count', value: `${toRelease.length}`, inline: true }
    )
    .setFooter({ text: 'Shinies are never auto-released. This cannot be undone!' });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('bulk_release_confirm')
        .setLabel(`Release ${toRelease.length} Pokemon`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('bulk_release_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

  const message = await interaction.editReply({ embeds: [embed], components: [row] });

  try {
    const buttonInteraction = await message.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id,
      time: 30000
    });

    if (buttonInteraction.customId === 'bulk_release_cancel') {
      await buttonInteraction.update({ content: '❌ Bulk release cancelled.', embeds: [], components: [] });
      return;
    }

    // Execute bulk release
    for (const { pokemon } of toRelease) {
      await UserPokemon.deleteOne({ instanceId: pokemon.instanceId });
    }

    await User.updateOne(
      { userId: interaction.user.id },
      { $inc: { balance: totalEssence } }
    );

    await buttonInteraction.update({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Bulk Release Complete')
        .setDescription(`Released ${toRelease.length} Pokemon and received ${totalEssence} Essence!`)
        .setColor(0x22C55E)
      ],
      components: []
    });

  } catch (err) {
    await interaction.editReply({ content: '⏰ Bulk release cancelled - timed out.', embeds: [], components: [] });
  }
}

function calculateEssence(pokemon, pokemonData) {
  let base = 10;
  
  // Level bonus
  base += pokemon.level * 2;
  
  // IV bonus
  const totalIV = Object.values(pokemon.ivs).reduce((a, b) => a + b, 0);
  const ivPercent = totalIV / 186;
  base += Math.floor(ivPercent * 50);
  
  // Shiny bonus (but we protect shinies from bulk)
  if (pokemon.isShiny) base *= 10;
  
  // Rarity bonus (based on base stat total)
  if (pokemonData) {
    const bst = Object.values(pokemonData.stats || {}).reduce((a, b) => a + b, 0);
    if (bst > 500) base *= 2;
    else if (bst > 400) base *= 1.5;
  }
  
  return Math.floor(base);
}
