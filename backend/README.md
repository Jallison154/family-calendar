# Family Calendar Dashboard - FastAPI Backend

Modern async backend rebuilt from scratch to address timeout and streaming issues.

## Features

- ✅ **Async/Await Support** - Non-blocking I/O for better performance
- ✅ **Proper Streaming** - Async streaming for camera feeds
- ✅ **Better Timeout Handling** - Configurable timeouts per endpoint
- ✅ **Automatic API Docs** - Swagger UI at `/docs`
- ✅ **Type Safety** - Pydantic models for validation
- ✅ **Better Error Handling** - Proper HTTP status codes and error messages
- ✅ **CORS Support** - Built-in CORS middleware
- ✅ **Static File Serving** - Serves dashboard files

## Architecture

```
backend/
├── main.py              # FastAPI app and configuration
├── routers/
│   ├── __init__.py
│   ├── health.py        # Health check and version
│   ├── settings.py      # Settings GET/POST
│   ├── camera.py        # Camera stream proxy
│   ├── calendar.py      # Calendar ICS proxy
│   └── homeassistant.py # Home Assistant API proxy
```

## API Endpoints

### Settings
- `GET /api/settings` - Get current settings
- `POST /api/settings` - Save settings

### Camera
- `GET /api/camera?url=...&username=...&password=...` - Proxy camera stream

### Calendar
- `GET /api/calendar?url=...` - Proxy calendar ICS feed

### Home Assistant
- `GET /api/homeassistant?url=...&token=...` - Proxy HA API

### Health
- `GET /api/health` - Health check
- `GET /api/version` - Server version

## Running

### Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
python -m backend.main
# Or
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Production
```bash
# Using uvicorn
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4

# Or with gunicorn
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Migration from Old Backend

The new backend is **fully compatible** with the existing frontend. No frontend changes needed!

### Differences:
1. **Better async support** - Camera streams won't block other requests
2. **Proper timeout handling** - 504 errors handled correctly
3. **Better error messages** - More informative error responses
4. **Automatic API docs** - Visit `/docs` to see all endpoints

### Deployment:
1. Install new dependencies: `pip install -r requirements.txt`
2. Update systemd service to use new backend
3. Restart service: `sudo systemctl restart family-calendar`

## API Documentation

Visit `http://your-server:8000/docs` for interactive API documentation (Swagger UI).
