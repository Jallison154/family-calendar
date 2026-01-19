"""
Settings API endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime
import json
import asyncio
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

SETTINGS_FILE = Path('settings.json')
# Use asyncio lock for file operations
_settings_lock = asyncio.Lock()

@router.get("/settings")
async def get_settings():
    """Get current settings"""
    logger.info("📋 GET /api/settings request")
    try:
        async with _settings_lock:
            if SETTINGS_FILE.exists():
                content = SETTINGS_FILE.read_text()
                settings = json.loads(content)
                logger.info(f"✓ Settings loaded ({len(settings)} keys)")
            else:
                settings = {}
                logger.info("⚠ Settings file not found, returning empty settings")
        
        # Remove metadata fields
        settings.pop('_lastUpdated', None)
        return settings
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON in settings file: {e}")
        raise HTTPException(status_code=500, detail="Settings file contains invalid JSON")
    except Exception as e:
        logger.error(f"❌ Error loading settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load settings: {str(e)}")

@router.post("/settings")
async def save_settings(settings: Dict[str, Any]):
    """Save settings - accepts settings object directly"""
    logger.info("💾 POST /api/settings request")
    try:
        async with _settings_lock:
            # Add metadata
            settings['_lastUpdated'] = datetime.now().isoformat()
            
            # Write to file atomically
            temp_file = SETTINGS_FILE.with_suffix('.tmp')
            temp_file.write_text(json.dumps(settings, indent=2))
            temp_file.replace(SETTINGS_FILE)
            
            logger.info(f"✓ Settings saved ({len(settings)} keys)")
        
        return {"success": True, "message": "Settings saved successfully"}
    except Exception as e:
        logger.error(f"❌ Error saving settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")
