#!/usr/bin/env python3
"""
Simple HTTP server with settings API
Serves static files and provides REST API for dashboard settings
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
import json
import os
import threading
from datetime import datetime
import urllib.request
import urllib.error

SETTINGS_FILE = 'settings.json'
SETTINGS_LOCK = threading.Lock()

class DashboardHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        
        # API endpoint for getting settings
        if parsed_path.path == '/api/settings':
            self.send_settings()
            return
        
        # API endpoint for proxying calendar ICS feeds
        if parsed_path.path == '/api/calendar':
            self.proxy_calendar()
            return
        
        # Serve static files
        self.serve_static_file()
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        
        # API endpoint for saving settings
        if parsed_path.path == '/api/settings':
            self.save_settings()
            return
        
        # 404 for unknown POST endpoints
        self.send_response(404)
        self.end_headers()
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def send_cors_headers(self):
        """Send CORS headers"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '3600')
    
    def send_settings(self):
        """Send current settings"""
        try:
            with SETTINGS_LOCK:
                if os.path.exists(SETTINGS_FILE):
                    with open(SETTINGS_FILE, 'r') as f:
                        settings = json.load(f)
                else:
                    settings = {}
            
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(settings).encode())
        except Exception as e:
            print(f"Error reading settings: {e}")
            self.send_response(500)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def save_settings(self):
        """Save settings from request body"""
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            settings = json.loads(body.decode())
            
            # Add timestamp
            settings['_lastUpdated'] = datetime.now().isoformat()
            
            # Save to file
            with SETTINGS_LOCK:
                with open(SETTINGS_FILE, 'w') as f:
                    json.dump(settings, f, indent=2)
            
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode())
            print(f"Settings saved at {settings.get('_lastUpdated')}")
        except Exception as e:
            print(f"Error saving settings: {e}")
            self.send_response(500)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def serve_static_file(self):
        """Serve static files"""
        path = self.path
        if path == '/':
            path = '/index.html'
        
        # Security: prevent directory traversal
        if '..' in path:
            self.send_response(403)
            self.end_headers()
            return
        
        # Remove leading slash
        file_path = path.lstrip('/')
        
        # Default to index.html if path ends with /
        if not file_path or os.path.isdir(file_path):
            file_path = 'index.html'
        
        # Check if file exists
        if not os.path.exists(file_path):
            self.send_response(404)
            self.end_headers()
            return
        
        # Determine content type
        content_type = 'text/html'
        if file_path.endswith('.css'):
            content_type = 'text/css'
        elif file_path.endswith('.js'):
            content_type = 'application/javascript'
        elif file_path.endswith('.json'):
            content_type = 'application/json'
        elif file_path.endswith('.png'):
            content_type = 'image/png'
        elif file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
            content_type = 'image/jpeg'
        elif file_path.endswith('.svg'):
            content_type = 'image/svg+xml'
        elif file_path.endswith('.ico'):
            content_type = 'image/x-icon'
        
        # Send file
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            print(f"Error serving file {file_path}: {e}")
            self.send_response(500)
            self.end_headers()
    
    def proxy_calendar(self):
        """Proxy ICS calendar feed requests (avoid CORS issues)"""
        try:
            parsed_path = urlparse(self.path)
            query_params = parse_qs(parsed_path.query)
            
            # Get URL from query parameter
            url = query_params.get('url', [None])[0]
            if not url:
                self.send_response(400)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Missing 'url' parameter"}).encode())
                return
            
            # Decode URL
            url = unquote(url)
            
            # Validate URL is from calendar.google.com (security measure)
            if not url.startswith('https://calendar.google.com/'):
                self.send_response(400)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Only Google Calendar URLs are allowed"}).encode())
                return
            
            # Fetch the ICS feed
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Family Calendar Server)'
            })
            
            try:
                with urllib.request.urlopen(req, timeout=30) as response:
                    ics_content = response.read()
                    content_type = response.headers.get('Content-Type', 'text/calendar')
                    
                    # Send response
                    self.send_response(200)
                    self.send_cors_headers()
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(ics_content)))
                    self.send_header('Cache-Control', 'public, max-age=300')  # Cache for 5 minutes
                    self.end_headers()
                    self.wfile.write(ics_content)
            except urllib.error.HTTPError as e:
                print(f"Calendar proxy HTTP error: {e.code} {e.reason}")
                self.send_response(e.code)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"HTTP {e.code}: {e.reason}"}).encode())
            except urllib.error.URLError as e:
                print(f"Calendar proxy URL error: {e.reason}")
                self.send_response(500)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Failed to fetch calendar: {e.reason}"}).encode())
            except Exception as e:
                print(f"Calendar proxy error: {e}")
                self.send_response(500)
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
                
        except Exception as e:
            print(f"Calendar proxy unexpected error: {e}")
            self.send_response(500)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def log_message(self, format, *args):
        """Override to use print instead of stderr"""
        print(f"{self.address_string()} - {format % args}")


def run(server_class=HTTPServer, handler_class=DashboardHandler, port=8000):
    """Run the server"""
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"🚀 Dashboard server running on http://localhost:{port}")
    print(f"📁 Serving files from: {os.getcwd()}")
    print(f"💾 Settings stored in: {SETTINGS_FILE}")
    print("\nPress Ctrl+C to stop the server\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped")
        httpd.server_close()


if __name__ == '__main__':
    import sys
    port = 8000
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    run(port=port)





