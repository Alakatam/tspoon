from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import httpx
import redis.asyncio as redis
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Redis connection
redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
redis_client = None

# Create the main app
app = FastAPI(title="PokeQuest Bot API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class Pokemon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    name: str
    types: List[str]
    stats: Dict[str, int]
    sprite: str
    sprite_shiny: Optional[str] = None
    height: int
    weight: int
    abilities: List[str]
    moves: List[str] = []
    evolution_chain: Optional[List[str]] = None
    region: str = "unknown"
    generation: int = 1

class UserPokemon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    instance_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pokemon_id: int
    owner_id: str
    nickname: Optional[str] = None
    level: int = 1
    xp: int = 0
    ivs: Dict[str, int] = Field(default_factory=lambda: {"hp": 0, "attack": 0, "defense": 0, "sp_attack": 0, "sp_defense": 0, "speed": 0})
    evs: Dict[str, int] = Field(default_factory=lambda: {"hp": 0, "attack": 0, "defense": 0, "sp_attack": 0, "sp_defense": 0, "speed": 0})
    nature: str = "Hardy"
    is_shiny: bool = False
    caught_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    username: str
    balance: int = 1000
    items: Dict[str, int] = Field(default_factory=dict)
    badges: List[str] = Field(default_factory=list)
    quest_progress: Dict[str, Any] = Field(default_factory=dict)
    pokedex: List[int] = Field(default_factory=list)
    total_catches: int = 0
    shiny_catches: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_active: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    pity_counter: int = 0

class GlobalSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    world_boss_hp: int = 1000000
    current_weather: str = "clear"
    season_start: Optional[str] = None
    season_end: Optional[str] = None
    active_events: List[str] = Field(default_factory=list)

class BotStats(BaseModel):
    total_users: int = 0
    total_pokemon_caught: int = 0
    total_shiny_caught: int = 0
    active_servers: int = 0
    pokemon_in_database: int = 0

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    value: int
    avatar: Optional[str] = None

# ==================== POKEAPI SYNC ====================

POKEAPI_BASE = "https://pokeapi.co/api/v2"
REGIONS = {
    1: "kanto",
    2: "johto", 
    3: "hoenn",
    4: "sinnoh",
    5: "unova",
    6: "kalos",
    7: "alola",
    8: "galar",
    9: "paldea"
}

async def get_redis():
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.from_url(redis_url, decode_responses=True)
            await redis_client.ping()
            logger.info("Redis connected successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Using MongoDB only.")
            redis_client = None
    return redis_client

async def cache_get(key: str):
    """Get from Redis cache"""
    r = await get_redis()
    if r:
        try:
            data = await r.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
    return None

async def cache_set(key: str, value: Any, ttl: int = 3600):
    """Set in Redis cache"""
    r = await get_redis()
    if r:
        try:
            await r.set(key, json.dumps(value), ex=ttl)
        except Exception as e:
            logger.error(f"Redis set error: {e}")

def get_region_from_id(pokemon_id: int) -> tuple:
    """Get region and generation from Pokemon ID"""
    if pokemon_id <= 151:
        return "kanto", 1
    elif pokemon_id <= 251:
        return "johto", 2
    elif pokemon_id <= 386:
        return "hoenn", 3
    elif pokemon_id <= 493:
        return "sinnoh", 4
    elif pokemon_id <= 649:
        return "unova", 5
    elif pokemon_id <= 721:
        return "kalos", 6
    elif pokemon_id <= 809:
        return "alola", 7
    elif pokemon_id <= 905:
        return "galar", 8
    else:
        return "paldea", 9

async def fetch_pokemon_from_api(pokemon_id: int) -> Optional[Dict]:
    """Fetch a single Pokemon from PokeAPI"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{POKEAPI_BASE}/pokemon/{pokemon_id}", timeout=30.0)
            if response.status_code != 200:
                return None
            
            data = response.json()
            region, generation = get_region_from_id(pokemon_id)
            
            pokemon = {
                "id": data["id"],
                "name": data["name"],
                "types": [t["type"]["name"] for t in data["types"]],
                "stats": {
                    "hp": data["stats"][0]["base_stat"],
                    "attack": data["stats"][1]["base_stat"],
                    "defense": data["stats"][2]["base_stat"],
                    "sp_attack": data["stats"][3]["base_stat"],
                    "sp_defense": data["stats"][4]["base_stat"],
                    "speed": data["stats"][5]["base_stat"]
                },
                "sprite": data["sprites"]["other"]["official-artwork"]["front_default"] or data["sprites"]["front_default"],
                "sprite_shiny": data["sprites"]["other"]["official-artwork"]["front_shiny"] or data["sprites"]["front_shiny"],
                "height": data["height"],
                "weight": data["weight"],
                "abilities": [a["ability"]["name"] for a in data["abilities"]],
                "moves": [m["move"]["name"] for m in data["moves"][:20]],
                "region": region,
                "generation": generation
            }
            return pokemon
        except Exception as e:
            logger.error(f"Error fetching Pokemon {pokemon_id}: {e}")
            return None

async def sync_pokeapi_data(limit: int = 151):
    """Sync Pokemon data from PokeAPI to MongoDB"""
    logger.info(f"Starting PokeAPI sync for {limit} Pokemon...")
    
    synced = 0
    for pokemon_id in range(1, limit + 1):
        # Check if already in DB
        existing = await db.pokemon_cache.find_one({"id": pokemon_id}, {"_id": 0})
        if existing:
            synced += 1
            continue
        
        pokemon_data = await fetch_pokemon_from_api(pokemon_id)
        if pokemon_data:
            await db.pokemon_cache.update_one(
                {"id": pokemon_id},
                {"$set": pokemon_data},
                upsert=True
            )
            synced += 1
            if synced % 50 == 0:
                logger.info(f"Synced {synced}/{limit} Pokemon")
    
    logger.info(f"PokeAPI sync complete: {synced} Pokemon")
    return synced

# ==================== TYPE CHART ====================

TYPE_EFFECTIVENESS = {
    "normal": {"rock": 0.5, "ghost": 0, "steel": 0.5},
    "fire": {"fire": 0.5, "water": 0.5, "grass": 2, "ice": 2, "bug": 2, "rock": 0.5, "dragon": 0.5, "steel": 2},
    "water": {"fire": 2, "water": 0.5, "grass": 0.5, "ground": 2, "rock": 2, "dragon": 0.5},
    "electric": {"water": 2, "electric": 0.5, "grass": 0.5, "ground": 0, "flying": 2, "dragon": 0.5},
    "grass": {"fire": 0.5, "water": 2, "grass": 0.5, "poison": 0.5, "ground": 2, "flying": 0.5, "bug": 0.5, "rock": 2, "dragon": 0.5, "steel": 0.5},
    "ice": {"fire": 0.5, "water": 0.5, "grass": 2, "ice": 0.5, "ground": 2, "flying": 2, "dragon": 2, "steel": 0.5},
    "fighting": {"normal": 2, "ice": 2, "poison": 0.5, "flying": 0.5, "psychic": 0.5, "bug": 0.5, "rock": 2, "ghost": 0, "dark": 2, "steel": 2, "fairy": 0.5},
    "poison": {"grass": 2, "poison": 0.5, "ground": 0.5, "rock": 0.5, "ghost": 0.5, "steel": 0, "fairy": 2},
    "ground": {"fire": 2, "electric": 2, "grass": 0.5, "poison": 2, "flying": 0, "bug": 0.5, "rock": 2, "steel": 2},
    "flying": {"electric": 0.5, "grass": 2, "fighting": 2, "bug": 2, "rock": 0.5, "steel": 0.5},
    "psychic": {"fighting": 2, "poison": 2, "psychic": 0.5, "dark": 0, "steel": 0.5},
    "bug": {"fire": 0.5, "grass": 2, "fighting": 0.5, "poison": 0.5, "flying": 0.5, "psychic": 2, "ghost": 0.5, "dark": 2, "steel": 0.5, "fairy": 0.5},
    "rock": {"fire": 2, "ice": 2, "fighting": 0.5, "ground": 0.5, "flying": 2, "bug": 2, "steel": 0.5},
    "ghost": {"normal": 0, "psychic": 2, "ghost": 2, "dark": 0.5},
    "dragon": {"dragon": 2, "steel": 0.5, "fairy": 0},
    "dark": {"fighting": 0.5, "psychic": 2, "ghost": 2, "dark": 0.5, "fairy": 0.5},
    "steel": {"fire": 0.5, "water": 0.5, "electric": 0.5, "ice": 2, "rock": 2, "steel": 0.5, "fairy": 2},
    "fairy": {"fire": 0.5, "fighting": 2, "poison": 0.5, "dragon": 2, "dark": 2, "steel": 0.5}
}

def get_type_multiplier(attacking_type: str, defending_types: List[str]) -> float:
    """Calculate damage multiplier based on type matchup"""
    multiplier = 1.0
    effectiveness = TYPE_EFFECTIVENESS.get(attacking_type, {})
    for defending_type in defending_types:
        multiplier *= effectiveness.get(defending_type, 1.0)
    return multiplier

# ==================== API ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "PokeQuest Bot API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Pokemon Cache Routes
@api_router.get("/pokemon", response_model=List[Pokemon])
async def get_all_pokemon(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    type_filter: Optional[str] = None,
    region: Optional[str] = None,
    search: Optional[str] = None
):
    """Get cached Pokemon with filters"""
    cache_key = f"pokemon_list:{skip}:{limit}:{type_filter}:{region}:{search}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    query = {}
    if type_filter:
        query["types"] = type_filter.lower()
    if region:
        query["region"] = region.lower()
    if search:
        query["name"] = {"$regex": search.lower(), "$options": "i"}
    
    pokemon_list = await db.pokemon_cache.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    await cache_set(cache_key, pokemon_list, ttl=300)
    return pokemon_list

@api_router.get("/pokemon/{pokemon_id}", response_model=Pokemon)
async def get_pokemon(pokemon_id: int):
    """Get a specific Pokemon by ID"""
    cache_key = f"pokemon:{pokemon_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    pokemon = await db.pokemon_cache.find_one({"id": pokemon_id}, {"_id": 0})
    if not pokemon:
        raise HTTPException(status_code=404, detail="Pokemon not found")
    
    await cache_set(cache_key, pokemon, ttl=3600)
    return pokemon

@api_router.get("/pokemon/count/total")
async def get_pokemon_count():
    """Get total count of cached Pokemon"""
    count = await db.pokemon_cache.count_documents({})
    return {"count": count}

@api_router.get("/pokemon/types/list")
async def get_pokemon_types():
    """Get list of all Pokemon types"""
    types = list(TYPE_EFFECTIVENESS.keys())
    return {"types": types}

@api_router.get("/pokemon/regions/list")
async def get_regions():
    """Get list of all regions"""
    return {"regions": list(REGIONS.values())}

# Type Chart Routes
@api_router.get("/types/effectiveness")
async def get_type_effectiveness(
    attacking_type: str,
    defending_types: str
):
    """Get type effectiveness multiplier"""
    defending = defending_types.split(",")
    multiplier = get_type_multiplier(attacking_type.lower(), [t.lower() for t in defending])
    return {
        "attacking_type": attacking_type,
        "defending_types": defending,
        "multiplier": multiplier
    }

@api_router.get("/types/chart")
async def get_type_chart():
    """Get full type effectiveness chart"""
    return TYPE_EFFECTIVENESS

# User Routes
@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user profile"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.post("/users")
async def create_user(user_id: str, username: str):
    """Create a new user"""
    existing = await db.users.find_one({"user_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    user = User(user_id=user_id, username=username)
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    user_dict['last_active'] = user_dict['last_active'].isoformat()
    
    await db.users.insert_one(user_dict)
    return {"message": "User created", "user_id": user_id}

@api_router.get("/users/{user_id}/pokemon")
async def get_user_pokemon(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    shiny_only: bool = False,
    type_filter: Optional[str] = None,
    min_iv: Optional[int] = None
):
    """Get user's Pokemon collection (box)"""
    query = {"owner_id": user_id}
    if shiny_only:
        query["is_shiny"] = True
    
    pokemon_list = await db.user_pokemon.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    # Apply additional filters
    if type_filter or min_iv:
        filtered = []
        for p in pokemon_list:
            pokemon_data = await db.pokemon_cache.find_one({"id": p["pokemon_id"]}, {"_id": 0})
            if pokemon_data:
                if type_filter and type_filter.lower() not in pokemon_data.get("types", []):
                    continue
                if min_iv:
                    total_iv = sum(p.get("ivs", {}).values())
                    if total_iv < min_iv:
                        continue
                p["pokemon_data"] = pokemon_data
                filtered.append(p)
        return filtered
    
    # Enrich with Pokemon data
    for p in pokemon_list:
        pokemon_data = await db.pokemon_cache.find_one({"id": p["pokemon_id"]}, {"_id": 0})
        if pokemon_data:
            p["pokemon_data"] = pokemon_data
    
    return pokemon_list

@api_router.get("/users/{user_id}/pokedex")
async def get_user_pokedex(user_id: str, region: Optional[str] = None):
    """Get user's Pokedex completion"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    pokedex = user.get("pokedex", [])
    
    # Get region bounds
    region_ranges = {
        "kanto": (1, 151),
        "johto": (152, 251),
        "hoenn": (252, 386),
        "sinnoh": (387, 493),
        "unova": (494, 649),
        "kalos": (650, 721),
        "alola": (722, 809),
        "galar": (810, 905),
        "paldea": (906, 1025)
    }
    
    if region and region.lower() in region_ranges:
        start, end = region_ranges[region.lower()]
        region_pokemon = [pid for pid in pokedex if start <= pid <= end]
        total = end - start + 1
        return {
            "region": region,
            "caught": len(region_pokemon),
            "total": total,
            "percentage": round(len(region_pokemon) / total * 100, 1),
            "caught_ids": region_pokemon
        }
    
    # Return all regions
    result = {}
    for reg, (start, end) in region_ranges.items():
        region_pokemon = [pid for pid in pokedex if start <= pid <= end]
        total = end - start + 1
        result[reg] = {
            "caught": len(region_pokemon),
            "total": total,
            "percentage": round(len(region_pokemon) / total * 100, 1)
        }
    
    return result

# Leaderboard Routes
@api_router.get("/leaderboard/catches")
async def get_catches_leaderboard(limit: int = Query(10, ge=1, le=50)):
    """Get top trainers by total catches"""
    cache_key = f"leaderboard:catches:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    users = await db.users.find({}, {"_id": 0}).sort("total_catches", -1).limit(limit).to_list(limit)
    leaderboard = [
        {
            "rank": i + 1,
            "user_id": u["user_id"],
            "username": u["username"],
            "value": u.get("total_catches", 0)
        }
        for i, u in enumerate(users)
    ]
    
    await cache_set(cache_key, leaderboard, ttl=60)
    return leaderboard

@api_router.get("/leaderboard/shinies")
async def get_shinies_leaderboard(limit: int = Query(10, ge=1, le=50)):
    """Get top shiny hunters"""
    cache_key = f"leaderboard:shinies:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    users = await db.users.find({}, {"_id": 0}).sort("shiny_catches", -1).limit(limit).to_list(limit)
    leaderboard = [
        {
            "rank": i + 1,
            "user_id": u["user_id"],
            "username": u["username"],
            "value": u.get("shiny_catches", 0)
        }
        for i, u in enumerate(users)
    ]
    
    await cache_set(cache_key, leaderboard, ttl=60)
    return leaderboard

@api_router.get("/leaderboard/dex")
async def get_dex_leaderboard(limit: int = Query(10, ge=1, le=50)):
    """Get top Pokedex completionists"""
    cache_key = f"leaderboard:dex:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    pipeline = [
        {"$project": {"user_id": 1, "username": 1, "pokedex_count": {"$size": {"$ifNull": ["$pokedex", []]}}}},
        {"$sort": {"pokedex_count": -1}},
        {"$limit": limit}
    ]
    users = await db.users.aggregate(pipeline).to_list(limit)
    leaderboard = [
        {
            "rank": i + 1,
            "user_id": u["user_id"],
            "username": u["username"],
            "value": u.get("pokedex_count", 0)
        }
        for i, u in enumerate(users)
    ]
    
    await cache_set(cache_key, leaderboard, ttl=60)
    return leaderboard

# Bot Stats Routes
@api_router.get("/stats/bot")
async def get_bot_stats():
    """Get overall bot statistics"""
    cache_key = "stats:bot"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    total_users = await db.users.count_documents({})
    total_pokemon = await db.user_pokemon.count_documents({})
    total_shiny = await db.user_pokemon.count_documents({"is_shiny": True})
    pokemon_in_db = await db.pokemon_cache.count_documents({})
    
    stats = {
        "total_users": total_users,
        "total_pokemon_caught": total_pokemon,
        "total_shiny_caught": total_shiny,
        "pokemon_in_database": pokemon_in_db,
        "active_servers": 0  # Will be updated by Discord bot
    }
    
    await cache_set(cache_key, stats, ttl=30)
    return stats

# Global Settings Routes
@api_router.get("/global/settings")
async def get_global_settings():
    """Get global game settings"""
    settings = await db.global_settings.find_one({}, {"_id": 0})
    if not settings:
        default_settings = GlobalSettings()
        settings = default_settings.model_dump()
        await db.global_settings.insert_one(settings)
    return settings

@api_router.get("/global/weather")
async def get_current_weather():
    """Get current weather"""
    settings = await db.global_settings.find_one({}, {"_id": 0})
    return {"weather": settings.get("current_weather", "clear") if settings else "clear"}

# Activity Feed Routes
@api_router.get("/activity/recent")
async def get_recent_activity(limit: int = Query(20, ge=1, le=50)):
    """Get recent catches and events"""
    cache_key = f"activity:recent:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    activities = await db.activity_log.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    
    await cache_set(cache_key, activities, ttl=10)
    return activities

# Sync Routes (for admin/bot use)
@api_router.post("/sync/pokeapi")
async def trigger_pokeapi_sync(limit: int = Query(151, ge=1, le=1025)):
    """Trigger PokeAPI data sync"""
    synced = await sync_pokeapi_data(limit)
    return {"message": f"Synced {synced} Pokemon", "synced": synced}

# Include the router
app.include_router(api_router)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("Starting PokeQuest Bot API...")
    # Create indexes
    await db.pokemon_cache.create_index("id", unique=True)
    await db.pokemon_cache.create_index("name")
    await db.pokemon_cache.create_index("types")
    await db.pokemon_cache.create_index("region")
    await db.users.create_index("user_id", unique=True)
    await db.user_pokemon.create_index("owner_id")
    await db.user_pokemon.create_index("instance_id", unique=True)
    await db.activity_log.create_index([("timestamp", -1)])
    
    # Initialize Redis
    await get_redis()
    
    # Auto-sync first 151 Pokemon if database is empty
    count = await db.pokemon_cache.count_documents({})
    if count == 0:
        logger.info("No Pokemon in cache, starting initial sync...")
        await sync_pokeapi_data(151)
    
    logger.info("PokeQuest Bot API started successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    global redis_client
    if redis_client:
        await redis_client.close()
    client.close()
    logger.info("PokeQuest Bot API shutdown complete")
