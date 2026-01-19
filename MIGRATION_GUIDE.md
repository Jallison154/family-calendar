# Migration Guide: Old Backend → FastAPI Backend

## Overview

The backend has been completely rebuilt using **FastAPI** to address:
- ✅ 504 Gateway Timeout errors
- ✅ Camera streaming issues
- ✅ Poor async support
- ✅ Better error handling

## What's New

### Architecture Improvements
- **Async/Await** - Non-blocking I/O for all operations
- **Proper Streaming** - Async streaming for camera feeds (no blocking)
- **Better Timeouts** - Configurable per endpoint
- **Type Safety** - Pydantic models for validation
- **Auto API Docs** - Swagger UI at `/docs`

### API Compatibility
✅ **100% Compatible** - All existing frontend code works without changes!

The API endpoints are identical:
- `GET /api/settings` ✅
- `POST /api/settings` ✅
- `GET /api/camera?url=...` ✅
- `GET /api/calendar?url=...` ✅
- `GET /api/homeassistant?url=...` ✅
- `GET /api/health` ✅
- `GET /api/version` ✅

## Migration Steps

### Step 1: Backup Current Setup
```bash
# Backup settings
cp settings.json settings.json.backup

# Backup old server
cp server.py server.py.backup
```

### Step 2: Install Dependencies
```bash
cd /var/www/family-calendar
pip3 install -r requirements.txt
```

### Step 3: Test New Backend Locally
```bash
# Run new backend
python3 -m backend.main

# Or with uvicorn directly
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Test in browser:
- `http://localhost:8000` - Dashboard
- `http://localhost:8000/docs` - API documentation
- `http://localhost:8000/api/health` - Health check

### Step 4: Update Systemd Service
```bash
# Use the provided script
sudo bash deploy/setup-backend.sh

# Or manually update the service file
sudo nano /etc/systemd/system/family-calendar.service
```

Update the ExecStart line:
```ini
ExecStart=/usr/bin/python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 2
```

### Step 5: Restart Service
```bash
sudo systemctl daemon-reload
sudo systemctl restart family-calendar
sudo systemctl status family-calendar
```

### Step 6: Verify
```bash
# Check health
curl http://127.0.0.1:8000/api/health

# Check logs
sudo journalctl -u family-calendar -f
```

## Rollback (If Needed)

If you need to rollback to the old backend:

```bash
# Restore old server.py
cp server.py.backup server.py

# Update systemd service
sudo nano /etc/systemd/system/family-calendar.service
# Change ExecStart back to: python3 server.py

# Restart
sudo systemctl daemon-reload
sudo systemctl restart family-calendar
```

## Key Differences

### Old Backend (server.py)
- ❌ Synchronous (blocking)
- ❌ Manual CORS handling
- ❌ Threading locks for file access
- ❌ Basic error handling
- ❌ No async streaming

### New Backend (FastAPI)
- ✅ Async/await (non-blocking)
- ✅ Built-in CORS middleware
- ✅ Async locks for file access
- ✅ Proper HTTP status codes
- ✅ Async streaming for camera feeds

## Benefits

1. **No More 504 Errors** - Proper async handling prevents timeouts
2. **Better Camera Streaming** - Non-blocking streaming
3. **Faster Response Times** - Async I/O doesn't block other requests
4. **Better Error Messages** - More informative error responses
5. **Auto Documentation** - Visit `/docs` for API documentation
6. **Type Safety** - Pydantic validation catches errors early

## Troubleshooting

### Issue: ModuleNotFoundError
```bash
# Make sure dependencies are installed
pip3 install -r requirements.txt
```

### Issue: Port 8000 already in use
```bash
# Find what's using the port
sudo lsof -i :8000

# Kill old process or change port in systemd service
```

### Issue: Permission denied
```bash
# Check file permissions
ls -la settings.json

# Fix if needed
sudo chown www-data:www-data settings.json
sudo chmod 644 settings.json
```

### Issue: Import errors
```bash
# Make sure you're in the project directory
cd /var/www/family-calendar

# Test import
python3 -c "from backend.main import app; print('OK')"
```

## Performance

The new backend should handle:
- ✅ Multiple concurrent camera streams
- ✅ Faster settings API responses
- ✅ Better resource utilization
- ✅ No blocking between requests

## Next Steps

After migration:
1. Monitor logs: `sudo journalctl -u family-calendar -f`
2. Test all features (calendar, cameras, HA)
3. Check API docs: `http://your-server/docs`
4. Remove old `server.py` if everything works (keep backup!)

## Support

If you encounter issues:
1. Check logs: `sudo journalctl -u family-calendar -n 100`
2. Test health endpoint: `curl http://127.0.0.1:8000/api/health`
3. Check API docs: `http://your-server/docs`
4. Review this guide for common issues
