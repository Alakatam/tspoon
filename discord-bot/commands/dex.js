const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const PokemonCache = require('../models/PokemonCache');

const REGIONS = {
  kanto: { start: 1, end: 151 },
  johto: { start: 152, end: 251 },
  hoenn: { start: 252, end: 386 },
  sinnoh: { start: 387, end: 493 },
  unova: { start: 494, end: 649 },
  kalos: { start: 650, end: 721 },
  alola: { start: 722, end: 809 },
  galar: { start: 810, end: 905 }
};

const ITEMS_PER_PAGE = 20;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dex')
    .setDescription('View your Pokédex completion')
    .addStringOption(option =>
      option.setName('region')
        .setDescription('View a specific region')
        .addChoices(
          { name: 'Kanto (1-151)', value: 'kanto' },
          { name: 'Johto (152-251)', value: 'johto' },
          { name: 'Hoenn (252-386)', value: 'hoenn' },
          { name: 'Sinnoh (387-493)', value: 'sinnoh' },
          { name: 'Unova (494-649)', value: 'unova' },
          { name: 'Kalos (650-721)', value: 'kalos' },
          { name: 'Alola (722-809)', value: 'alola' },
          { name: 'Galar (810-905)', value: 'galar' }
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

      const region = interaction.options.getString('region');

      if (!region) {
        // Show overview of all regions
        const embed = new EmbedBuilder()
          .setTitle(`📖 ${interaction.user.username}'s Pokédex`)
          .setDescription('Your progress across all regions')
          .setColor(0xEF4444)
          .setThumbnail(interaction.user.displayAvatarURL());

        let totalCaught = 0;
        let totalPokemon = 0;

        for (const [regionName, range] of Object.entries(REGIONS)) {
          const regionTotal = range.end - range.start + 1;
          const caught = user.pokedex.filter(id => id >= range.start && id <= range.end).length;
          const percent = Math.round((caught / regionTotal) * 100);
          
          totalCaught += caught;
          totalPokemon += regionTotal;

          const progressBar = createProgressBar(percent);
          
          embed.addFields({
            name: `${regionName.charAt(0).toUpperCase() + regionName.slice(1)}`,
            value: `${progressBar} ${caught}/${regionTotal} (${percent}%)`,
            inline: false
          });
        }

        const overallPercent = Math.round((totalCaught / totalPokemon) * 100);
        embed.setFooter({ 
          text: `Overall: ${totalCaught}/${totalPokemon} (${overallPercent}%)` 
        });

        return interaction.editReply({ embeds: [embed] });
      }

      // Show specific region with pagination
      const regionData = REGIONS[region];
      if (!regionData) {
        return interaction.editReply({
          content: '❌ Invalid region selected.',
          ephemeral: true
        });
      }

      // Get Pokemon for this region
      const regionPokemon = await PokemonCache.find({
        id: { $gte: regionData.start, $lte: regionData.end }
      }).sort({ id: 1 });

      const totalPages = Math.ceil(regionPokemon.length / ITEMS_PER_PAGE);
      let page = 0;

      const generateEmbed = (pageNum) => {
        const start = pageNum * ITEMS_PER_PAGE;
        const end = Math.min(start + ITEMS_PER_PAGE, regionPokemon.length);
        const pagePokemon = regionPokemon.slice(start, end);

        let description = '';
        pagePokemon.forEach(pokemon => {
          const caught = user.pokedex.includes(pokemon.id);
          const icon = caught ? '✅' : '❓';
          const name = caught 
            ? pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)
            : '???';
          
          description += `${icon} **#${String(pokemon.id).padStart(3, '0')}** ${name}\n`;
        });

        const regionCaught = user.pokedex.filter(
          id => id >= regionData.start && id <= regionData.end
        ).length;
        const regionTotal = regionData.end - regionData.start + 1;
        const percent = Math.round((regionCaught / regionTotal) * 100);

        return new EmbedBuilder()
          .setTitle(`📖 ${region.charAt(0).toUpperCase() + region.slice(1)} Pokédex`)
          .setDescription(description)
          .setColor(0xEF4444)
          .addFields({
            name: 'Progress',
            value: `${createProgressBar(percent)} ${regionCaught}/${regionTotal} (${percent}%)`,
            inline: false
          })
          .setFooter({ 
            text: `Page ${pageNum + 1}/${totalPages} | ✅ = Caught | ❓ = Not seen` 
          });
      };

      const generateButtons = (pageNum) => {
        return new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('dex_prev')
              .setLabel('◀️ Previous')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(pageNum === 0),
            new ButtonBuilder()
              .setCustomId('dex_page')
              .setLabel(`${pageNum + 1}/${totalPages}`)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('dex_next')
              .setLabel('Next ▶️')
              .setStyle(ButtonStyle.Primary)
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
        if (i.customId === 'dex_prev') {
          page = Math.max(0, page - 1);
        } else if (i.customId === 'dex_next') {
          page = Math.min(totalPages - 1, page + 1);
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
      console.error('Dex command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching your Pokédex.',
        ephemeral: true
      });
    }
  }
};

function createProgressBar(percent) {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
