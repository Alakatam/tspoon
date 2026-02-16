require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const redis = require('redis');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Import models
const PokemonCache = require('./models/PokemonCache');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Command collection
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: ${command.data.name}`);
  }
}

// Redis client (optional)
let redisClient = null;

// Connect to MongoDB
async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: process.env.DB_NAME
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Connect to Redis (optional)
async function connectRedis() {
  try {
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
    console.log('✅ Connected to Redis');
  } catch (error) {
    console.warn('⚠️ Redis connection failed, running without cache:', error.message);
  }
}

// Sync Pokemon data from PokeAPI
async function syncPokeAPI(limit = 151) {
  console.log(`🔄 Starting PokeAPI sync for first ${limit} Pokémon...`);
  
  const existingCount = await PokemonCache.countDocuments();
  if (existingCount >= limit) {
    console.log(`✅ Already have ${existingCount} Pokémon in cache`);
    return;
  }

  const POKEAPI_URL = process.env.POKEAPI_URL || 'https://pokeapi.co/api/v2';
  
  for (let id = 1; id <= limit; id++) {
    try {
      // Check if already cached
      const exists = await PokemonCache.findOne({ id });
      if (exists) continue;

      const response = await axios.get(`${POKEAPI_URL}/pokemon/${id}`);
      const data = response.data;

      // Determine region based on ID
      let region = 'unknown';
      let generation = 1;
      if (id <= 151) { region = 'kanto'; generation = 1; }
      else if (id <= 251) { region = 'johto'; generation = 2; }
      else if (id <= 386) { region = 'hoenn'; generation = 3; }
      else if (id <= 493) { region = 'sinnoh'; generation = 4; }
      else if (id <= 649) { region = 'unova'; generation = 5; }
      else if (id <= 721) { region = 'kalos'; generation = 6; }
      else if (id <= 809) { region = 'alola'; generation = 7; }
      else if (id <= 905) { region = 'galar'; generation = 8; }
      else { region = 'paldea'; generation = 9; }

      const pokemon = new PokemonCache({
        id: data.id,
        name: data.name,
        types: data.types.map(t => t.type.name),
        stats: {
          hp: data.stats[0].base_stat,
          attack: data.stats[1].base_stat,
          defense: data.stats[2].base_stat,
          spAttack: data.stats[3].base_stat,
          spDefense: data.stats[4].base_stat,
          speed: data.stats[5].base_stat
        },
        sprite: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
        spriteShiny: data.sprites.other['official-artwork'].front_shiny || data.sprites.front_shiny,
        height: data.height,
        weight: data.weight,
        abilities: data.abilities.map(a => a.ability.name),
        moves: data.moves.slice(0, 20).map(m => m.move.name),
        region,
        generation
      });

      await pokemon.save();
      
      if (id % 25 === 0) {
        console.log(`📦 Synced ${id}/${limit} Pokémon...`);
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Error syncing Pokémon #${id}:`, error.message);
    }
  }

  console.log('✅ PokeAPI sync complete!');
}

// Bot ready event
client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}!`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  
  // Set bot presence
  client.user.setPresence({
    activities: [{ name: '/wild to catch Pokémon!', type: 3 }],
    status: 'online'
  });

  // Sync PokeAPI data - ALL 1025 Pokemon
  await syncPokeAPI(1025);
});

// Handle slash commands
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);
    
    const errorMessage = '❌ There was an error executing this command.';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Handle button interactions (for wild catches)
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  
  // Button handlers are in the command files themselves
});

// Error handling
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await mongoose.connection.close();
  if (redisClient) await redisClient.quit();
  process.exit(0);
});

// Start the bot
async function start() {
  await connectDatabase();
  await connectRedis();
  
  if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.error('❌ Please set your DISCORD_TOKEN in the .env file');
    console.log('📖 Get your token from: https://discord.com/developers/applications');
    process.exit(1);
  }
  
  await client.login(process.env.DISCORD_TOKEN);
}

start();
