"""
Family Calendar Dashboard - FastAPI Backend
Modern async backend with proper streaming support
"""

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from contextlib import asynccontextmanager
import uvicorn
import json
import os
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any
import logging
from datetime import datetime

from .routers import settings, camera, calendar, homeassistant, health

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Settings file path
SETTINGS_FILE = Path('settings.json')
STATIC_DIR = Path('.')

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("🚀 Family Calendar Dashboard Backend Starting...")
    logger.info(f"Settings file: {SETTINGS_FILE.absolute()}")
    logger.info(f"Static directory: {STATIC_DIR.absolute()}")
    
    # Ensure settings file exists
    if not SETTINGS_FILE.exists():
        logger.info(f"Creating default settings file: {SETTINGS_FILE}")
        SETTINGS_FILE.write_text(json.dumps({}, indent=2))
    
    yield
    
    logger.info("🛑 Family Calendar Dashboard Backend Shutting down...")

# Create FastAPI app
app = FastAPI(
    title="Family Calendar Dashboard API",
    description="Backend API for Family Calendar Dashboard",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(camera.router, prefix="/api", tags=["camera"])
app.include_router(calendar.router, prefix="/api", tags=["calendar"])
app.include_router(homeassistant.router, prefix="/api", tags=["homeassistant"])
app.include_router(health.router, prefix="/api", tags=["health"])

# Serve static files (index.html, control.html, etc.)
# This should be last to catch all non-API routes
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

@app.get("/")
async def root():
    """Serve index.html"""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="index.html not found")

if __name__ == "__main__":
    # Run with uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=True  # Auto-reload on code changes (development)
    )
