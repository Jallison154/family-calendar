# Quick Fix for Control Page and Cameras

## Issues Found

1. **Settings API Format Mismatch** ✅ FIXED
   - Backend expected `{"settings": {...}}` 
   - Frontend sends `{...}` directly
   - Fixed: Backend now accepts settings object directly

2. **Camera Endpoint** - Needs testing
   - Camera proxy should work with new async backend
   - Make sure backend is running

## Quick Test

### 1. Test Backend is Running
```bash
# Check if backend is running
curl http://127.0.0.1:8000/api/health

# Should return: {"status":"ok","service":"family-calendar",...}
```

### 2. Test Settings API
```bash
# Get settings
curl http://127.0.0.1:8000/api/settings

# Save settings (test)
curl -X POST http://127.0.0.1:8000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"test": "value"}'
```

### 3. Test Camera Endpoint
```bash
# Test camera proxy (replace with your camera URL)
curl "http://127.0.0.1:8000/api/camera?url=http://192.168.1.100/cgi-bin/mjpg/video.cgi"
```

## If Backend Not Running

### Option 1: Use Old Backend (Temporary)
```bash
# Start old server.py
python3 server.py
```

### Option 2: Start New Backend
```bash
# Install dependencies
pip3 install -r requirements.txt

# Run new backend
python3 -m backend.main

# Or with uvicorn
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Option 3: Deploy New Backend
```bash
sudo bash deploy/setup-backend.sh
```

## Control Page Issues

If control page is broken:

1. **Check Browser Console** (F12)
   - Look for JavaScript errors
   - Check if `window.settingsAPI` is defined

2. **Check Network Tab**
   - See if `/api/settings` requests are failing
   - Check response status codes

3. **Test Settings API Directly**
   ```bash
   curl http://localhost:8000/api/settings
   ```

## Camera Issues

If cameras aren't working:

1. **Check Backend Logs**
   ```bash
   # If using systemd
   sudo journalctl -u family-calendar -f
   
   # If running manually
   # Check console output
   ```

2. **Test Camera URL Directly**
   - Open camera URL in browser
   - If it works in browser but not via proxy, check backend logs

3. **Check Camera Configuration**
   - Make sure URL is correct in control panel
   - Check if username/password are needed
   - Verify camera is accessible from server

## Common Fixes

### Fix 1: Backend Not Running
```bash
# Check status
sudo systemctl status family-calendar

# Start if stopped
sudo systemctl start family-calendar

# Check logs
sudo journalctl -u family-calendar -n 50
```

### Fix 2: Port 8000 Already in Use
```bash
# Find what's using port 8000
sudo lsof -i :8000

# Kill old process or change port
```

### Fix 3: Python Dependencies Missing
```bash
pip3 install -r requirements.txt
```

### Fix 4: Settings File Permissions
```bash
sudo chown www-data:www-data settings.json
sudo chmod 644 settings.json
```

## Next Steps

1. ✅ Settings API format fixed
2. Test control page - should work now
3. Test cameras - should work if backend is running
4. Check logs for any errors
