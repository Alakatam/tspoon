#!/usr/bin/env python3
"""
Backend API Testing for Pokemon Discord Bot Dashboard
Tests all API endpoints for functionality and integration
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, List

class PokemonAPITester:
    def __init__(self, base_url="https://pokequestbot.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
            self.failed_tests.append({
                "test": test_name,
                "error": details
            })

    def test_endpoint(self, name: str, method: str, endpoint: str, expected_status: int = 200, 
                     data: Dict = None, params: Dict = None) -> tuple:
        """Test a single API endpoint"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=params, timeout=30)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, params=params, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    self.log_result(name, True)
                    return True, response_data
                except json.JSONDecodeError:
                    self.log_result(name, False, f"Invalid JSON response")
                    return False, {}
            else:
                self.log_result(name, False, f"Expected {expected_status}, got {response.status_code}")
                return False, {}

        except requests.exceptions.Timeout:
            self.log_result(name, False, "Request timeout")
            return False, {}
        except requests.exceptions.ConnectionError:
            self.log_result(name, False, "Connection error")
            return False, {}
        except Exception as e:
            self.log_result(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test basic health and root endpoints"""
        print("\n🔍 Testing Health & Basic Endpoints...")
        
        # Test root endpoint
        self.test_endpoint("API Root", "GET", "/")
        
        # Test health check
        self.test_endpoint("Health Check", "GET", "/health")

    def test_pokemon_endpoints(self):
        """Test Pokemon-related endpoints"""
        print("\n🔍 Testing Pokemon Endpoints...")
        
        # Test Pokemon sync (with limit)
        success, sync_data = self.test_endpoint(
            "Pokemon Sync", "POST", "/sync/pokeapi", 
            expected_status=200, params={"limit": 10}
        )
        
        # Test get Pokemon list
        success, pokemon_list = self.test_endpoint(
            "Get Pokemon List", "GET", "/pokemon", 
            params={"limit": 10}
        )
        
        # Test get Pokemon by ID (if we have Pokemon)
        if success and pokemon_list and len(pokemon_list) > 0:
            pokemon_id = pokemon_list[0].get('id', 1)
            self.test_endpoint(
                "Get Pokemon by ID", "GET", f"/pokemon/{pokemon_id}"
            )
        else:
            # Try with ID 1 as fallback
            self.test_endpoint(
                "Get Pokemon by ID", "GET", "/pokemon/1"
            )
        
        # Test Pokemon count
        self.test_endpoint("Get Pokemon Count", "GET", "/pokemon/count/total")
        
        # Test Pokemon types list
        self.test_endpoint("Get Pokemon Types", "GET", "/pokemon/types/list")
        
        # Test regions list
        self.test_endpoint("Get Regions List", "GET", "/pokemon/regions/list")

    def test_type_chart_endpoints(self):
        """Test type effectiveness endpoints"""
        print("\n🔍 Testing Type Chart Endpoints...")
        
        # Test full type chart
        self.test_endpoint("Get Type Chart", "GET", "/types/chart")
        
        # Test type effectiveness calculation
        self.test_endpoint(
            "Get Type Effectiveness", "GET", "/types/effectiveness",
            params={"attacking_type": "fire", "defending_types": "grass"}
        )

    def test_stats_endpoints(self):
        """Test statistics endpoints"""
        print("\n🔍 Testing Stats Endpoints...")
        
        # Test bot stats
        self.test_endpoint("Get Bot Stats", "GET", "/stats/bot")
        
        # Test global weather
        self.test_endpoint("Get Global Weather", "GET", "/global/weather")

    def test_leaderboard_endpoints(self):
        """Test leaderboard endpoints"""
        print("\n🔍 Testing Leaderboard Endpoints...")
        
        # Test catches leaderboard
        self.test_endpoint("Get Catches Leaderboard", "GET", "/leaderboard/catches")
        
        # Test shinies leaderboard
        self.test_endpoint("Get Shinies Leaderboard", "GET", "/leaderboard/shinies")
        
        # Test dex leaderboard
        self.test_endpoint("Get Dex Leaderboard", "GET", "/leaderboard/dex")
        
        # Test PvP leaderboard (Phase 3)
        self.test_endpoint("Get PvP Leaderboard", "GET", "/leaderboard/pvp")

    def test_additional_endpoints(self):
        """Test additional endpoints that might be used by frontend"""
        print("\n🔍 Testing Additional Endpoints...")
        
        # Test global settings
        self.test_endpoint("Get Global Settings", "GET", "/global/settings")
        
        # Test recent activity
        self.test_endpoint("Get Recent Activity", "GET", "/activity/recent")
        
        # Test sync status (Phase 3/4)
        self.test_endpoint("Get Sync Status", "GET", "/sync/status")

    def test_phase3_battle_endpoints(self):
        """Test Phase 3 Battle System endpoints"""
        print("\n🔍 Testing Phase 3 Battle Endpoints...")
        
        # Test gym leaders list
        self.test_endpoint("Get Gym Leaders", "GET", "/gym-leaders")
        
        # Test specific gym leader
        self.test_endpoint("Get Gym Leader Brock", "GET", "/gym-leaders/brock")

    def test_phase4_trade_auction_endpoints(self):
        """Test Phase 4 Trade & Auction endpoints"""
        print("\n🔍 Testing Phase 4 Trade & Auction Endpoints...")
        
        # Test active auctions
        self.test_endpoint("Get Active Auctions", "GET", "/auctions/active")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Pokemon Bot API Tests...")
        print(f"📡 Testing API at: {self.api_url}")
        
        # Run test suites
        self.test_health_endpoints()
        self.test_pokemon_endpoints()
        self.test_type_chart_endpoints()
        self.test_stats_endpoints()
        self.test_leaderboard_endpoints()
        self.test_phase3_battle_endpoints()
        self.test_phase4_trade_auction_endpoints()
        self.test_additional_endpoints()
        
        # Print summary
        print(f"\n📊 Test Results Summary:")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {len(self.failed_tests)}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for failure in self.failed_tests:
                print(f"   • {failure['test']}: {failure['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = PokemonAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())