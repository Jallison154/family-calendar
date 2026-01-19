# 504 Gateway Timeout on /api/settings - Diagnosis Guide

## Problem
Getting `504 Gateway Time-out` errors for `/api/settings` endpoint. This is different from camera timeouts - the settings endpoint should respond in milliseconds.

## Root Cause
A 504 on `/api/settings` typically means:
- **Python server is not running** (most common)
- **Python server crashed/hung**
- **Nginx can't connect to Python server** (network/firewall issue)
- **Python server is taking too long** (unlikely for simple file read)

## Quick Diagnosis

### Step 1: Check if Python server is running
```bash
sudo systemctl status family-calendar
```

**Expected output:**
```
● family-calendar.service - Family Calendar Dashboard Server
   Loaded: loaded (/etc/systemd/system/family-calendar.service)
   Active: active (running) since...
```

**If it says "inactive" or "failed":**
```bash
# Start the server
sudo systemctl start family-calendar

# Check logs for errors
sudo journalctl -u family-calendar -n 50 --no-pager
```

### Step 2: Test server directly (bypass nginx)
```bash
curl http://127.0.0.1:8000/api/health
```

**Expected response:**
```json
{"status":"ok","service":"family-calendar","timestamp":"2024-..."}
```

**If this fails:**
- Server is not running or crashed
- Check logs: `sudo journalctl -u family-calendar -f`

**If this works but browser still gets 504:**
- Nginx configuration issue
- Nginx timeout too short
- Nginx can't connect to Python server

### Step 3: Check nginx configuration
```bash
# Check nginx is running
sudo systemctl status nginx

# Test nginx config
sudo nginx -t

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Step 4: Test health endpoint
```bash
# Via nginx
curl http://192.168.10.212/api/health

# Direct to Python server
curl http://127.0.0.1:8000/api/health
```

## Common Issues & Fixes

### Issue 1: Server Not Running
**Symptoms:** `systemctl status` shows inactive/failed

**Fix:**
```bash
sudo systemctl start family-calendar
sudo systemctl enable family-calendar  # Auto-start on boot
```

### Issue 2: Server Crashed
**Symptoms:** Server was running but stopped

**Fix:**
```bash
# Check logs for crash reason
sudo journalctl -u family-calendar -n 100 --no-pager

# Common causes:
# - Syntax error in server.py
# - Port 8000 already in use
# - Permission denied (can't read settings.json)
# - Missing Python dependencies

# Restart after fixing
sudo systemctl restart family-calendar
```

### Issue 3: Port 8000 Already in Use
**Symptoms:** Server fails to start, "Address already in use"

**Fix:**
```bash
# Find what's using port 8000
sudo lsof -i :8000

# Kill the process or change port in server.py
```

### Issue 4: Nginx Can't Connect
**Symptoms:** Direct curl works, but nginx returns 504

**Fix:**
1. Verify nginx config has correct proxy_pass:
   ```nginx
   proxy_pass http://127.0.0.1:8000;
   ```

2. Check nginx timeout settings (should be 90s):
   ```nginx
   proxy_read_timeout 90s;
   ```

3. Restart nginx:
   ```bash
   sudo systemctl reload nginx
   ```

### Issue 5: Permission Issues
**Symptoms:** Server can't read `settings.json`

**Fix:**
```bash
# Check file permissions
ls -la settings.json

# Fix permissions
sudo chown www-data:www-data settings.json
sudo chmod 644 settings.json
```

## Prevention

### Auto-restart on failure
Edit the systemd service to auto-restart:
```bash
sudo systemctl edit family-calendar
```

Add:
```ini
[Service]
Restart=always
RestartSec=10
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl restart family-calendar
```

### Monitor server health
The new `/api/health` endpoint can be used for monitoring:
```bash
# Add to cron or monitoring system
curl -f http://127.0.0.1:8000/api/health || systemctl restart family-calendar
```

## After Fixing

1. **Restart Python server:**
   ```bash
   sudo systemctl restart family-calendar
   ```

2. **Reload nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

3. **Test in browser:**
   - Open dashboard
   - Check console for errors
   - Settings should load

4. **Monitor logs:**
   ```bash
   sudo journalctl -u family-calendar -f
   ```

## Still Having Issues?

1. Check Python server logs: `sudo journalctl -u family-calendar -n 100`
2. Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
3. Test health endpoint: `curl http://127.0.0.1:8000/api/health`
4. Verify nginx config: `sudo nginx -t`
5. Check if port 8000 is listening: `sudo netstat -tlnp | grep 8000`
