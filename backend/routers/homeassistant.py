"""
Home Assistant API proxy endpoint
"""

from fastapi import APIRouter, Query, HTTPException, Request
import httpx
import logging
from urllib.parse import unquote, urljoin
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter()

HA_TIMEOUT = 30.0

@router.get("/homeassistant")
async def proxy_homeassistant(
    url: str = Query(..., description="Home Assistant API URL"),
    token: Optional[str] = Query(None, description="Home Assistant access token")
):
    """
    Proxy Home Assistant API requests
    """
    logger.info(f"🏠 Home Assistant proxy request: {url[:100]}...")
    
    try:
        # Decode URL
        url = unquote(url)
        
        # Build headers
        headers = {
            'Content-Type': 'application/json'
        }
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        # Fetch from Home Assistant
        async with httpx.AsyncClient(timeout=HA_TIMEOUT) as client:
            response = await client.get(url, headers=headers, follow_redirects=True)
            
            if response.status_code != 200:
                error_text = response.text[:200] if response.text else ''
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Home Assistant returned {response.status_code}: {error_text}"
                )
            
            data = response.json()
            logger.info(f"✓ Home Assistant request successful")
            
            return data
    
    except httpx.TimeoutException:
        logger.error(f"❌ Home Assistant timeout: {url}")
        raise HTTPException(
            status_code=504,
            detail="Home Assistant request timed out"
        )
    except httpx.RequestError as e:
        logger.error(f"❌ Home Assistant error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Home Assistant: {str(e)}"
        )
    except Exception as e:
        logger.error(f"❌ Unexpected Home Assistant error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )
