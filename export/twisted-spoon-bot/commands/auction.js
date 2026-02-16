const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');
const mongoose = require('mongoose');

// Auction Schema
const auctionSchema = new mongoose.Schema({
  auctionId: { type: String, required: true, unique: true },
  sellerId: String,
  pokemonInstanceId: String,
  startingPrice: Number,
  currentBid: { type: Number, default: 0 },
  currentBidder: String,
  buyNowPrice: Number,
  status: { type: String, default: 'active' },
  bids: [{
    bidderId: String,
    amount: Number,
    timestamp: Date
  }],
  createdAt: { type: Date, default: Date.now },
  endsAt: Date
});

const Auction = mongoose.models.Auction || mongoose.model('Auction', auctionSchema);

const ITEMS_PER_PAGE = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('auction')
    .setDescription('Buy and sell Pokemon on the auction house')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List a Pokemon for auction')
        .addStringOption(option =>
          option.setName('pokemon')
            .setDescription('Pokemon instance ID to sell')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('price')
            .setDescription('Starting price in coins')
            .setRequired(true)
            .setMinValue(100)
        )
        .addIntegerOption(option =>
          option.setName('buynow')
            .setDescription('Buy now price (optional)')
            .setMinValue(100)
        )
        .addIntegerOption(option =>
          option.setName('hours')
            .setDescription('Auction duration in hours (default: 24)')
            .setMinValue(1)
            .setMaxValue(72)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('browse')
        .setDescription('Browse active auctions')
        .addBooleanOption(option =>
          option.setName('shiny')
            .setDescription('Show only shiny Pokemon')
        )
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Filter by type')
            .addChoices(
              { name: 'Fire', value: 'fire' },
              { name: 'Water', value: 'water' },
              { name: 'Grass', value: 'grass' },
              { name: 'Electric', value: 'electric' },
              { name: 'Psychic', value: 'psychic' },
              { name: 'Dragon', value: 'dragon' },
              { name: 'Dark', value: 'dark' },
              { name: 'Fairy', value: 'fairy' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('bid')
        .setDescription('Place a bid on an auction')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Auction ID')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Your bid amount')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('buy')
        .setDescription('Instantly buy a Pokemon at the buy-now price')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Auction ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('mylistings')
        .setDescription('View your active auction listings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('Cancel your auction (only if no bids)')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Auction ID to cancel')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list':
        await handleListAuction(interaction);
        break;
      case 'browse':
        await handleBrowseAuctions(interaction);
        break;
      case 'bid':
        await handleBid(interaction);
        break;
      case 'buy':
        await handleBuyNow(interaction);
        break;
      case 'mylistings':
        await handleMyListings(interaction);
        break;
      case 'cancel':
        await handleCancelAuction(interaction);
        break;
    }
  }
};

async function handleListAuction(interaction) {
  await interaction.deferReply();

  try {
    const pokemonId = interaction.options.getString('pokemon');
    const startingPrice = interaction.options.getInteger('price');
    const buyNowPrice = interaction.options.getInteger('buynow');
    const hours = interaction.options.getInteger('hours') || 24;

    // Find the Pokemon
    const pokemon = await UserPokemon.findOne({
      ownerId: interaction.user.id,
      instanceId: { $regex: `^${pokemonId}`, $options: 'i' }
    });

    if (!pokemon) {
      return interaction.editReply({ content: '❌ Pokemon not found or you don\'t own it.', ephemeral: true });
    }

    // Check if already listed
    const existingAuction = await Auction.findOne({
      pokemonInstanceId: pokemon.instanceId,
      status: 'active'
    });

    if (existingAuction) {
      return interaction.editReply({ content: '❌ This Pokemon is already listed!', ephemeral: true });
    }

    // Create auction
    const auctionId = require('uuid').v4().slice(0, 8);
    const auction = new Auction({
      auctionId,
      sellerId: interaction.user.id,
      pokemonInstanceId: pokemon.instanceId,
      startingPrice,
      buyNowPrice: buyNowPrice || null,
      endsAt: new Date(Date.now() + hours * 60 * 60 * 1000)
    });

    await auction.save();

    // Get Pokemon data
    const pokemonData = await PokemonCache.findOne({ id: pokemon.pokemonId });
    const name = pokemonData ? pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1) : 'Unknown';
    const totalIV = Object.values(pokemon.ivs).reduce((a, b) => a + b, 0);
    const ivPercent = Math.round((totalIV / 186) * 100);

    const embed = new EmbedBuilder()
      .setTitle('🏪 Auction Listed!')
      .setDescription(`Your ${pokemon.isShiny ? '✨ ' : ''}${name} is now up for auction!`)
      .setColor(0x22C55E)
      .setThumbnail(pokemon.isShiny && pokemonData?.spriteShiny ? pokemonData.spriteShiny : pokemonData?.sprite)
      .addFields(
        { name: 'Level', value: `${pokemon.level}`, inline: true },
        { name: 'IVs', value: `${ivPercent}%`, inline: true },
        { name: 'Starting Price', value: `💰 ${startingPrice}`, inline: true },
        { name: 'Buy Now', value: buyNowPrice ? `💰 ${buyNowPrice}` : 'N/A', inline: true },
        { name: 'Duration', value: `${hours} hours`, inline: true }
      )
      .setFooter({ text: `Auction ID: ${auctionId}` });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('List auction error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleBrowseAuctions(interaction) {
  await interaction.deferReply();

  try {
    const shinyOnly = interaction.options.getBoolean('shiny') || false;
    const typeFilter = interaction.options.getString('type');

    // Get active auctions
    let auctions = await Auction.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(50);

    if (auctions.length === 0) {
      return interaction.editReply({ content: '📭 No active auctions at the moment.', ephemeral: true });
    }

    // Enrich with Pokemon data and filter
    const enrichedAuctions = [];
    for (const auction of auctions) {
      const pokemon = await UserPokemon.findOne({ instanceId: auction.pokemonInstanceId });
      if (!pokemon) continue;

      if (shinyOnly && !pokemon.isShiny) continue;

      const pokemonData = await PokemonCache.findOne({ id: pokemon.pokemonId });
      if (!pokemonData) continue;

      if (typeFilter && !pokemonData.types.includes(typeFilter)) continue;

      enrichedAuctions.push({
        auction,
        pokemon,
        pokemonData
      });
    }

    if (enrichedAuctions.length === 0) {
      return interaction.editReply({ content: '📭 No auctions match your filters.', ephemeral: true });
    }

    // Pagination
    let page = 0;
    const totalPages = Math.ceil(enrichedAuctions.length / ITEMS_PER_PAGE);

    const generateEmbed = (pageNum) => {
      const start = pageNum * ITEMS_PER_PAGE;
      const pageAuctions = enrichedAuctions.slice(start, start + ITEMS_PER_PAGE);

      let description = '';
      for (const { auction, pokemon, pokemonData } of pageAuctions) {
        const name = pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1);
        const totalIV = Object.values(pokemon.ivs).reduce((a, b) => a + b, 0);
        const ivPercent = Math.round((totalIV / 186) * 100);
        const timeLeft = Math.max(0, Math.floor((new Date(auction.endsAt) - Date.now()) / (60 * 60 * 1000)));

        description += `**${pokemon.isShiny ? '✨ ' : ''}${name}** (Lv.${pokemon.level} | IV: ${ivPercent}%)\n`;
        description += `💰 Current: ${auction.currentBid || auction.startingPrice}`;
        if (auction.buyNowPrice) description += ` | Buy Now: ${auction.buyNowPrice}`;
        description += `\n⏱️ ${timeLeft}h left | ID: \`${auction.auctionId}\`\n\n`;
      }

      return new EmbedBuilder()
        .setTitle('🏪 Auction House')
        .setDescription(description)
        .setColor(0xEAB308)
        .setFooter({ text: `Page ${pageNum + 1}/${totalPages} | ${enrichedAuctions.length} listings` });
    };

    const generateButtons = (pageNum) => {
      return new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('auction_prev')
            .setLabel('◀️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pageNum === 0),
          new ButtonBuilder()
            .setCustomId('auction_next')
            .setLabel('▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pageNum >= totalPages - 1)
        );
    };

    const message = await interaction.editReply({
      embeds: [generateEmbed(page)],
      components: totalPages > 1 ? [generateButtons(page)] : []
    });

    if (totalPages <= 1) return;

    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 120000
    });

    collector.on('collect', async i => {
      if (i.customId === 'auction_prev') page = Math.max(0, page - 1);
      else if (i.customId === 'auction_next') page = Math.min(totalPages - 1, page + 1);

      await i.update({
        embeds: [generateEmbed(page)],
        components: [generateButtons(page)]
      });
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });

  } catch (error) {
    console.error('Browse auctions error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleBid(interaction) {
  await interaction.deferReply();

  try {
    const auctionId = interaction.options.getString('id');
    const amount = interaction.options.getInteger('amount');

    const auction = await Auction.findOne({ auctionId, status: 'active' });
    if (!auction) {
      return interaction.editReply({ content: '❌ Auction not found or has ended.', ephemeral: true });
    }

    if (auction.sellerId === interaction.user.id) {
      return interaction.editReply({ content: '❌ You cannot bid on your own auction!', ephemeral: true });
    }

    const minBid = auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingPrice;
    if (amount < minBid) {
      return interaction.editReply({ content: `❌ Bid must be at least ${minBid} coins.`, ephemeral: true });
    }

    // Check balance
    const user = await User.findOne({ userId: interaction.user.id });
    if (!user || user.balance < amount) {
      return interaction.editReply({ content: '❌ Insufficient balance!', ephemeral: true });
    }

    // Place bid
    auction.currentBid = amount;
    auction.currentBidder = interaction.user.id;
    auction.bids.push({
      bidderId: interaction.user.id,
      amount,
      timestamp: new Date()
    });
    await auction.save();

    // Get Pokemon info
    const pokemon = await UserPokemon.findOne({ instanceId: auction.pokemonInstanceId });
    const pokemonData = await PokemonCache.findOne({ id: pokemon?.pokemonId });
    const name = pokemonData ? pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1) : 'Pokemon';

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('💰 Bid Placed!')
        .setDescription(`You bid ${amount} coins on ${pokemon?.isShiny ? '✨ ' : ''}${name}!`)
        .setColor(0x22C55E)
        .setFooter({ text: `Auction ID: ${auctionId}` })
      ]
    });

  } catch (error) {
    console.error('Bid error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleBuyNow(interaction) {
  await interaction.deferReply();

  try {
    const auctionId = interaction.options.getString('id');

    const auction = await Auction.findOne({ auctionId, status: 'active' });
    if (!auction) {
      return interaction.editReply({ content: '❌ Auction not found or has ended.', ephemeral: true });
    }

    if (!auction.buyNowPrice) {
      return interaction.editReply({ content: '❌ This auction has no buy-now option.', ephemeral: true });
    }

    if (auction.sellerId === interaction.user.id) {
      return interaction.editReply({ content: '❌ You cannot buy your own listing!', ephemeral: true });
    }

    // Check balance
    const user = await User.findOne({ userId: interaction.user.id });
    if (!user || user.balance < auction.buyNowPrice) {
      return interaction.editReply({ content: '❌ Insufficient balance!', ephemeral: true });
    }

    // Execute purchase
    await User.updateOne(
      { userId: interaction.user.id },
      { $inc: { balance: -auction.buyNowPrice } }
    );

    await User.updateOne(
      { userId: auction.sellerId },
      { $inc: { balance: auction.buyNowPrice } }
    );

    await UserPokemon.updateOne(
      { instanceId: auction.pokemonInstanceId },
      { $set: { ownerId: interaction.user.id } }
    );

    auction.status = 'sold';
    auction.currentBidder = interaction.user.id;
    auction.currentBid = auction.buyNowPrice;
    await auction.save();

    // Get Pokemon info
    const pokemon = await UserPokemon.findOne({ instanceId: auction.pokemonInstanceId });
    const pokemonData = await PokemonCache.findOne({ id: pokemon?.pokemonId });
    const name = pokemonData ? pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1) : 'Pokemon';

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('🎉 Purchase Complete!')
        .setDescription(`You bought ${pokemon?.isShiny ? '✨ ' : ''}${name} for ${auction.buyNowPrice} coins!`)
        .setColor(0x22C55E)
        .setThumbnail(pokemon?.isShiny && pokemonData?.spriteShiny ? pokemonData.spriteShiny : pokemonData?.sprite)
      ]
    });

  } catch (error) {
    console.error('Buy now error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleMyListings(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const auctions = await Auction.find({
      sellerId: interaction.user.id,
      status: 'active'
    }).sort({ createdAt: -1 });

    if (auctions.length === 0) {
      return interaction.editReply({ content: '📭 You have no active listings.', ephemeral: true });
    }

    let description = '';
    for (const auction of auctions) {
      const pokemon = await UserPokemon.findOne({ instanceId: auction.pokemonInstanceId });
      const pokemonData = await PokemonCache.findOne({ id: pokemon?.pokemonId });
      const name = pokemonData ? pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1) : 'Unknown';

      description += `**${pokemon?.isShiny ? '✨ ' : ''}${name}** (ID: ${auction.auctionId})\n`;
      description += `Current Bid: ${auction.currentBid || auction.startingPrice} | Bids: ${auction.bids.length}\n\n`;
    }

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('📋 Your Auction Listings')
        .setDescription(description)
        .setColor(0x3B82F6)
      ],
      ephemeral: true
    });

  } catch (error) {
    console.error('My listings error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleCancelAuction(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const auctionId = interaction.options.getString('id');

    const auction = await Auction.findOne({
      auctionId,
      sellerId: interaction.user.id,
      status: 'active'
    });

    if (!auction) {
      return interaction.editReply({ content: '❌ Auction not found or you\'re not the seller.', ephemeral: true });
    }

    if (auction.bids.length > 0) {
      return interaction.editReply({ content: '❌ Cannot cancel - there are already bids!', ephemeral: true });
    }

    auction.status = 'cancelled';
    await auction.save();

    await interaction.editReply({ content: '✅ Auction cancelled.', ephemeral: true });

  } catch (error) {
    console.error('Cancel auction error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}
