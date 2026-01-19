"""
Camera stream proxy endpoint
Handles MJPEG, HLS, and other camera streams with authentication
"""

from fastapi import APIRouter, Query, HTTPException, Response
from fastapi.responses import StreamingResponse
import httpx
import logging
from urllib.parse import urlparse, unquote
from typing import Optional
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter()

# Timeout for camera connections (60 seconds)
CAMERA_TIMEOUT = 60.0

async def stream_camera_response(
    url: str,
    username: Optional[str] = None,
    password: Optional[str] = None
):
    """Stream camera response asynchronously"""
    try:
        # Parse URL
        parsed = urlparse(url)
        
        # Build auth if credentials provided
        auth = None
        if username and password:
            auth = (username, password)
        
        # Determine content type
        is_mjpeg = '/mjpg/' in url or '/mjpeg/' in url or 'video.cgi' in url
        is_hls = '.m3u8' in url
        
        # Create HTTP client with timeout
        async with httpx.AsyncClient(
            timeout=CAMERA_TIMEOUT,
            follow_redirects=True,
            verify=False  # Some cameras use self-signed certs
        ) as client:
            # Make request
            async with client.stream('GET', url, auth=auth) as response:
                # Check status
                if response.status_code != 200:
                    error_text = await response.aread()
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Camera returned {response.status_code}: {error_text.decode('utf-8', errors='ignore')[:200]}"
                    )
                
                # Get content type
                content_type = response.headers.get('Content-Type', 'video/mp4')
                if is_hls:
                    content_type = 'application/vnd.apple.mpegurl'
                elif is_mjpeg:
                    content_type = 'multipart/x-mixed-replace'
                
                # Stream response
                async def generate():
                    bytes_sent = 0
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        bytes_sent += len(chunk)
                        yield chunk
                    logger.info(f"✓ Streamed {bytes_sent} bytes to client")
                
                return StreamingResponse(
                    generate(),
                    media_type=content_type,
                    headers={
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                )
    
    except httpx.TimeoutException:
        logger.error(f"❌ Camera connection timeout: {url}")
        raise HTTPException(
            status_code=504,
            detail=f"Camera connection timed out after {CAMERA_TIMEOUT}s. Camera may be unreachable or slow."
        )
    except httpx.ConnectError as e:
        logger.error(f"❌ Camera connection error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to camera: {str(e)}"
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"❌ Camera HTTP error: {e.response.status_code}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Camera returned error {e.response.status_code}"
        )
    except Exception as e:
        logger.error(f"❌ Unexpected camera error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )

@router.get("/camera")
async def proxy_camera(
    url: str = Query(..., description="Camera stream URL"),
    username: Optional[str] = Query(None, description="HTTP Basic/Digest username"),
    password: Optional[str] = Query(None, description="HTTP Basic/Digest password")
) -> StreamingResponse:
    """
    Proxy camera stream with authentication support
    
    Supports:
    - MJPEG streams
    - HLS streams (.m3u8)
    - HTTP Basic authentication
    - HTTP Digest authentication
    """
    logger.info(f"📹 Camera proxy request: {url[:100]}...")
    
    # Decode URL if needed
    try:
        url = unquote(url)
    except Exception as e:
        logger.error(f"❌ Error decoding URL: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid URL encoding: {str(e)}")
    
    # Validate URL
    if not url.startswith(('http://', 'https://')):
        raise HTTPException(status_code=400, detail="Only HTTP/HTTPS URLs are supported")
    
    # RTSP not supported (browsers can't play RTSP)
    if url.startswith('rtsp://'):
        raise HTTPException(
            status_code=501,
            detail="RTSP streams require server-side conversion to HLS. Please use HLS or MJPEG streams."
        )
    
    # Decode credentials
    decoded_username = unquote(username) if username else None
    decoded_password = unquote(password) if password else None
    
    if decoded_username:
        logger.info(f"Using authentication for camera")
    
    # Stream the response
    return await stream_camera_response(url, decoded_username, decoded_password)
