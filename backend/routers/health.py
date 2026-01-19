"""
Health check and version endpoints
"""

from fastapi import APIRouter
from datetime import datetime
import hashlib
import glob
import os
from pathlib import Path

router = APIRouter()

@router.get("/health")
async def health_check():
    """Health check endpoint - responds immediately"""
    return {
        "status": "ok",
        "service": "family-calendar",
        "timestamp": datetime.now().isoformat()
    }

@router.get("/version")
async def get_version():
    """Get server version based on file modification times"""
    try:
        # Get modification times of key files
        key_files = [
            'index.html',
            'backend/main.py',
            'js/app.js',
            'js/config.js'
        ]
        
        # Add JS/CSS files
        js_files = glob.glob('js/**/*.js', recursive=True)
        css_files = glob.glob('css/**/*.css', recursive=True)
        key_files.extend(js_files[:10])
        key_files.extend(css_files[:10])
        
        version_parts = []
        for file_path in key_files:
            if os.path.exists(file_path):
                mtime = os.path.getmtime(file_path)
                version_parts.append(f"{file_path}:{mtime}")
        
        # Create hash
        version_string = '|'.join(sorted(version_parts))
        version_hash = hashlib.md5(version_string.encode()).hexdigest()[:12]
        
        return {
            "version": version_hash,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "version": "unknown",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
