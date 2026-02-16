from fastapi import FastAPI, APIRouter, HTTPException, Query, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import redis.asyncio as redis
import json
import random
import asyncio

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
app = FastAPI(title="Twisted Spoon Bot API")

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
    pvp_wins: int = 0
    pvp_losses: int = 0
    gym_badges: List[str] = Field(default_factory=list)

class GlobalSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    world_boss_hp: int = 1000000
    current_weather: str = "clear"
    season_start: Optional[str] = None
    season_end: Optional[str] = None
    active_events: List[str] = Field(default_factory=list)

# Phase 3: Battle Models
class BattleState(BaseModel):
    battle_id: str
    battle_type: str  # "pve", "pvp"
    player1_id: str
    player2_id: Optional[str] = None  # None for PvE
    player1_pokemon: Dict[str, Any]
    player2_pokemon: Dict[str, Any]
    player1_hp: int
    player2_hp: int
    current_turn: str
    status_effects: Dict[str, List[str]] = Field(default_factory=dict)
    turn_count: int = 0
    winner: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Phase 4: Trade Models
class TradeOffer(BaseModel):
    trade_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    offerer_id: str
    receiver_id: str
    offered_pokemon: List[str]  # instance_ids
    requested_pokemon: List[str]  # instance_ids
    offered_coins: int = 0
    requested_coins: int = 0
    status: str = "pending"  # pending, accepted, rejected, cancelled, completed
    offerer_locked: bool = False
    receiver_locked: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))

class AuctionListing(BaseModel):
    auction_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    pokemon_instance_id: str
    starting_price: int
    current_bid: int = 0
    current_bidder: Optional[str] = None
    buy_now_price: Optional[int] = None
    status: str = "active"  # active, sold, cancelled, expired
    bids: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ends_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))

class BotStats(BaseModel):
    total_users: int = 0
    total_pokemon_caught: int = 0
    total_shiny_caught: int = 0
    active_servers: int = 0
    pokemon_in_database: int = 0
    total_trades: int = 0
    total_battles: int = 0

# ==================== GYM LEADERS (Phase 3) ====================

GYM_LEADERS = {
    "brock": {
        "name": "Brock",
        "badge": "Boulder Badge",
        "type": "rock",
        "team": [74, 95],  # Geodude, Onix
        "level_range": (12, 14),
        "reward_coins": 500
    },
    "misty": {
        "name": "Misty", 
        "badge": "Cascade Badge",
        "type": "water",
        "team": [120, 121],  # Staryu, Starmie
        "level_range": (18, 21),
        "reward_coins": 750
    },
    "lt_surge": {
        "name": "Lt. Surge",
        "badge": "Thunder Badge",
        "type": "electric",
        "team": [100, 26],  # Voltorb, Raichu
        "level_range": (21, 24),
        "reward_coins": 1000
    },
    "erika": {
        "name": "Erika",
        "badge": "Rainbow Badge",
        "type": "grass",
        "team": [71, 114, 45],  # Victreebel, Tangela, Vileplume
        "level_range": (29, 32),
        "reward_coins": 1250
    },
    "koga": {
        "name": "Koga",
        "badge": "Soul Badge",
        "type": "poison",
        "team": [109, 89, 49],  # Koffing, Muk, Venomoth
        "level_range": (37, 43),
        "reward_coins": 1500
    },
    "sabrina": {
        "name": "Sabrina",
        "badge": "Marsh Badge",
        "type": "psychic",
        "team": [64, 122, 65],  # Kadabra, Mr. Mime, Alakazam
        "level_range": (38, 43),
        "reward_coins": 1750
    },
    "blaine": {
        "name": "Blaine",
        "badge": "Volcano Badge",
        "type": "fire",
        "team": [58, 78, 59],  # Growlithe, Rapidash, Arcanine
        "level_range": (42, 47),
        "reward_coins": 2000
    },
    "giovanni": {
        "name": "Giovanni",
        "badge": "Earth Badge",
        "type": "ground",
        "team": [111, 31, 112],  # Rhyhorn, Nidoqueen, Rhydon
        "level_range": (45, 50),
        "reward_coins": 2500
    }
}

# ==================== STATUS EFFECTS (Phase 3) ====================

STATUS_EFFECTS = {
    "burn": {"damage_per_turn": 0.0625, "attack_reduction": 0.5, "duration": -1},
    "paralysis": {"speed_reduction": 0.5, "skip_chance": 0.25, "duration": -1},
    "poison": {"damage_per_turn": 0.125, "duration": -1},
    "sleep": {"skip_chance": 1.0, "duration": 3},
    "freeze": {"skip_chance": 1.0, "thaw_chance": 0.2, "duration": -1},
    "confusion": {"self_damage_chance": 0.33, "duration": 4}
}

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
    r = await get_redis()
    if r:
        try:
            await r.set(key, json.dumps(value), ex=ttl)
        except Exception as e:
            logger.error(f"Redis set error: {e}")

def get_region_from_id(pokemon_id: int) -> tuple:
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
    async with httpx.AsyncClient() as http_client:
        try:
            response = await http_client.get(f"{POKEAPI_BASE}/pokemon/{pokemon_id}", timeout=30.0)
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

async def sync_pokeapi_data(limit: int = 1025):
    """Sync Pokemon data from PokeAPI to MongoDB"""
    logger.info(f"Starting PokeAPI sync for {limit} Pokemon...")
    
    synced = 0
    for pokemon_id in range(1, limit + 1):
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
            if synced % 100 == 0:
                logger.info(f"Synced {synced}/{limit} Pokemon")
        
        # Rate limiting
        await asyncio.sleep(0.05)
    
    logger.info(f"PokeAPI sync complete: {synced} Pokemon")
    return synced

# Background sync task
sync_in_progress = False

async def background_sync_all_pokemon():
    global sync_in_progress
    if sync_in_progress:
        return
    sync_in_progress = True
    try:
        await sync_pokeapi_data(1025)
    finally:
        sync_in_progress = False

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
    multiplier = 1.0
    effectiveness = TYPE_EFFECTIVENESS.get(attacking_type, {})
    for defending_type in defending_types:
        multiplier *= effectiveness.get(defending_type, 1.0)
    return multiplier

# ==================== BATTLE LOGIC (Phase 3) ====================

def calculate_damage(attacker: Dict, defender: Dict, move_type: str, move_power: int = 50) -> int:
    """Calculate damage using Pokemon formula"""
    level = attacker.get("level", 50)
    attack = attacker.get("stats", {}).get("attack", 100)
    defense = defender.get("stats", {}).get("defense", 100)
    
    # Type effectiveness
    defender_types = defender.get("types", ["normal"])
    type_mult = get_type_multiplier(move_type, defender_types)
    
    # STAB bonus
    attacker_types = attacker.get("types", [])
    stab = 1.5 if move_type in attacker_types else 1.0
    
    # Random factor
    random_factor = random.uniform(0.85, 1.0)
    
    # Damage formula
    damage = ((2 * level / 5 + 2) * move_power * (attack / defense) / 50 + 2) * stab * type_mult * random_factor
    
    return max(1, int(damage))

def apply_status_effect(target: Dict, effect: str) -> str:
    """Apply a status effect to a Pokemon"""
    if effect not in STATUS_EFFECTS:
        return ""
    
    current_status = target.get("status", [])
    if effect in current_status:
        return ""
    
    current_status.append(effect)
    target["status"] = current_status
    return f"is now {effect}!"

def process_status_effects(pokemon: Dict) -> tuple:
    """Process status effects at end of turn. Returns (damage, can_move, message)"""
    status_list = pokemon.get("status", [])
    total_damage = 0
    can_move = True
    messages = []
    max_hp = pokemon.get("max_hp", pokemon.get("hp", 100))
    
    for status in status_list[:]:
        effect = STATUS_EFFECTS.get(status, {})
        
        # Damage over time
        if "damage_per_turn" in effect:
            damage = int(max_hp * effect["damage_per_turn"])
            total_damage += damage
            messages.append(f"took {damage} damage from {status}")
        
        # Skip turn chance
        if "skip_chance" in effect:
            if random.random() < effect["skip_chance"]:
                can_move = False
                if status == "sleep":
                    messages.append("is fast asleep!")
                elif status == "paralysis":
                    messages.append("is paralyzed and can't move!")
                elif status == "freeze":
                    # Check thaw
                    if random.random() < effect.get("thaw_chance", 0):
                        status_list.remove(status)
                        messages.append("thawed out!")
                        can_move = True
                    else:
                        messages.append("is frozen solid!")
        
        # Duration countdown
        if "duration" in effect and effect["duration"] > 0:
            pokemon[f"{status}_turns"] = pokemon.get(f"{status}_turns", effect["duration"]) - 1
            if pokemon[f"{status}_turns"] <= 0:
                status_list.remove(status)
                messages.append(f"recovered from {status}!")
    
    pokemon["status"] = status_list
    return total_damage, can_move, "; ".join(messages) if messages else ""

# ==================== API ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Twisted Spoon Bot API", "version": "2.0.0"}

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
    count = await db.pokemon_cache.count_documents({})
    return {"count": count}

@api_router.get("/pokemon/types/list")
async def get_pokemon_types():
    types = list(TYPE_EFFECTIVENESS.keys())
    return {"types": types}

@api_router.get("/pokemon/regions/list")
async def get_regions():
    return {"regions": list(REGIONS.values())}

# Type Chart Routes
@api_router.get("/types/effectiveness")
async def get_type_effectiveness(attacking_type: str, defending_types: str):
    defending = defending_types.split(",")
    multiplier = get_type_multiplier(attacking_type.lower(), [t.lower() for t in defending])
    return {
        "attacking_type": attacking_type,
        "defending_types": defending,
        "multiplier": multiplier
    }

@api_router.get("/types/chart")
async def get_type_chart():
    return TYPE_EFFECTIVENESS

# User Routes
@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.post("/users")
async def create_user(user_id: str, username: str):
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
    query = {"owner_id": user_id}
    if shiny_only:
        query["is_shiny"] = True
    
    pokemon_list = await db.user_pokemon.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
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
    
    for p in pokemon_list:
        pokemon_data = await db.pokemon_cache.find_one({"id": p["pokemon_id"]}, {"_id": 0})
        if pokemon_data:
            p["pokemon_data"] = pokemon_data
    
    return pokemon_list

@api_router.get("/users/{user_id}/pokedex")
async def get_user_pokedex(user_id: str, region: Optional[str] = None):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    pokedex = user.get("pokedex", [])
    
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
    cache_key = f"leaderboard:catches:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    users = await db.users.find({}, {"_id": 0}).sort("total_catches", -1).limit(limit).to_list(limit)
    leaderboard = [
        {"rank": i + 1, "user_id": u["user_id"], "username": u["username"], "value": u.get("total_catches", 0)}
        for i, u in enumerate(users)
    ]
    
    await cache_set(cache_key, leaderboard, ttl=60)
    return leaderboard

@api_router.get("/leaderboard/shinies")
async def get_shinies_leaderboard(limit: int = Query(10, ge=1, le=50)):
    cache_key = f"leaderboard:shinies:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    users = await db.users.find({}, {"_id": 0}).sort("shiny_catches", -1).limit(limit).to_list(limit)
    leaderboard = [
        {"rank": i + 1, "user_id": u["user_id"], "username": u["username"], "value": u.get("shiny_catches", 0)}
        for i, u in enumerate(users)
    ]
    
    await cache_set(cache_key, leaderboard, ttl=60)
    return leaderboard

@api_router.get("/leaderboard/dex")
async def get_dex_leaderboard(limit: int = Query(10, ge=1, le=50)):
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
        {"rank": i + 1, "user_id": u["user_id"], "username": u["username"], "value": u.get("pokedex_count", 0)}
        for i, u in enumerate(users)
    ]
    
    await cache_set(cache_key, leaderboard, ttl=60)
    return leaderboard

@api_router.get("/leaderboard/pvp")
async def get_pvp_leaderboard(limit: int = Query(10, ge=1, le=50)):
    cache_key = f"leaderboard:pvp:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    users = await db.users.find({}, {"_id": 0}).sort("pvp_wins", -1).limit(limit).to_list(limit)
    leaderboard = [
        {"rank": i + 1, "user_id": u["user_id"], "username": u["username"], "value": u.get("pvp_wins", 0), "losses": u.get("pvp_losses", 0)}
        for i, u in enumerate(users)
    ]
    
    await cache_set(cache_key, leaderboard, ttl=60)
    return leaderboard

# Bot Stats Routes
@api_router.get("/stats/bot")
async def get_bot_stats():
    cache_key = "stats:bot"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    total_users = await db.users.count_documents({})
    total_pokemon = await db.user_pokemon.count_documents({})
    total_shiny = await db.user_pokemon.count_documents({"is_shiny": True})
    pokemon_in_db = await db.pokemon_cache.count_documents({})
    total_trades = await db.trades.count_documents({"status": "completed"})
    total_battles = await db.battles.count_documents({})
    
    stats = {
        "total_users": total_users,
        "total_pokemon_caught": total_pokemon,
        "total_shiny_caught": total_shiny,
        "pokemon_in_database": pokemon_in_db,
        "active_servers": 0,
        "total_trades": total_trades,
        "total_battles": total_battles
    }
    
    await cache_set(cache_key, stats, ttl=30)
    return stats

# Global Settings Routes
@api_router.get("/global/settings")
async def get_global_settings():
    try:
        settings = await db.global_settings.find_one({}, {"_id": 0})
        if not settings:
            default_settings = GlobalSettings()
            settings = default_settings.model_dump()
            await db.global_settings.update_one({}, {"$setOnInsert": settings}, upsert=True)
        return settings
    except Exception:
        return GlobalSettings().model_dump()

@api_router.get("/global/weather")
async def get_current_weather():
    settings = await db.global_settings.find_one({}, {"_id": 0})
    return {"weather": settings.get("current_weather", "clear") if settings else "clear"}

# ==================== PHASE 3: BATTLE ROUTES ====================

@api_router.get("/gym-leaders")
async def get_gym_leaders():
    """Get list of all gym leaders"""
    return GYM_LEADERS

@api_router.get("/gym-leaders/{leader_id}")
async def get_gym_leader(leader_id: str):
    """Get specific gym leader details"""
    if leader_id not in GYM_LEADERS:
        raise HTTPException(status_code=404, detail="Gym leader not found")
    
    leader = GYM_LEADERS[leader_id]
    # Get Pokemon data for the team
    team_data = []
    for pokemon_id in leader["team"]:
        pokemon = await db.pokemon_cache.find_one({"id": pokemon_id}, {"_id": 0})
        if pokemon:
            team_data.append(pokemon)
    
    return {**leader, "team_data": team_data}

@api_router.get("/battles/active/{user_id}")
async def get_active_battle(user_id: str):
    """Get user's active battle if any"""
    battle = await db.battles.find_one(
        {"$or": [{"player1_id": user_id}, {"player2_id": user_id}], "winner": None},
        {"_id": 0}
    )
    return battle

@api_router.get("/battles/history/{user_id}")
async def get_battle_history(user_id: str, limit: int = Query(10, ge=1, le=50)):
    """Get user's battle history"""
    battles = await db.battles.find(
        {"$or": [{"player1_id": user_id}, {"player2_id": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return battles

# ==================== PHASE 4: TRADE ROUTES ====================

@api_router.get("/trades/pending/{user_id}")
async def get_pending_trades(user_id: str):
    """Get user's pending trade offers"""
    trades = await db.trades.find(
        {"$or": [{"offerer_id": user_id}, {"receiver_id": user_id}], "status": "pending"},
        {"_id": 0}
    ).to_list(50)
    return trades

@api_router.get("/trades/history/{user_id}")
async def get_trade_history(user_id: str, limit: int = Query(10, ge=1, le=50)):
    """Get user's trade history"""
    trades = await db.trades.find(
        {"$or": [{"offerer_id": user_id}, {"receiver_id": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return trades

@api_router.post("/trades/create")
async def create_trade(
    offerer_id: str,
    receiver_id: str,
    offered_pokemon: List[str] = Query(default=[]),
    requested_pokemon: List[str] = Query(default=[]),
    offered_coins: int = 0,
    requested_coins: int = 0
):
    """Create a new trade offer"""
    trade = TradeOffer(
        offerer_id=offerer_id,
        receiver_id=receiver_id,
        offered_pokemon=offered_pokemon,
        requested_pokemon=requested_pokemon,
        offered_coins=offered_coins,
        requested_coins=requested_coins
    )
    
    trade_dict = trade.model_dump()
    trade_dict["created_at"] = trade_dict["created_at"].isoformat()
    trade_dict["expires_at"] = trade_dict["expires_at"].isoformat()
    
    await db.trades.insert_one(trade_dict)
    return {"message": "Trade created", "trade_id": trade.trade_id}

# ==================== PHASE 4: AUCTION ROUTES ====================

@api_router.get("/auctions/active")
async def get_active_auctions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    type_filter: Optional[str] = None,
    shiny_only: bool = False
):
    """Get active auction listings"""
    query = {"status": "active"}
    
    auctions = await db.auctions.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with Pokemon data
    for auction in auctions:
        pokemon_instance = await db.user_pokemon.find_one(
            {"instance_id": auction["pokemon_instance_id"]},
            {"_id": 0}
        )
        if pokemon_instance:
            pokemon_data = await db.pokemon_cache.find_one(
                {"id": pokemon_instance["pokemon_id"]},
                {"_id": 0}
            )
            auction["pokemon_instance"] = pokemon_instance
            auction["pokemon_data"] = pokemon_data
    
    # Apply filters
    if type_filter or shiny_only:
        filtered = []
        for a in auctions:
            if shiny_only and not a.get("pokemon_instance", {}).get("is_shiny"):
                continue
            if type_filter and type_filter.lower() not in a.get("pokemon_data", {}).get("types", []):
                continue
            filtered.append(a)
        return filtered
    
    return auctions

@api_router.get("/auctions/{auction_id}")
async def get_auction(auction_id: str):
    """Get specific auction details"""
    auction = await db.auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Enrich with Pokemon data
    pokemon_instance = await db.user_pokemon.find_one(
        {"instance_id": auction["pokemon_instance_id"]},
        {"_id": 0}
    )
    if pokemon_instance:
        pokemon_data = await db.pokemon_cache.find_one(
            {"id": pokemon_instance["pokemon_id"]},
            {"_id": 0}
        )
        auction["pokemon_instance"] = pokemon_instance
        auction["pokemon_data"] = pokemon_data
    
    return auction

@api_router.post("/auctions/create")
async def create_auction(
    seller_id: str,
    pokemon_instance_id: str,
    starting_price: int,
    buy_now_price: Optional[int] = None,
    duration_hours: int = 24
):
    """Create a new auction listing"""
    # Verify ownership
    pokemon = await db.user_pokemon.find_one({"instance_id": pokemon_instance_id, "owner_id": seller_id})
    if not pokemon:
        raise HTTPException(status_code=400, detail="You don't own this Pokemon")
    
    auction = AuctionListing(
        seller_id=seller_id,
        pokemon_instance_id=pokemon_instance_id,
        starting_price=starting_price,
        buy_now_price=buy_now_price,
        ends_at=datetime.now(timezone.utc) + timedelta(hours=duration_hours)
    )
    
    auction_dict = auction.model_dump()
    auction_dict["created_at"] = auction_dict["created_at"].isoformat()
    auction_dict["ends_at"] = auction_dict["ends_at"].isoformat()
    
    await db.auctions.insert_one(auction_dict)
    return {"message": "Auction created", "auction_id": auction.auction_id}

@api_router.post("/auctions/{auction_id}/bid")
async def place_bid(auction_id: str, bidder_id: str, amount: int):
    """Place a bid on an auction"""
    auction = await db.auctions.find_one({"auction_id": auction_id, "status": "active"})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found or not active")
    
    if bidder_id == auction["seller_id"]:
        raise HTTPException(status_code=400, detail="Cannot bid on your own auction")
    
    current_bid = auction.get("current_bid", auction["starting_price"])
    if amount <= current_bid:
        raise HTTPException(status_code=400, detail=f"Bid must be higher than {current_bid}")
    
    # Check bidder balance
    user = await db.users.find_one({"user_id": bidder_id})
    if not user or user.get("balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Update auction
    await db.auctions.update_one(
        {"auction_id": auction_id},
        {
            "$set": {"current_bid": amount, "current_bidder": bidder_id},
            "$push": {"bids": {"bidder_id": bidder_id, "amount": amount, "timestamp": datetime.now(timezone.utc).isoformat()}}
        }
    )
    
    return {"message": "Bid placed", "new_bid": amount}

# Activity Feed Routes
@api_router.get("/activity/recent")
async def get_recent_activity(limit: int = Query(20, ge=1, le=50)):
    cache_key = f"activity:recent:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    
    activities = await db.activity_log.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    
    await cache_set(cache_key, activities, ttl=10)
    return activities

# Sync Routes
@api_router.post("/sync/pokeapi")
async def trigger_pokeapi_sync(background_tasks: BackgroundTasks, limit: int = Query(1025, ge=1, le=1025)):
    """Trigger PokeAPI data sync (runs in background for large syncs)"""
    current_count = await db.pokemon_cache.count_documents({})
    
    if limit > 200 and current_count < limit:
        # Run in background for large syncs
        background_tasks.add_task(background_sync_all_pokemon)
        return {"message": f"Background sync started. Currently have {current_count} Pokemon.", "status": "syncing"}
    else:
        synced = await sync_pokeapi_data(limit)
        return {"message": f"Synced {synced} Pokemon", "synced": synced}

@api_router.get("/sync/status")
async def get_sync_status():
    """Get current sync status"""
    count = await db.pokemon_cache.count_documents({})
    return {
        "pokemon_count": count,
        "target": 1025,
        "percentage": round(count / 1025 * 100, 1),
        "sync_in_progress": sync_in_progress
    }

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
    logger.info("Starting Twisted Spoon Bot API...")
    
    # Create indexes
    await db.pokemon_cache.create_index("id", unique=True)
    await db.pokemon_cache.create_index("name")
    await db.pokemon_cache.create_index("types")
    await db.pokemon_cache.create_index("region")
    await db.users.create_index("user_id", unique=True)
    await db.user_pokemon.create_index("owner_id")
    await db.user_pokemon.create_index("instance_id", unique=True)
    await db.activity_log.create_index([("timestamp", -1)])
    await db.trades.create_index("trade_id", unique=True)
    await db.trades.create_index("offerer_id")
    await db.trades.create_index("receiver_id")
    await db.auctions.create_index("auction_id", unique=True)
    await db.auctions.create_index("seller_id")
    await db.auctions.create_index("status")
    await db.battles.create_index("battle_id", unique=True)
    
    # Initialize Redis
    await get_redis()
    
    # Check Pokemon count and start background sync if needed
    count = await db.pokemon_cache.count_documents({})
    if count < 151:
        logger.info("Starting initial sync of first 151 Pokemon...")
        await sync_pokeapi_data(151)
    
    if count < 1025:
        logger.info(f"Have {count}/1025 Pokemon. Background sync will continue...")
    
    logger.info("Twisted Spoon Bot API started successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    global redis_client
    if redis_client:
        await redis_client.close()
    client.close()
    logger.info("Twisted Spoon Bot API shutdown complete")
