require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command) {
    commands.push(command.data.toJSON());
    console.log(`✅ Loaded: ${command.data.name}`);
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Deploying ${commands.length} slash commands...`);

    const applicationId = process.env.CLIENT_ID || process.env.DISCORD_BOT_ID;
    const guildId = process.env.GUILD_ID || process.env.DISCORD_SERVER_ID;

    if (!applicationId || applicationId === 'YOUR_CLIENT_ID_HERE') {
      console.error('❌ Please set CLIENT_ID or DISCORD_BOT_ID in the .env file');
      process.exit(1);
    }

    if (!guildId || guildId === 'YOUR_GUILD_ID_HERE') {
      console.error('❌ Please set GUILD_ID or DISCORD_SERVER_ID in the .env file');
      process.exit(1);
    }

    if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
      console.error('❌ Please set your DISCORD_TOKEN in the .env file');
      process.exit(1);
    }

    // Deploy to a single guild (updates almost instantly)
    const data = await rest.put(
      Routes.applicationGuildCommands(applicationId, guildId),
      { body: commands }
    );

    console.log(`✅ Successfully deployed ${data.length} commands to guild ${guildId}!`);
    console.log('📖 Note: Guild commands appear almost instantly.');
    
    console.log('\nDeployed commands:');
    commands.forEach(cmd => {
      console.log(`  - /${cmd.name}: ${cmd.description}`);
    });

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
