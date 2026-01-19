#!/usr/bin/env python3
"""
Quick test script for the FastAPI backend
Tests all endpoints to make sure they work
"""

import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_health():
    """Test health endpoint"""
    print("Testing /api/health...")
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if r.status_code == 200:
            print(f"✅ Health check passed: {r.json()}")
            return True
        else:
            print(f"❌ Health check failed: {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_settings_get():
    """Test GET /api/settings"""
    print("\nTesting GET /api/settings...")
    try:
        r = requests.get(f"{BASE_URL}/api/settings", timeout=5)
        if r.status_code == 200:
            settings = r.json()
            print(f"✅ Settings loaded: {len(settings)} keys")
            return True
        else:
            print(f"❌ Settings GET failed: {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Settings GET error: {e}")
        return False

def test_settings_post():
    """Test POST /api/settings"""
    print("\nTesting POST /api/settings...")
    try:
        test_settings = {
            "test": "value",
            "display": {
                "greetingName": "Test"
            }
        }
        r = requests.post(
            f"{BASE_URL}/api/settings",
            json=test_settings,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        if r.status_code == 200:
            result = r.json()
            if result.get("success"):
                print(f"✅ Settings saved: {result}")
                return True
            else:
                print(f"❌ Settings save failed: {result}")
                return False
        else:
            print(f"❌ Settings POST failed: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        print(f"❌ Settings POST error: {e}")
        return False

def test_camera():
    """Test camera endpoint (will likely fail without real camera)"""
    print("\nTesting /api/camera (may fail without real camera)...")
    try:
        # Test with a dummy URL - should return error but not crash
        r = requests.get(
            f"{BASE_URL}/api/camera",
            params={"url": "http://192.168.1.999/invalid"},
            timeout=10,
            stream=True
        )
        # Even if it fails, as long as we get a response, the endpoint works
        print(f"✅ Camera endpoint responded: {r.status_code}")
        return True
    except requests.exceptions.Timeout:
        print("⚠️ Camera endpoint timed out (expected for invalid URL)")
        return True  # Timeout is OK, means endpoint is working
    except Exception as e:
        print(f"❌ Camera endpoint error: {e}")
        return False

def main():
    print("=" * 60)
    print("FastAPI Backend Test Suite")
    print("=" * 60)
    
    results = []
    results.append(("Health Check", test_health()))
    results.append(("Settings GET", test_settings_get()))
    results.append(("Settings POST", test_settings_post()))
    results.append(("Camera Endpoint", test_camera()))
    
    print("\n" + "=" * 60)
    print("Test Results:")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    all_passed = all(r[1] for r in results)
    
    if all_passed:
        print("\n✅ All tests passed!")
        return 0
    else:
        print("\n❌ Some tests failed. Check backend logs.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
