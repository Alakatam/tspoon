# Twisted Spoon Bot - Product Requirements Document

## Project Overview
**Project Name:** Twisted Spoon Bot  
**Version:** 3.0.0 (All Phases Complete)  
**Last Updated:** Feb 16, 2026

## Dashboard Access
🌐 **https://pokequestbot.preview.emergentagent.com**

## Bot Download Location
📦 **`/app/export/twisted-spoon-bot.zip`** (60KB - ready for VS Code)

## What's Implemented ✅

### Phase 1-2: Foundation & Core (Complete)
- 1025 Pokemon synced from PokeAPI
- `/wild`, `/box`, `/dex`, `/info`, `/affection`, `/bounty`
- Shiny pity system, biome/weather spawning
- Regional Pokedex tracking (9 regions)

### Phase 3: Battle System (Complete)
- `/battle gym` - 8 Kanto Gym Leaders
- `/battle duel` - PvP dueling
- Turn-based combat with type effectiveness
- Status effects: Burn, Paralysis, Poison, Sleep, Freeze
- Gym badges and coin rewards

### Phase 4: Economy (Complete)
- `/trade offer/accept/cancel` - 2-way trading
- `/auction list/browse/bid/buy` - Auction house
- `/release` - Release Pokemon for Essence

### Phase 5: Breeding & Expeditions (Complete)
- `/breed deposit/check/collect/eggs/hatch` - Full breeding
- `/expedition start/status/claim` - 4 mission types
- Egg hatching with inherited traits
- Passive resource gathering

### Phase 6: Raids & World Boss (Complete)
- `/raid spawn/join/attack` - Co-op raids (2-4 players)
- `/worldboss status/attack/leaderboard` - Global boss
- Raid rewards with shiny chances
- Server-wide damage contribution

## Complete Command List (15 Commands)

| Command | Description |
|---------|-------------|
| `/wild` | Catch Pokemon (biome/weather modifiers) |
| `/box` | View collection with filters |
| `/dex` | Pokedex completion tracking |
| `/info` | Detailed Pokemon stats |
| `/affection` | Type matchup guide |
| `/bounty` | Daily challenges |
| `/battle` | Gym Leaders & PvP |
| `/trade` | Secure trading system |
| `/auction` | Marketplace |
| `/breed` | Breeding & egg hatching |
| `/expedition` | Send Pokemon on missions |
| `/release` | Release for currency |
| `/raid` | Co-op raid battles |
| `/worldboss` | Global boss battle |

## File Structure
```
twisted-spoon-bot/
├── index.js              # Main bot
├── deploy-commands.js    # Command registration
├── package.json
├── .env.example
├── README.md             # Full documentation
├── commands/             # 15 command files
│   ├── wild.js
│   ├── box.js
│   ├── dex.js
│   ├── info.js
│   ├── affection.js
│   ├── bounty.js
│   ├── battle.js
│   ├── trade.js
│   ├── auction.js
│   ├── breed.js
│   ├── expedition.js
│   ├── release.js
│   ├── raid.js
│   └── worldboss.js
├── models/
│   ├── User.js
│   ├── Pokemon.js
│   ├── PokemonCache.js
│   └── GlobalSettings.js
└── utils/
    └── TypeChart.js
```

## Setup Instructions

1. Download `/app/export/twisted-spoon-bot.zip`
2. Extract to your VS Code workspace
3. Run `npm install` or `yarn install`
4. Copy `.env.example` to `.env`
5. Add your Discord token and Client ID
6. Run `npm run deploy` to register commands
7. Run `npm start` to launch the bot

## Technical Stack
- **Bot:** Discord.js v14, Node.js
- **Database:** MongoDB with Mongoose
- **Cache:** Redis (optional)
- **API:** PokeAPI for Pokemon data
- **Dashboard:** React + FastAPI

## All Features Summary

| Feature | Status |
|---------|--------|
| 1025 Pokemon Database | ✅ |
| Wild Encounters | ✅ |
| Shiny System (1/512 + Pity) | ✅ |
| Biome/Weather Spawning | ✅ |
| Box Inventory + Filters | ✅ |
| Pokedex (9 Regions) | ✅ |
| Pokemon Details (IVs/EVs) | ✅ |
| Type Effectiveness Chart | ✅ |
| Daily Bounties | ✅ |
| 8 Gym Leaders | ✅ |
| PvP Dueling | ✅ |
| Status Effects | ✅ |
| Trading (2-way handshake) | ✅ |
| Auction House | ✅ |
| Pokemon Release | ✅ |
| Breeding System | ✅ |
| Egg Hatching | ✅ |
| Expeditions (4 types) | ✅ |
| Raid Battles (2-4 players) | ✅ |
| World Boss (Global) | ✅ |
| Web Dashboard | ✅ |
| Leaderboards | ✅ |
