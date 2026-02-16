# PokeQuest Bot - Product Requirements Document

## Project Overview
**Project Name:** PokeQuest Bot  
**Version:** 1.0.0 (Phase 1-2 MVP)  
**Last Updated:** Feb 16, 2026

## Original Problem Statement
Build a comprehensive Pokemon Discord Bot with:
- Phase 1: Foundation (MongoDB schemas for Users, Pokemon, Global data)
- Phase 2: Core Loop (/wild, /box, /dex, /info, /affection, /bounty commands)
- Web dashboard for bot stats, leaderboards, Pokedex browser
- PokeAPI integration with local caching
- Redis caching for performance

## User Choices
- **Framework:** Discord.js v14
- **Database:** MongoDB (existing environment)
- **Caching:** Redis from start
- **Data Sync:** Fetch PokeAPI on startup
- **Scope:** Phase 1-2 focus

## User Personas
1. **Casual Trainer** - Uses /wild to catch Pokemon, checks /dex progress
2. **Competitive Player** - Filters /box for high IV Pokemon, studies /affection for battles
3. **Completionist** - Tracks regional Pokedex completion, completes /bounty challenges
4. **Server Admin** - Uses web dashboard to monitor bot stats and leaderboards

## Core Architecture

### Backend (FastAPI - `/app/backend/`)
- Pokemon cache from PokeAPI (151 Kanto Pokemon)
- User management endpoints
- Leaderboard APIs (catches, shinies, dex completion)
- Type effectiveness chart API
- Global settings (weather, events)

### Discord Bot (Node.js - `/app/discord-bot/`)
- `/wild` - Encounter Pokemon (biome/weather modifiers, shiny pity system)
- `/box` - View collection with filters (shiny, type, IV)
- `/dex` - Regional Pokedex completion
- `/info` - Detailed Pokemon stats (IVs, nature, level)
- `/affection` - Battle guide (weaknesses, resistances)
- `/bounty` - Daily challenges with rewards

### Frontend (React - `/app/frontend/`)
- Dashboard: Bot stats, featured Pokemon, leaderboards
- Pokedex: Browse 151 Pokemon with search/filters
- Leaderboard: Top trainers by catches, shinies, dex
- Type Chart: Full 18x18 effectiveness matrix
- User Lookup: Search trainer profiles

### Database Schemas (MongoDB)
- `users`: balance, items, badges, quest progress, pokedex
- `user_pokemon`: instanceId, pokemonId, level, IVs, EVs, nature, isShiny
- `pokemon_cache`: PokeAPI data (stats, types, sprites)
- `global_settings`: weather, events, world boss

## What's Been Implemented ✅

### Phase 1: Foundation (Complete)
- [x] MongoDB schemas for Users, Pokemon, Global
- [x] Pokemon cache from PokeAPI (151 Pokemon)
- [x] Type effectiveness chart utility
- [x] Redis caching infrastructure

### Phase 2: Core Loop (Complete)
- [x] `/wild` command with biome/weather/shiny mechanics
- [x] `/box` command with filters and pagination
- [x] `/dex` command with regional tracking
- [x] `/info` command with IV/EV display
- [x] `/affection` command with battle tips
- [x] `/bounty` command with daily challenges
- [x] Web dashboard with all pages

## Prioritized Backlog

### P0 - Critical (Next Sprint)
- [ ] Add Discord bot token to .env and deploy commands
- [ ] Test Discord bot in live server

### P1 - High Priority (Phase 3)
- [ ] Battle system (turn-based PvE vs Gym Leaders)
- [ ] PvP dueling between players
- [ ] Status effects (Burn, Sleep, Paralysis)

### P2 - Medium Priority (Phase 4-5)
- [ ] Trading system with 2-way handshake
- [ ] Auction house for rare Pokemon
- [ ] Breeding and nursery system
- [ ] Expeditions (passive resource gathering)

### P3 - Future Phases (6-7)
- [ ] Raid dens (4-player co-op battles)
- [ ] World boss (global damage pool)
- [ ] Season pass with reward tiers
- [ ] Advanced leaderboards and rankings

## Technical Notes

### Discord Bot Setup
1. Create application at https://discord.com/developers/applications
2. Get Bot Token and Client ID
3. Update `/app/discord-bot/.env`
4. Run `yarn deploy` to register slash commands
5. Run `yarn start` to launch bot

### API Endpoints Reference
- `GET /api/pokemon` - List Pokemon (pagination, filters)
- `GET /api/pokemon/{id}` - Pokemon details
- `GET /api/types/chart` - Type effectiveness
- `GET /api/leaderboard/catches` - Top catchers
- `GET /api/stats/bot` - Bot statistics
- `POST /api/sync/pokeapi` - Sync PokeAPI data

## Next Action Items
1. **Deploy Discord Bot** - Add token to .env, run deploy-commands.js
2. **Test in Live Server** - Verify /wild, /box, /dex work correctly
3. **Phase 3 Planning** - Start battle system design
