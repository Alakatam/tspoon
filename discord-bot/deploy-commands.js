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

    if (!process.env.CLIENT_ID || process.env.CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
      console.error('❌ Please set your CLIENT_ID in the .env file');
      process.exit(1);
    }

    if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
      console.error('❌ Please set your DISCORD_TOKEN in the .env file');
      process.exit(1);
    }

    // Deploy globally (takes up to an hour to propagate)
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log(`✅ Successfully deployed ${data.length} commands globally!`);
    console.log('📖 Note: Global commands may take up to 1 hour to appear.');
    
    console.log('\nDeployed commands:');
    commands.forEach(cmd => {
      console.log(`  - /${cmd.name}: ${cmd.description}`);
    });

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
