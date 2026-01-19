# Camera Feed 504 Gateway Timeout - Diagnosis & Fix

## Problem
The camera feed is showing a **504 Gateway Timeout** error. This happens when nginx (the reverse proxy) times out waiting for the Python server to respond.

## Root Cause Analysis

### The Request Flow:
1. **Browser** → Requests `/api/camera?url=...` 
2. **Nginx** → Proxies to Python server at `http://127.0.0.1:8000`
3. **Python Server** → Tries to connect to camera (60s timeout)
4. **Camera** → May be slow to respond or unreachable
5. **Nginx** → Times out (default 60s) before Python responds → Returns 504

### Why 504 Happens:
- **Nginx timeout** (default 60s) is the same or shorter than Python server timeout (60s)
- If the camera takes >60s to connect, nginx gives up and returns 504
- The Python server may still be trying to connect, but nginx already sent 504 to the client

## Fixes Applied

### 1. Increased Nginx Timeouts (in `deploy/setup.sh`)
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    # Increase timeouts for camera streams (can be slow)
    proxy_connect_timeout 90s;
    proxy_send_timeout 90s;
    proxy_read_timeout 90s;
    # Don't buffer responses (important for streaming)
    proxy_buffering off;
}
```

### 2. Improved Client-Side Error Handling (in `js/widgets/camera.js`)
- Better detection of 504 errors
- More informative error messages
- Handles timeout scenarios gracefully

### 3. Enhanced Server Logging (in `server.py`)
- Logs connection time
- Returns 504 status code for timeouts (not just 500)
- More detailed error messages with elapsed time

## How to Apply the Fix

### Step 1: Update Nginx Configuration
Run this on your server:

```bash
sudo tee /etc/nginx/sites-available/family-calendar > /dev/null <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    root /var/www/family-calendar;
    index index.html;
    
    server_name _;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    
    # Proxy API requests to Python server
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Increase timeouts for camera streams (can be slow)
        proxy_connect_timeout 90s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
        # Don't buffer responses (important for streaming)
        proxy_buffering off;
    }
    
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
NGINX

sudo nginx -t && sudo systemctl reload nginx
```

### Step 2: Restart Python Server
```bash
sudo systemctl restart family-calendar
```

### Step 3: Check Server Logs
Monitor the logs to see what's happening:
```bash
sudo journalctl -u family-calendar -f
```

Look for:
- `📹 Camera Proxy Request` - Request received
- `Making request to camera:` - Connection attempt
- `✓ Connection established in X.XX seconds` - Success
- `❌ URL Error after X.XX seconds` - Failure with timing

## Troubleshooting

### If 504 Still Occurs:

1. **Check if camera is reachable from server:**
   ```bash
   curl -v --max-time 10 http://CAMERA_IP/cgi-bin/mjpg/video.cgi?channel=1&subtype=1
   ```

2. **Check nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Check Python server logs:**
   ```bash
   sudo journalctl -u family-calendar -n 50 --no-pager
   ```

4. **Test camera URL directly:**
   - Open the camera URL in a browser
   - If it works in browser but not via proxy, it's likely:
     - Network/firewall issue
     - Authentication issue
     - Camera blocking server IP

### Common Issues:

- **Camera unreachable**: Check IP address, network connectivity
- **Authentication failed**: Verify username/password in control panel
- **Firewall blocking**: Camera may block requests from server IP
- **Camera too slow**: Some cameras take >60s to start streaming

## Expected Behavior After Fix

- Nginx waits up to 90 seconds for Python server
- Python server waits up to 60 seconds for camera
- Better error messages showing what went wrong
- Client-side handles 504 errors gracefully

## Next Steps if Still Failing

1. Check server logs for specific error messages
2. Verify camera URL works in browser
3. Test camera connectivity from server
4. Consider increasing timeouts further if camera is very slow
5. Check if camera requires specific User-Agent or headers
