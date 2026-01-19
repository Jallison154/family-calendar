"""
Calendar ICS feed proxy endpoint
"""

from fastapi import APIRouter, Query, HTTPException, Response
import httpx
import logging
from urllib.parse import unquote
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter()

CALENDAR_TIMEOUT = 30.0

@router.get("/calendar")
async def proxy_calendar(
    url: str = Query(..., description="Calendar ICS feed URL")
):
    """
    Proxy calendar ICS feed to bypass CORS
    """
    logger.info(f"📅 Calendar proxy request: {url[:100]}...")
    
    try:
        # Decode URL
        url = unquote(url)
        
        # Fetch ICS feed
        async with httpx.AsyncClient(timeout=CALENDAR_TIMEOUT) as client:
            response = await client.get(url, follow_redirects=True)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Calendar feed returned {response.status_code}"
                )
            
            ics_content = response.text
            
            if not ics_content or len(ics_content.strip()) == 0:
                raise HTTPException(
                    status_code=500,
                    detail="Calendar feed returned empty response"
                )
            
            logger.info(f"✓ Calendar feed fetched ({len(ics_content)} chars)")
            
            return Response(
                content=ics_content,
                media_type="text/calendar",
                headers={
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            )
    
    except httpx.TimeoutException:
        logger.error(f"❌ Calendar feed timeout: {url}")
        raise HTTPException(
            status_code=504,
            detail="Calendar feed request timed out"
        )
    except httpx.RequestError as e:
        logger.error(f"❌ Calendar feed error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch calendar feed: {str(e)}"
        )
    except Exception as e:
        logger.error(f"❌ Unexpected calendar error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )
