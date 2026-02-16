# 🥄 Twisted Spoon - Pokemon Discord Bot

A comprehensive Pokemon Discord bot with catching, battling, trading, raids, and more!

## 🚀 Features

### Phase 1-2: Core Loop
- **`/wild [biome]`** - Encounter wild Pokemon with biome and weather modifiers
- **`/box [filters]`** - View your collection with shiny/type/IV filters
- **`/dex [region]`** - Track Pokedex completion across all 9 regions
- **`/info <id>`** - Detailed Pokemon stats (IVs, EVs, nature)
- **`/affection <pokemon>`** - Type matchup and battle guide
- **`/bounty`** - Daily challenges for rewards

### Phase 3: Battle System
- **`/battle gym <leader> <pokemon>`** - Challenge 8 Kanto Gym Leaders
- **`/battle duel <user> <pokemon>`** - PvP dueling system
- Turn-based combat with type effectiveness
- Status effects: Burn, Paralysis, Poison, Sleep, Freeze
- Gym badges and coin rewards

### Phase 4: Economy
- **`/trade offer/accept/cancel`** - Secure 2-way trading
- **`/auction list/browse/bid/buy`** - Auction house system
- **`/release <pokemon>`** - Release Pokemon for Essence currency

### Phase 5: Breeding & Expeditions
- **`/breed deposit/check/collect/eggs/hatch`** - Full breeding system
- **`/expedition start/status/claim`** - Send Pokemon on missions

### Phase 6: Raids & World Boss
- **`/raid spawn/join/attack/active`** - Co-op raid battles (2-4 players)
- **`/worldboss status/attack/leaderboard`** - Global boss with server-wide damage

## 📦 Installation

### Prerequisites
- Node.js 18+
- MongoDB database
- Redis (optional, for caching)
- Discord Bot Token

### Setup

1. **Clone/Download the bot folder**

2. **Install dependencies:**
```bash
cd twisted-spoon-bot
npm install
# or
yarn install
```

3. **Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
MONGO_URL=mongodb://localhost:27017
DB_NAME=twisted_spoon
REDIS_URL=redis://localhost:6379
```

4. **Deploy slash commands:**
```bash
npm run deploy
# or
yarn deploy
```

5. **Start the bot:**
```bash
npm start
# or
yarn start
```

## 🤖 Getting Discord Credentials

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it "Twisted Spoon"
3. Go to "Bot" section and click "Add Bot"
4. Copy the **Token** (this is your `DISCORD_TOKEN`)
5. Go to "OAuth2" → "General" and copy the **Client ID**
6. Enable these Privileged Gateway Intents:
   - Message Content Intent
   - Server Members Intent (optional)

## 🔗 Inviting the Bot

Use this URL format to invite your bot:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=277025508352&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your actual Client ID.

## 📁 File Structure

```
twisted-spoon-bot/
├── index.js              # Main bot file
├── deploy-commands.js    # Command registration
├── package.json          # Dependencies
├── .env                  # Configuration (create from .env.example)
├── .env.example          # Example configuration
├── commands/
│   ├── wild.js           # /wild - Catching
│   ├── box.js            # /box - Inventory
│   ├── dex.js            # /dex - Pokedex
│   ├── info.js           # /info - Pokemon details
│   ├── affection.js      # /affection - Type guide
│   ├── bounty.js         # /bounty - Daily quests
│   ├── battle.js         # /battle - Gym & PvP
│   ├── trade.js          # /trade - Trading
│   ├── auction.js        # /auction - Marketplace
│   ├── breed.js          # /breed - Breeding
│   ├── expedition.js     # /expedition - Missions
│   ├── release.js        # /release - Release Pokemon
│   ├── raid.js           # /raid - Co-op raids
│   └── worldboss.js      # /worldboss - Global boss
├── models/
│   ├── User.js           # User schema
│   ├── Pokemon.js        # User's Pokemon schema
│   ├── PokemonCache.js   # PokeAPI cache schema
│   └── GlobalSettings.js # Global settings schema
└── utils/
    └── TypeChart.js      # Type effectiveness calculator
```

## 🎮 Command Reference

| Command | Description |
|---------|-------------|
| `/wild [biome]` | Encounter Pokemon (forest, mountain, ocean, cave, city, meadow) |
| `/box [--shiny] [--type] [--miniv]` | View collection with filters |
| `/dex [region]` | Pokedex progress (kanto, johto, hoenn, etc.) |
| `/info <id>` | View Pokemon details by instance ID |
| `/affection <name>` | View type matchups and battle tips |
| `/bounty` | View and claim daily bounties |
| `/battle gym <leader> <pokemon>` | Challenge a Gym Leader |
| `/battle duel <user> <pokemon>` | Challenge another trainer |
| `/trade offer <user> <pokemon>` | Create trade offer |
| `/trade pending` | View pending trades |
| `/trade accept <id>` | Accept a trade |
| `/trade cancel <id>` | Cancel your trade |
| `/auction list <pokemon> <price>` | List Pokemon for auction |
| `/auction browse [--shiny] [--type]` | Browse auctions |
| `/auction bid <id> <amount>` | Place a bid |
| `/auction buy <id>` | Buy now (if available) |
| `/breed deposit <p1> <p2>` | Deposit Pokemon at nursery |
| `/breed check` | Check nursery status |
| `/breed collect` | Collect ready egg |
| `/breed eggs` | View your eggs |
| `/breed hatch <egg>` | Hatch an egg |
| `/expedition start <pokemon> <mission>` | Start expedition |
| `/expedition status` | View active expeditions |
| `/expedition claim <id>` | Claim rewards |
| `/release <pokemon>` | Release for Essence |
| `/raid spawn <difficulty>` | Spawn a raid boss |
| `/raid join <id> <pokemon>` | Join a raid |
| `/raid attack <id>` | Attack raid boss |
| `/raid active` | View active raids |
| `/worldboss status` | View World Boss |
| `/worldboss attack <pokemon>` | Attack World Boss |
| `/worldboss leaderboard` | Damage rankings |

## 🏆 Gym Leaders

| Leader | Type | Badge | Level Range | Reward |
|--------|------|-------|-------------|--------|
| Brock | Rock | Boulder | 12-14 | 500 |
| Misty | Water | Cascade | 18-21 | 750 |
| Lt. Surge | Electric | Thunder | 21-24 | 1000 |
| Erika | Grass | Rainbow | 29-32 | 1250 |
| Koga | Poison | Soul | 37-43 | 1500 |
| Sabrina | Psychic | Marsh | 38-43 | 1750 |
| Blaine | Fire | Volcano | 42-47 | 2000 |
| Giovanni | Ground | Earth | 45-50 | 2500 |

## 📊 Database

The bot uses MongoDB with these collections:
- `users` - Player profiles
- `userpokemons` - Caught Pokemon
- `pokemoncaches` - PokeAPI data (auto-synced)
- `trades` - Trade offers
- `auctions` - Auction listings
- `eggs` - Breeding eggs
- `expeditions` - Active expeditions
- `raids` - Raid battles
- `worldbosses` - World Boss state

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal | Yes |
| `CLIENT_ID` | Application Client ID | Yes |
| `MONGO_URL` | MongoDB connection string | Yes |
| `DB_NAME` | Database name | Yes |
| `REDIS_URL` | Redis connection (for caching) | No |
| `POKEAPI_URL` | PokeAPI base URL | No |

## 📝 License

MIT License - Feel free to modify and use!

## 🙏 Credits

- Pokemon data from [PokeAPI](https://pokeapi.co/)
- Built with [Discord.js](https://discord.js.org/)
- Not affiliated with Nintendo or The Pokemon Company
