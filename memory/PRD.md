# Twisted Spoon Bot - Product Requirements Document

## Project Overview
**Project Name:** Twisted Spoon Bot  
**Version:** 2.0.0 (Phase 1-4 Complete)  
**Last Updated:** Feb 16, 2026

## Original Problem Statement
Build a comprehensive Pokemon Discord Bot with:
- Phase 1: Foundation (MongoDB schemas for Users, Pokemon, Global data)
- Phase 2: Core Loop (/wild, /box, /dex, /info, /affection, /bounty commands)
- Phase 3: Battle System (Gym Leaders, PvP, Status Effects)
- Phase 4: Social Economy (Trading, Auction House)
- All 1025 Pokemon from PokeAPI
- Redis caching for performance

## User Choices
- **Framework:** Discord.js v14
- **Database:** MongoDB (existing environment)
- **Caching:** Redis from start
- **Data Sync:** ALL Pokemon (1025)
- **Scope:** Phase 1-4

## Dashboard Access
**URL:** https://pokequestbot.preview.emergentagent.com

## What's Been Implemented ✅

### Phase 1: Foundation (Complete)
- [x] MongoDB schemas for Users, Pokemon, Global
- [x] Pokemon cache from PokeAPI (ALL 1025 Pokemon)
- [x] Type effectiveness chart utility
- [x] Redis caching infrastructure

### Phase 2: Core Loop (Complete)
- [x] `/wild` - Encounter Pokemon (biome/weather/shiny mechanics)
- [x] `/box` - View collection with filters
- [x] `/dex` - Regional Pokedex tracking (all 9 regions)
- [x] `/info` - Detailed Pokemon stats
- [x] `/affection` - Battle guide with type matchups
- [x] `/bounty` - Daily challenges

### Phase 3: Battle System (Complete)
- [x] `/battle gym <leader>` - Challenge 8 Kanto Gym Leaders
- [x] `/battle duel <user>` - PvP dueling system
- [x] Turn-based battle engine with damage calculation
- [x] Status effects (Burn, Paralysis, Poison, Sleep, Freeze, Confusion)
- [x] Gym badges and rewards system
- [x] PvP win/loss tracking
- [x] PvP Leaderboard

### Phase 4: Trading & Economy (Complete)
- [x] `/trade offer` - Create trade with 2-way handshake
- [x] `/trade pending` - View pending trades
- [x] `/trade accept` - Accept trade offers
- [x] `/trade cancel` - Cancel trades
- [x] `/auction list` - List Pokemon for auction
- [x] `/auction browse` - Browse active auctions (with filters)
- [x] `/auction bid` - Place bids
- [x] `/auction buy` - Buy now option
- [x] `/auction mylistings` - View your listings
- [x] `/auction cancel` - Cancel listings (if no bids)

## Gym Leaders (Kanto)
| Leader | Badge | Type | Reward |
|--------|-------|------|--------|
| Brock | Boulder Badge | Rock | 500 coins |
| Misty | Cascade Badge | Water | 750 coins |
| Lt. Surge | Thunder Badge | Electric | 1000 coins |
| Erika | Rainbow Badge | Grass | 1250 coins |
| Koga | Soul Badge | Poison | 1500 coins |
| Sabrina | Marsh Badge | Psychic | 1750 coins |
| Blaine | Volcano Badge | Fire | 2000 coins |
| Giovanni | Earth Badge | Ground | 2500 coins |

## Discord Bot Commands Reference
| Command | Description |
|---------|-------------|
| `/wild [biome]` | Encounter wild Pokemon |
| `/box [filters]` | View your collection |
| `/dex [region]` | View Pokedex progress |
| `/info <id>` | View Pokemon details |
| `/affection <pokemon>` | View type matchups |
| `/bounty` | View daily challenges |
| `/battle gym <leader> <pokemon>` | Challenge gym leader |
| `/battle duel <user> <pokemon>` | PvP duel |
| `/trade offer <user> <pokemon>` | Create trade |
| `/trade pending` | View pending trades |
| `/trade accept <id>` | Accept trade |
| `/auction list <pokemon> <price>` | List for auction |
| `/auction browse [filters]` | Browse auctions |
| `/auction bid <id> <amount>` | Place bid |
| `/auction buy <id>` | Buy now |

## Technical Architecture

### Backend (FastAPI)
- `/api/pokemon` - Pokemon CRUD with caching
- `/api/users` - User management
- `/api/leaderboard/*` - Catches, Shinies, Dex, PvP
- `/api/gym-leaders` - Gym leader data
- `/api/trades/*` - Trade management
- `/api/auctions/*` - Auction house
- `/api/sync/pokeapi` - Background Pokemon sync

### Discord Bot (Node.js)
- 12 slash commands across 6 files
- Mongoose models for Users, Pokemon, Trades, Auctions
- Battle engine with damage calculation
- Type effectiveness integration

### Frontend (React)
- Dashboard with live stats
- Pokédex browser (1025 Pokemon)
- Leaderboards (catches, shinies, dex, pvp)
- Type Chart (18x18 matrix)
- User lookup

## How to Activate Discord Bot
1. Go to https://discord.com/developers/applications
2. Create application and bot
3. Get Bot Token and Client ID
4. Update `/app/discord-bot/.env`:
   ```
   DISCORD_TOKEN=your_token_here
   CLIENT_ID=your_client_id_here
   ```
5. Deploy commands: `cd /app/discord-bot && yarn deploy`
6. Start bot: `yarn start`
7. Invite bot to server with slash commands scope

## Prioritized Backlog

### P1 - Next Features
- [ ] Breeding system with egg mechanics
- [ ] Expeditions (passive gathering)
- [ ] Held items for battles
- [ ] Move learning system

### P2 - Future Phases
- [ ] Raid dens (4-player co-op)
- [ ] World boss with global HP
- [ ] Season pass with tiers
- [ ] More gym leaders (Johto+)

## Files Structure
```
/app/
├── backend/server.py          # FastAPI with Phase 3-4 routes
├── discord-bot/
│   ├── index.js               # Main bot file
│   ├── deploy-commands.js     # Command registration
│   ├── commands/
│   │   ├── wild.js            # /wild command
│   │   ├── box.js             # /box command
│   │   ├── dex.js             # /dex command
│   │   ├── info.js            # /info command
│   │   ├── affection.js       # /affection command
│   │   ├── bounty.js          # /bounty command
│   │   ├── battle.js          # /battle gym & duel
│   │   ├── trade.js           # /trade commands
│   │   └── auction.js         # /auction commands
│   ├── models/                # Mongoose schemas
│   └── utils/TypeChart.js     # Type effectiveness
└── frontend/src/
    ├── pages/                 # React pages
    └── components/            # Reusable components
```
