const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const UserPokemon = require('../models/Pokemon');
const PokemonCache = require('../models/PokemonCache');

// Daily bounty templates
const BOUNTY_TEMPLATES = [
  { type: 'catch_type', description: 'Catch {count} {type}-type Pokémon', reward: { coins: 500 } },
  { type: 'catch_level', description: 'Catch a Pokémon at level {level} or higher', reward: { coins: 300 } },
  { type: 'catch_any', description: 'Catch {count} Pokémon', reward: { coins: 200 } },
  { type: 'catch_species', description: 'Catch a {species}', reward: { coins: 400 } },
];

const TYPES = ['fire', 'water', 'grass', 'electric', 'psychic', 'ghost', 'dragon', 'dark', 'steel', 'fairy', 'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ice'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bounty')
    .setDescription('View daily bounties and claim rewards'),

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

      // Check if daily bounties need to be reset
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastDaily = user.lastDaily ? new Date(user.lastDaily) : null;
      const needsReset = !lastDaily || lastDaily < today;

      if (needsReset) {
        // Generate new daily bounties
        const bounties = generateDailyBounties();
        user.questProgress.daily = new Map(bounties.map((b, i) => [`bounty_${i}`, { ...b, progress: 0, completed: false, claimed: false }]));
        user.lastDaily = new Date();
        await user.save();
      }

      // Get current bounties
      const bounties = user.questProgress.daily || new Map();
      
      const embed = new EmbedBuilder()
        .setTitle('🎯 Daily Bounties')
        .setDescription('Complete bounties to earn rewards! Resets at midnight.')
        .setColor(0xEAB308)
        .setThumbnail(interaction.user.displayAvatarURL());

      let bountyIndex = 0;
      let allClaimed = true;
      
      for (const [key, bounty] of bounties) {
        bountyIndex++;
        const status = bounty.claimed ? '✅ Claimed' : 
                       bounty.completed ? '🎉 Complete!' : 
                       `📍 ${bounty.progress || 0}/${bounty.target || 1}`;
        
        if (!bounty.claimed) allClaimed = false;
        
        const rewardText = formatReward(bounty.reward);
        
        embed.addFields({
          name: `Bounty #${bountyIndex}: ${status}`,
          value: `${bounty.description}\n**Reward:** ${rewardText}`,
          inline: false
        });
      }

      // Check for claimable bounties
      let claimableRewards = { coins: 0 };
      let hasClaimable = false;
      
      for (const [key, bounty] of bounties) {
        if (bounty.completed && !bounty.claimed) {
          hasClaimable = true;
          if (bounty.reward.coins) claimableRewards.coins += bounty.reward.coins;
        }
      }

      if (hasClaimable) {
        // Auto-claim completed bounties
        for (const [key, bounty] of bounties) {
          if (bounty.completed && !bounty.claimed) {
            bounty.claimed = true;
            if (bounty.reward.coins) user.balance += bounty.reward.coins;
          }
        }
        
        user.questProgress.daily = bounties;
        await user.save();

        embed.addFields({
          name: '💰 Rewards Claimed!',
          value: `You received ${claimableRewards.coins} coins!\nNew balance: ${user.balance} coins`,
          inline: false
        });
      }

      // Time until reset
      const midnight = new Date();
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      const timeUntilReset = midnight - new Date();
      const hoursLeft = Math.floor(timeUntilReset / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));

      embed.setFooter({ 
        text: `Resets in ${hoursLeft}h ${minutesLeft}m | Balance: ${user.balance} coins` 
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Bounty command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching bounties.',
        ephemeral: true
      });
    }
  }
};

function generateDailyBounties() {
  const bounties = [];
  const usedTypes = new Set();
  
  // Generate 3 random bounties
  for (let i = 0; i < 3; i++) {
    const template = BOUNTY_TEMPLATES[Math.floor(Math.random() * BOUNTY_TEMPLATES.length)];
    const bounty = { ...template };
    
    switch (template.type) {
      case 'catch_type':
        let type;
        do {
          type = TYPES[Math.floor(Math.random() * TYPES.length)];
        } while (usedTypes.has(type));
        usedTypes.add(type);
        
        const count = Math.floor(Math.random() * 3) + 2; // 2-4
        bounty.description = template.description.replace('{count}', count).replace('{type}', type.charAt(0).toUpperCase() + type.slice(1));
        bounty.target = count;
        bounty.targetType = type;
        break;
        
      case 'catch_level':
        const level = Math.floor(Math.random() * 20) + 20; // 20-39
        bounty.description = template.description.replace('{level}', level);
        bounty.target = 1;
        bounty.targetLevel = level;
        break;
        
      case 'catch_any':
        const anyCount = Math.floor(Math.random() * 5) + 5; // 5-9
        bounty.description = template.description.replace('{count}', anyCount);
        bounty.target = anyCount;
        break;
        
      case 'catch_species':
        // Random common Pokemon
        const commonPokemon = ['Rattata', 'Pidgey', 'Caterpie', 'Weedle', 'Zubat', 'Geodude', 'Magikarp', 'Tentacool'];
        const species = commonPokemon[Math.floor(Math.random() * commonPokemon.length)];
        bounty.description = template.description.replace('{species}', species);
        bounty.target = 1;
        bounty.targetSpecies = species.toLowerCase();
        break;
    }
    
    bounties.push(bounty);
  }
  
  return bounties;
}

function formatReward(reward) {
  const parts = [];
  if (reward.coins) parts.push(`${reward.coins} coins`);
  if (reward.items) {
    for (const [item, count] of Object.entries(reward.items)) {
      parts.push(`${count}x ${item}`);
    }
  }
  return parts.join(', ') || 'None';
}
