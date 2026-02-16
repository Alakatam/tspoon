const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');
const mongoose = require('mongoose');

// Trade Schema
const tradeSchema = new mongoose.Schema({
  tradeId: { type: String, required: true, unique: true },
  offererId: String,
  receiverId: String,
  offeredPokemon: [String],
  requestedPokemon: [String],
  offeredCoins: { type: Number, default: 0 },
  requestedCoins: { type: Number, default: 0 },
  status: { type: String, default: 'pending' },
  offererLocked: { type: Boolean, default: false },
  receiverLocked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});

const Trade = mongoose.models.Trade || mongoose.model('Trade', tradeSchema);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Trade Pokemon with other trainers')
    .addSubcommand(subcommand =>
      subcommand
        .setName('offer')
        .setDescription('Create a trade offer')
        .addUserOption(option =>
          option.setName('trainer')
            .setDescription('The trainer to trade with')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('offer')
            .setDescription('Pokemon instance ID(s) to offer (comma separated)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('request')
            .setDescription('Pokemon instance ID(s) you want (comma separated)')
        )
        .addIntegerOption(option =>
          option.setName('coins')
            .setDescription('Coins to include in your offer')
            .setMinValue(0)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('pending')
        .setDescription('View your pending trade offers')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('accept')
        .setDescription('Accept a trade offer')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Trade ID to accept')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('Cancel a trade offer you created')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Trade ID to cancel')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'offer':
        await handleTradeOffer(interaction);
        break;
      case 'pending':
        await handlePendingTrades(interaction);
        break;
      case 'accept':
        await handleAcceptTrade(interaction);
        break;
      case 'cancel':
        await handleCancelTrade(interaction);
        break;
    }
  }
};

async function handleTradeOffer(interaction) {
  await interaction.deferReply();

  try {
    const targetUser = interaction.options.getUser('trainer');
    const offerIds = interaction.options.getString('offer').split(',').map(s => s.trim());
    const requestIds = interaction.options.getString('request')?.split(',').map(s => s.trim()) || [];
    const coins = interaction.options.getInteger('coins') || 0;

    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({ content: '❌ You cannot trade with yourself!', ephemeral: true });
    }

    if (targetUser.bot) {
      return interaction.editReply({ content: '❌ You cannot trade with bots!', ephemeral: true });
    }

    // Verify offered Pokemon
    const offeredPokemon = [];
    for (const id of offerIds) {
      const pokemon = await UserPokemon.findOne({
        ownerId: interaction.user.id,
        instanceId: { $regex: `^${id}`, $options: 'i' }
      });
      if (!pokemon) {
        return interaction.editReply({ content: `❌ You don't own Pokemon with ID: ${id}`, ephemeral: true });
      }
      offeredPokemon.push(pokemon);
    }

    // Verify coins
    const user = await User.findOne({ userId: interaction.user.id });
    if (coins > 0 && (!user || user.balance < coins)) {
      return interaction.editReply({ content: '❌ You don\'t have enough coins!', ephemeral: true });
    }

    // Create trade
    const tradeId = require('uuid').v4().slice(0, 8);
    const trade = new Trade({
      tradeId,
      offererId: interaction.user.id,
      receiverId: targetUser.id,
      offeredPokemon: offeredPokemon.map(p => p.instanceId),
      requestedPokemon: requestIds,
      offeredCoins: coins,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    await trade.save();

    // Build embed
    const offerList = [];
    for (const pokemon of offeredPokemon) {
      const data = await PokemonCache.findOne({ id: pokemon.pokemonId });
      const name = data ? data.name.charAt(0).toUpperCase() + data.name.slice(1) : 'Unknown';
      offerList.push(`${pokemon.isShiny ? '✨' : ''} ${name} (Lv.${pokemon.level})`);
    }

    const embed = new EmbedBuilder()
      .setTitle('📦 Trade Offer Created!')
      .setDescription(`${interaction.user} wants to trade with ${targetUser}`)
      .setColor(0x3B82F6)
      .addFields(
        { name: 'Offering', value: offerList.join('\n') + (coins > 0 ? `\n💰 ${coins} coins` : ''), inline: true },
        { name: 'Requesting', value: requestIds.length > 0 ? requestIds.join(', ') : 'Nothing specific', inline: true }
      )
      .setFooter({ text: `Trade ID: ${tradeId} | Expires in 24 hours` });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`trade_accept_${tradeId}`)
          .setLabel('✅ Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade_decline_${tradeId}`)
          .setLabel('❌ Decline')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.editReply({
      content: `${targetUser}`,
      embeds: [embed],
      components: [row]
    });

    // Wait for response
    try {
      const response = await interaction.channel.awaitMessageComponent({
        filter: i => i.user.id === targetUser.id && i.customId.includes(tradeId),
        time: 300000
      });

      if (response.customId.startsWith('trade_decline')) {
        trade.status = 'rejected';
        await trade.save();
        await response.update({
          content: `${targetUser} declined the trade.`,
          embeds: [],
          components: []
        });
        return;
      }

      // Accept trade - execute it
      await executeTrade(trade, response);

    } catch (err) {
      trade.status = 'expired';
      await trade.save();
      await interaction.editReply({
        content: 'Trade offer expired - no response received.',
        embeds: [],
        components: []
      }).catch(() => {});
    }

  } catch (error) {
    console.error('Trade offer error:', error);
    await interaction.editReply({ content: '❌ An error occurred creating the trade.', ephemeral: true });
  }
}

async function executeTrade(trade, interaction) {
  try {
    // Transfer offered Pokemon
    for (const instanceId of trade.offeredPokemon) {
      await UserPokemon.updateOne(
        { instanceId },
        { $set: { ownerId: trade.receiverId } }
      );
    }

    // Transfer requested Pokemon (if any)
    for (const instanceId of trade.requestedPokemon) {
      const pokemon = await UserPokemon.findOne({
        ownerId: trade.receiverId,
        instanceId: { $regex: `^${instanceId}`, $options: 'i' }
      });
      if (pokemon) {
        await UserPokemon.updateOne(
          { instanceId: pokemon.instanceId },
          { $set: { ownerId: trade.offererId } }
        );
      }
    }

    // Transfer coins
    if (trade.offeredCoins > 0) {
      await User.updateOne(
        { userId: trade.offererId },
        { $inc: { balance: -trade.offeredCoins } }
      );
      await User.updateOne(
        { userId: trade.receiverId },
        { $inc: { balance: trade.offeredCoins } }
      );
    }

    trade.status = 'completed';
    await trade.save();

    await interaction.update({
      content: '✅ Trade completed successfully!',
      embeds: [new EmbedBuilder()
        .setTitle('🤝 Trade Complete!')
        .setDescription('Pokemon and coins have been exchanged.')
        .setColor(0x22C55E)
      ],
      components: []
    });

  } catch (error) {
    console.error('Execute trade error:', error);
    await interaction.update({
      content: '❌ Trade failed - please try again.',
      embeds: [],
      components: []
    });
  }
}

async function handlePendingTrades(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const trades = await Trade.find({
      $or: [
        { offererId: interaction.user.id },
        { receiverId: interaction.user.id }
      ],
      status: 'pending'
    }).sort({ createdAt: -1 }).limit(10);

    if (trades.length === 0) {
      return interaction.editReply({ content: '📭 No pending trades.', ephemeral: true });
    }

    let description = '';
    for (const trade of trades) {
      const isOfferer = trade.offererId === interaction.user.id;
      const role = isOfferer ? 'Sent to' : 'Received from';
      const otherId = isOfferer ? trade.receiverId : trade.offererId;
      
      description += `**ID: ${trade.tradeId}**\n`;
      description += `${role}: <@${otherId}>\n`;
      description += `Offering: ${trade.offeredPokemon.length} Pokemon${trade.offeredCoins > 0 ? ` + ${trade.offeredCoins} coins` : ''}\n\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle('📦 Pending Trades')
      .setDescription(description)
      .setColor(0xEAB308)
      .setFooter({ text: 'Use /trade accept <id> or /trade cancel <id>' });

    await interaction.editReply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('Pending trades error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleAcceptTrade(interaction) {
  await interaction.deferReply();

  try {
    const tradeId = interaction.options.getString('id');
    
    const trade = await Trade.findOne({
      tradeId,
      receiverId: interaction.user.id,
      status: 'pending'
    });

    if (!trade) {
      return interaction.editReply({ content: '❌ Trade not found or you are not the recipient.', ephemeral: true });
    }

    await executeTrade(trade, { update: (opts) => interaction.editReply(opts) });

  } catch (error) {
    console.error('Accept trade error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}

async function handleCancelTrade(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const tradeId = interaction.options.getString('id');
    
    const trade = await Trade.findOne({
      tradeId,
      offererId: interaction.user.id,
      status: 'pending'
    });

    if (!trade) {
      return interaction.editReply({ content: '❌ Trade not found or you are not the offerer.', ephemeral: true });
    }

    trade.status = 'cancelled';
    await trade.save();

    await interaction.editReply({ content: '✅ Trade cancelled.', ephemeral: true });

  } catch (error) {
    console.error('Cancel trade error:', error);
    await interaction.editReply({ content: '❌ An error occurred.', ephemeral: true });
  }
}
